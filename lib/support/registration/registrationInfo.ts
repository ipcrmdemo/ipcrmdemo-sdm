import {
  Configuration, configurationValue,
  HandlerResult,
  HttpMethod,
  logger,
  NoParameters,
} from "@atomist/automation-client";
import * as slack from "@atomist/slack-messages";
import { CommandHandlerRegistration, CommandListenerInvocation, slackErrorMessage } from "@atomist/sdm";

export interface Ingester {
  root_type: string;
  url: string;
}
export interface Command {
  name: string;
  description: string;
  intent: string[];
}
export interface Registration {
  name: string;
  commands: Command[];
  ingesters: Ingester[];
  groups?: string[];
  version: string;
  team_ids: string[];
}
export interface ListSkill {
  sdm: string;
  intent: string;
  description: string;
}

export interface SdmSkills {
  name: string;
  version: string;
  skills: ListSkill[];
}

export interface ListSkillsConfig {
  explicitSdmAllow?: string[]; // If populated, only show intents from these SDMs
  filterIntents?: string[]; // If populated, for each intent, only display if it includes one of the strings supplied
  excludeIntentsFilter?: string[]; // If populated, for each intent, only display intent if not excluded
}

/**
 * Based on the supplied config, filter intents and return updated SdmSkills
 * @param {SdmSkills[]} skills
 * @param {ListSkillsConfig} config
 * @param {Boolean} exclude
 * @returns {SdmSkills[]} Array of SdmSkills objects
 */
export function applyIntentFilter(
  skills: SdmSkills[], config: ListSkillsConfig, exclude: boolean = false): SdmSkills[] {
  const newSkills = skills.map(s => {
    const tmpSkills = s.skills.filter(i => {
      if (exclude) {
        return !(config.excludeIntentsFilter.filter(fi => i.intent.includes(fi)).length > 0);
      } else {
        return config.filterIntents.filter(fi => i.intent.includes(fi)).length > 0;
      }
    });
    return {
      name: s.name,
      version: s.version,
      skills: tmpSkills,
    };
  });

  return newSkills.filter(nS => nS.skills.length > 0);
}

/**
 * Take a SdmSkills object and filter it based on the configuration supplied ListSkillsConfig
 * @param {SdmSkills[]} skills
 * @returns {SdmSkills[]} Filtered SDM Skills
 */
export function filterSkills(skills: SdmSkills[]): SdmSkills[] {
  const config = configurationValue<ListSkillsConfig>("sdm.listSkills", {});
  let returnSkills: SdmSkills[] = skills;

  // Apply SDM Filter
  if (config.explicitSdmAllow && config.explicitSdmAllow.length > 0) {
    const lowerExplicitSdmAllow = config.explicitSdmAllow.map(e => e.toLowerCase());
    returnSkills = returnSkills.filter(s => lowerExplicitSdmAllow.includes(s.name.toLowerCase()));
  }

  // Apply intent filters
  if (config.filterIntents && config.filterIntents.length > 0) {
    returnSkills = applyIntentFilter(returnSkills, config);
  }
  if (config.excludeIntentsFilter && config.excludeIntentsFilter.length > 0) {
    returnSkills = applyIntentFilter(returnSkills, config, true);
  }

  return returnSkills;
}

/**
 * Listener for displaying the list of skills known to Atomist, filtered based on your configuration
 * @param {CommandListenerInvocation<NoParameters>} cli
 * @returns {Promise<HandlerResult>} Handler Result
 */
export async function listSkillsListener(cli: CommandListenerInvocation<NoParameters>): Promise<HandlerResult> {
  return new Promise<HandlerResult>(async (resolve, reject) => {
    interface TeamInfo {
      id: string;
    }
    interface ChatTeamInfo {
      team: TeamInfo;
    }
    interface TeamInfo {
      ChatTeam: ChatTeamInfo[];
    }

    try {
      // In-progress message
      await cli.addressChannels({
        attachments: [
          {
            pretext: `Here are the skills known to *Atomist*:`,
            text: slack.emoji("hourglass") + "Searching...",
            fallback: `Here are the skills known to *Atomist*:`,
          },
        ],
      }, {
        id: `list/skills/${cli.configuration.name}`,
        ttl: 60 * 120,
      });

      const teamInfo = await cli.context.graphClient.query<TeamInfo, {}>({query: `{ChatTeam{team {id}}}`});
      const allSkills = await buildSkillsList(cli.configuration, teamInfo.ChatTeam[0].team.id);
      const msgBody = [];
      const skills = filterSkills(allSkills);
      skills.forEach(s => {
        msgBody.push(`\n*${s.name}:${s.version}*`);
        s.skills.forEach(i => {
          msgBody.push(`${slack.codeLine(i.intent)} ${i.description}`);
        });
      });

      logger.debug(`listSkills: msg body => ${JSON.stringify(msgBody, undefined, 2)}`);

      await cli.addressChannels({
        attachments: [
          {
            pretext: `Here are the skills known to *Atomist*:`,
            text: msgBody.join("\n"),
            fallback: `Here are the skills known to *Atomist*:`,
          },
        ],
      }, {
        id: `list/skills/${cli.configuration.name}`,
        ttl: 60 * 120,
      });

      resolve({
        code: 0,
      });
    } catch (e) {
      await cli.addressChannels(slackErrorMessage(
        `Failed to run list skills`,
        `${e}`,
        cli.context),
        {
          id: `list/skills/${cli.configuration.name}`,
          ttl: 60 * 60,
        },
      );

      reject({
        code: 1,
        message: e,
      });
    }
  });
}

/** Build Skill List
 * @param {Configuration} config
 * @param {string} teamId
 * @return {SdmSkills[]} Skills to be printed
 */
export function buildSkillsList(config: Configuration, teamId: string): Promise<SdmSkills[]> {
  const skills: SdmSkills[] = [];
  return new Promise<SdmSkills[]>(async (resolve, reject) => {
    try {
      const regInfo = await getRegistrationInfo(config);
      regInfo.forEach(r => {
        logger.info(`buildSkillsList: Processing ${r.name}`);
        if (!r.hasOwnProperty("commands")) {
          return;
        }
        if (
          !(r.hasOwnProperty("team_ids") && r.team_ids.includes(teamId)) &&
          !(r.hasOwnProperty("groups") && r.groups.includes("all"))
        ) {
          return;
        }
        const mySkills: ListSkill[] = [];
        r.commands.forEach(c => {
          if (c.hasOwnProperty("intent") && c.intent && c.intent.length > 0 ) {
            c.intent.forEach(i => {
              mySkills.push({
                sdm: r.name,
                intent: i,
                description: c.description,
              });
            });
          }
        });

        if (mySkills.length > 0) {
          skills.push({name: r.name, version: r.version, skills: mySkills});
        }
      });
    } catch (e) {
      logger.error(`buildSkillsList: Failed to lookup skill list! Error => ${e}`);
      reject(e);
    }
    resolve(skills);
  });
}

/**
 * Gets registration info for this API key
 * @param {Configuration} config
 * @return {JSON} registration info
 */
export const getRegistrationInfo = async (config: Configuration): Promise<Registration[]> => {
  logger.debug(`Starting  getRegistrationInfo`);
  const url = `https://automation.atomist.com/v2/registration`;
  const httpClient = config.http.client.factory.create(url);
  try {
    const authorization = `Bearer ${config.apiKey}`;
    const result = await httpClient.exchange(url, {
      method: HttpMethod.Get,
      headers: { Authorization: authorization },
    });
    return(result.body as Registration[]);
  } catch (e) {
    logger.error("getRegistrationInfo: Error! Failed to retrieve data. Failure: " + e.message);
    throw new Error(e);
  }
};

/**
 * Command Handler Registration for customized List Skills intent
 */
export const listSkills: CommandHandlerRegistration<NoParameters> = {
  name: "ListSkills",
  intent: [
    "list skills",
    "show skills",
    "list skill",
    "show skill",
    "ls",
  ],
  listener: listSkillsListener,
};
