import { ParametersDefinition, ProjectAction } from "@atomist/sdm";
import { SeedDrivenGeneratorParameters } from "@atomist/automation-client";
import {
  createJiraComponent,
  submitMappingPayload,
} from "@atomist/sdm-pack-jira/lib/support/commands/shared";

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

    data = {
      project: ctx.parameters.project,
      componentId: result.id,
    };
  } else {
    data = {
      project: ctx.parameters.project,
      componentId: ctx.parameters.componentName,
    };
  }
  await submitMappingPayload(ctx as any, {
    channel: ctx.parameters.target.repoRef.repo,
    ...data,
  });
};
