import { ParametersDefinition, ProjectAction } from "@atomist/sdm";
import { configurationValue, SeedDrivenGeneratorParameters } from "@atomist/automation-client";
import {
  createJiraComponent,
  submitMappingPayload,
} from "@atomist/sdm-pack-jira/lib/support/commands/shared";
import { JiraConfig } from "@atomist/sdm-pack-jira/lib/jira";
import { getJiraDetails } from "@atomist/sdm-pack-jira/lib/support/jiraDataLookup";
import { Project } from "@atomist/sdm-pack-jira/lib/support/jiraDefs";

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
  if (ctx.parameters.newComponent === "yes") {
    const result = await createJiraComponent({
      name: ctx.parameters.componentName,
      project: ctx.parameters.project,
      assigneeType: "PROJECT_DEFAULT",
      description: ctx.parameters.componentName,
    }, ctx);
    // Now lookup the projectId
    const jiraConfig = configurationValue<object>("sdm.jira") as JiraConfig;
    const projectDetail =
      await getJiraDetails<Project>(
        `${jiraConfig.url}/rest/api/2/project/${ctx.parameters.project}`, true, undefined, ctx);

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
};
