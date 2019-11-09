import { prepComponentSelect, prepProjectSelect } from "@atomist/sdm-pack-jira/lib/support/commands/shared";
import {
  configurationValue,
  GitCommandGitProject,
  GitHubRepoRef,
} from "@atomist/automation-client";
import { JiraConfig } from "@atomist/sdm-pack-jira/lib/jira";
import { getJiraDetails } from "@atomist/sdm-pack-jira/lib/support/jiraDataLookup";
import { Project } from "@atomist/sdm-pack-jira/lib/support/jiraDefs";
import { slackErrorMessage, StartingPoint } from "@atomist/sdm";
import { SetupJiraForNewProject } from "./setupJiraForNewProject";

export function prepJira(owner: string, repo: string): StartingPoint<SetupJiraForNewProject> {
  return async pi => {
    // Present list of projects
    const projectValues = await prepProjectSelect(pi.parameters.projectSearch, pi);
    if (projectValues) {
      const project = await pi.promptFor<{ project: string }>({
        project: {
          displayName: `Please select a project`,
          description: `Please select a project`,
          type: {
            kind: "single",
            options: projectValues,
          },
        },
      });

      const jiraConfig = configurationValue<object>("sdm.jira") as JiraConfig;
      const projectDetail =
        await getJiraDetails<Project>(`${jiraConfig.url}/rest/api/2/project/${project.project}`, true, undefined, pi);
      pi.parameters.project = projectDetail.key;
    } else {
      await pi.addressChannels(slackErrorMessage(
        `Error: No projects found with search term [${pi.parameters.projectSearch}]`,
        `Please try this command again`,
        pi.context,
      ));
      throw new Error(`Invalid Project Search; please update search term and try again`);
    }

    // Present list of components
    if (pi.parameters.newComponent === "no") {
      const componentValues = await prepComponentSelect(pi.parameters.project, pi);
      if (componentValues) {
        const component = await pi.promptFor<{ component: string }>({
          component: {
            description: `Please select a component`,
            displayName: `Please select a component`,
            type: {
              kind: "single",
              options: componentValues,
            },
          },
        });
        pi.parameters.componentName = component.component;
      } else {
        await pi.addressChannels(slackErrorMessage(
          `Error: No components found within project [${pi.parameters.project}]`,
          `Please try this command again with a different project`,
          pi.context,
        ));
        throw new Error(`No components found in supplied project, ${pi.parameters.project}, please try again`);
      }
    } else {
      pi.parameters.componentName = (pi.parameters as any).target.repo;
    }

    (pi.parameters as any).source = {
      repoRef: {
        owner,
        repo,
      },
    };

    return GitCommandGitProject.cloned(
      pi.credentials,
      GitHubRepoRef.from({
        ...(pi.parameters as any).source.repoRef,
        branch: "master",
      }),
      { depth: 1 });
  };
}
