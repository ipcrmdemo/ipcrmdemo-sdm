import { CommandHandlerRegistration } from "@atomist/sdm/lib/api/registration/CommandHandlerRegistration";
import * as types from "../../typings/types";
import {
  CommandListenerInvocation,
  createJob,
  ParametersDefinition,
  slackErrorMessage,
  slackSuccessMessage,
} from "@atomist/sdm";
import { queryPreferences } from "@atomist/sdm-pack-fingerprint/lib/adhoc/preferences";
import {
  ApplyTargetFingerprintParameters,
} from "@atomist/sdm-pack-fingerprint/lib/handlers/commands/applyFingerprint";

export interface FilteredApplyParams {
  title: string;
  body: string;
  name: string;
  type: string;
  filterByName: string;
  filterByType: string;
}

export const FilteredApplyParamsDefinition: ParametersDefinition<FilteredApplyParams> = {
  title: {
    description: "Supply a title for the new PR",
  },
  body: {
    description: "Supply a body for the new PR",
  },
  name: {
    description: "Supply a fingerprint name (This is the fingerprint name who's target will be applied!)",
  },
  type: {
    description: "Supply a fingerprint type (This is the fingerprint type who's target will be applied!)",
  },
  filterByName: {
    description: "Supply a fingerprint name to reduce targets to",
  },
  filterByType: {
    description: "Supply a type for the fingeprint to reduce targets to",
  },
};

export const filteredAspectApply: CommandHandlerRegistration<FilteredApplyParams> = {
  name: "filteredAspectApply",
  intent: "run filtered apply",
  parameters: FilteredApplyParamsDefinition,
  autoSubmit: true,
  listener: async cli => {
    /**
     * Go Lookup fp data, i.e. set target
     */
    try {
      await queryPreferences(cli.context.graphClient, cli.parameters.type, cli.parameters.name);
    } catch {
      /**
       * If it's not present, exit the handler
       */
      await cli.addressChannels(slackErrorMessage(
        "No fingeprint found!",
        `No fingerprint data found for ${cli.parameters.type}::${cli.parameters.name}`,
        cli.context,
      ));
      return { code: 0 };
    }

    /**
     * Find all repos with this fingerprint; the ones we could actually apply to
     */
    const actionableRepos = await getMatchingRepos(cli, cli.parameters.name, cli.parameters.type);

    /**
     * Apply any data filtering desired/required
     */
    const nodeProjects = await getMatchingRepos(cli, cli.parameters.filterByName, cli.parameters.filterByType);
    const filteredList = nodeProjects.filter(v => actionableRepos.includes(v));
    const newdata = filteredList
      .filter(f => ["ipcrmdemo::nov9node", "ipcrmdemo::nov19node", "ipcrmdemo::may6node"].includes(f));

    /**
     * Create a new job for the resulting list
     */
    const jobId = await createJob<ApplyTargetFingerprintParameters>({
      command: "ApplyTargetFingerprint",
      parameters: newdata.map(d => ({
        title: cli.parameters.title,
        body: cli.parameters.body,
        branch: "master",
        targetfingerprint: `${cli.parameters.type}::${cli.parameters.name}`,
        targets: {
          owner: d.split("::")[0],
          repo: d.split("::")[1],
          branch: "master",
        },
      })),
    }, cli.context);

    /**
     * Send out job id
     */
    await cli.addressChannels(slackSuccessMessage(
      `Started job id ${jobId.id}`,
      `Started a job to apply fp ${cli.parameters.name}::${cli.parameters.type} on ${newdata.length} repos!`,
    ));
    return {code: 0};
  },
};

/**
 * Retrieve repos that have the supplied fingerprint present
 * @param {CommandListenerInvocation} cli
 * @param {string} name Name of the fingeprint to search for
 * @param {string} type Type of the fingerprint to search for
 *
 * @return {string[]} Array of repos, owner::name
 */
export async function getMatchingRepos(
  cli: CommandListenerInvocation,
  name: string,
  type: string,
): Promise<string[]> {
  const data: Array<{owner: string, repo: string}> = [];
  let more = true;
  let paging;
  while (more) {
    const vars: any = {
      name,
      type,
    };

    if (paging !== undefined) {
      vars.paging = paging;
    }

    const initResult = await cli.context.graphClient
      .query<types.HeadFingerPrintCommits.Query, types.HeadFingerPrintCommits.Variables>({
        name: "headFingerPrintCommits",
        variables: vars,
      });
    initResult.commitsWithFingerprints.commits.map(c => data.push({owner: c.repo.owner, repo: c.repo.name}));

    if (initResult.commitsWithFingerprints._paging) {
      paging = initResult.commitsWithFingerprints._paging;
    } else {
      more = false;
    }
  }

  return data.map(r => `${r.owner}::${r.repo}`);
}
