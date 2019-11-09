import { ParametersDefinition, ProjectAction, slackSuccessMessage } from "@atomist/sdm";
import { configurationValue, SeedDrivenGeneratorParameters } from "@atomist/automation-client";
import {
  buildJiraHashKey,
  createJiraComponent,
  submitMappingPayload
} from "@atomist/sdm-pack-jira/lib/support/commands/shared";
import { JiraConfig } from "@atomist/sdm-pack-jira/lib/jira";
import { getJiraDetails } from "@atomist/sdm-pack-jira/lib/support/jiraDataLookup";
import { Project } from "@atomist/sdm-pack-jira/lib/support/jiraDefs";
import { purgeCacheEntry } from "@atomist/sdm-pack-jira/lib/support/cache/manage";

export interface SetupJiraForNewProject {
  newComponent: string;
  componentName: string;
  project: string;
  projectSearch: string;
}

export const SetupJiraForNewProjectParams: ParametersDefinition<SetupJiraForNewProject> = {
  componentName: {
    description: "Supply JIRA Component Name",
    displayable: false,
    required: false,
  },
  project: {
    description: "Please select a JIRA Project Name",
    displayable: false,
    required: false,
  },
  newComponent: {
    description: "Is this a new JIRA component?",
    pattern: /yes|no/,
    order: 998,
  },
  projectSearch: {
    description: "Please supply a JIRA project name to search for",
    order: 999,
  },
};

export const setupJiraForNewProject:
  ProjectAction<SeedDrivenGeneratorParameters & SetupJiraForNewProject> = async (p, ctx) => {
  let data;
  const jiraConfig = configurationValue<object>("sdm.jira") as JiraConfig;
  if (ctx.parameters.newComponent === "yes") {
    const result = await createJiraComponent({
      name: ctx.parameters.componentName,
      project: ctx.parameters.project,
      assigneeType: "PROJECT_DEFAULT",
      description: ctx.parameters.componentName,
    }, ctx);
    await ctx.addressChannels(slackSuccessMessage(
      `Created new JIRA Component`,
      `New component created for ${ctx.parameters.componentName}.}`,
    ));
    // Now lookup the projectId
    const jiraUrl =  `${jiraConfig.url}/rest/api/2/project/${ctx.parameters.project}`;
    const projectDetail =
      await getJiraDetails<Project>(jiraUrl, true, undefined, ctx);
    await purgeCacheEntry(`${jiraConfig.url}/rest/api/2/project/${projectDetail.id}`);

    data = {
      projectId: projectDetail.id,
      componentId: result.id,
    };
  } else {
    data = {
      projectId: ctx.parameters.project,
      componentId: ctx.parameters.componentName,
    };
  }
  await submitMappingPayload(ctx as any, {
    channel: ctx.parameters.target.repoRef.repo,
    ...data,
  });
  await ctx.addressChannels(slackSuccessMessage(
    `Linked JIRA Component`,
    `Component linked to channel.`,
  ));
};
