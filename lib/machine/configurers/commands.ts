import { DisableDeploy, DisplayDeployEnablement, EnableDeploy, GoalConfigurer } from "@atomist/sdm-core";
import { MyGoals } from "../goals";
import {
  ReplaceReadmeTitle, SetAtomistTeamInApplicationYml,
  SpringProjectCreationParameterDefinitions,
  SpringProjectCreationParameters, TransformMavenSpringBootSeedToCustomProject,
} from "@atomist/sdm-pack-spring";
import { replaceSeedSlug, replaceSeedSlugNode } from "../../transform/updateRepoSlug";
import {
  configurationValue,
  GitCommandGitProject,
  GitHubRepoRef,
  SeedDrivenGeneratorParameters,
  Success
} from "@atomist/automation-client";
import { createJob, PreferenceScope, slackErrorMessage, slackSuccessMessage } from "@atomist/sdm";
import {
  DotnetCoreProjectFileCodeTransform,
} from "@atomist/sdm-pack-analysis-dotnet/lib/tranform/dotnetCoreTransforms";
import { SimpleDotNetCoreWebApplication } from "../../support/dotnet/support";
import {
  NodeProjectCreationParameters,
  NodeProjectCreationParametersDefinition,
  UpdatePackageJsonIdentification,
  UpdateReadmeTitle
} from "@atomist/sdm-pack-node";
import { AddFinalNameToPom } from "../../transform/addFinalName";
import { AddDockerFile } from "../../transform/addDockerfile";
import {
  jiraCreateProjectBranchReg,
  jiraFindAndAssignReg,
} from "@atomist/sdm-pack-jira/lib/support/commands/findAndAssign";
import { UpdateDockerfileMaintainer } from "../../transform/updateDockerFileMaintainer";
import { enableK8sDeployRegistration } from "../../transform/enableK8sDeploy";
import { createBugIssueReg } from "@atomist/sdm-pack-jira/lib/support/commands/createBugIssue";
import { AddJenkinsfileRegistration } from "../../transform/addJenkinsfile";
import { enableEcsDeployRegistration } from "../../transform/enableEcsDeploy";
import { FixSmallMemory } from "../../transform/smallMemory";
import { channelMappingProjectAction } from "../../support/creation/createAndMapChannel";
import {
  setupJiraForNewProject,
  SetupJiraForNewProject,
  SetupJiraForNewProjectParams
} from "../../support/creation/setupJiraForNewProject";
import { prepComponentSelect, prepProjectSelect } from "@atomist/sdm-pack-jira/lib/support/commands/shared";
import { getJiraDetails } from "@atomist/sdm-pack-jira/lib/support/jiraDataLookup";
import { Project } from "@atomist/sdm-pack-jira/lib/support/jiraDefs";
import { JiraConfig } from "@atomist/sdm-pack-jira/lib/jira";
import { addSonarProp } from "../../transform/sonarProps";

export const CommandsConfigurator: GoalConfigurer<MyGoals> = async (sdm, goals) => {
  /**
   * Bot Commands
   */
  sdm.addCommand(EnableDeploy)
    .addCommand(DisableDeploy)
    .addCommand(DisplayDeployEnablement)
    .addCommand(jiraFindAndAssignReg)
    .addCommand(jiraCreateProjectBranchReg)
    .addCommand(createBugIssueReg)
    .addCodeTransformCommand(AddDockerFile)
    .addCodeTransformCommand(AddJenkinsfileRegistration)
    .addCodeTransformCommand(UpdateDockerfileMaintainer)
    .addCodeTransformCommand(enableEcsDeployRegistration)
    .addCodeTransformCommand(enableK8sDeployRegistration)
    .addCodeTransformCommand(FixSmallMemory);

  /**
   * Generators
   */
  sdm.addGeneratorCommand<SpringProjectCreationParameters>({
    name: "create-spring",
    intent: "create spring",
    description: "Create a new Java Spring Boot REST service",
    parameters: SpringProjectCreationParameterDefinitions,
    startingPoint: GitHubRepoRef.from({ owner: "atomist-seeds", repo: "spring-rest", branch: "master" }),
    transform: [
      ReplaceReadmeTitle,
      SetAtomistTeamInApplicationYml,
      ...TransformMavenSpringBootSeedToCustomProject,
      AddFinalNameToPom,
      replaceSeedSlug,
      async (p, pi) => {
        const channel = pi.context.source.slack.channel.id;
        const team = pi.context.source.slack.team.id;
        await pi.preferences.put(
          `generator/${p.id.owner}/${p.id.repo}/channel`,
          { channel, team },
          { scope: PreferenceScope.Sdm });
      },
    ],
    afterAction: [channelMappingProjectAction],
  });

  sdm.addGeneratorCommand<SpringProjectCreationParameters>({
    name: "create-spring-external-build",
    intent: "create spring jenkins build",
    description: "Create a new Java Spring Boot REST service that builds with Jenkins",
    parameters: SpringProjectCreationParameterDefinitions,
    startingPoint: GitHubRepoRef.from({ owner: "ipcrmdemo", repo: "spring-rest-jenkins", branch: "master" }),
    transform: [
      ReplaceReadmeTitle,
      SetAtomistTeamInApplicationYml,
      ...TransformMavenSpringBootSeedToCustomProject,
      AddFinalNameToPom,
      replaceSeedSlug,
    ],
    afterAction: [channelMappingProjectAction],
  });

  sdm.addGeneratorCommand<SetupJiraForNewProject & NodeProjectCreationParameters>({
    name: "typescript-express-generator",
    parameters: { ...NodeProjectCreationParametersDefinition, ...SetupJiraForNewProjectParams},
    autoSubmit: true,
    startingPoint: async pi => {
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
        pi.parameters.componentName = pi.parameters.appName;
      }

      (pi.parameters as any).source = {
        repoRef: {
          owner: "atomist-seeds",
          repo: "typescript-express-node",
        },
      };

      return GitCommandGitProject.cloned(
        pi.credentials,
        GitHubRepoRef.from({
          ...(pi.parameters as any).source.repoRef,
          branch: "master",
        }),
        { depth: 1 });
    },
    intent: "create node",
    transform: [
      UpdatePackageJsonIdentification,
      UpdateReadmeTitle,
      replaceSeedSlugNode,
      addSonarProp,
    ],
    afterAction: [channelMappingProjectAction, setupJiraForNewProject],
  });

  sdm.addGeneratorCommand({
    name: "dotnet-example-generator",
    startingPoint: new GitHubRepoRef("atomist-seeds", "dotnet-core-service"),
    intent: "create dotnetcore",
    transform: [
      SimpleDotNetCoreWebApplication,
      DotnetCoreProjectFileCodeTransform,
      replaceSeedSlug,
      addSonarProp,
    ],
    afterAction: [channelMappingProjectAction],
  });

  sdm.addCommand({
    name: "exampleRunMeAsAJob",
    listener: async ctx => {
      await ctx.addressChannels(slackSuccessMessage(
        "Yes!",
        "Listener has run...",
      ));
      return Success;
    },
  });

  sdm.addCommand({
    name: "runJobExample",
    intent: "run example job",
    listener: async ctx => {
      await createJob( {
        command: "exampleRunMeAsAJob",
        concurrentTasks: 2,
        parameters: [{}, {}, {}],
        description: "Example running command as job",
      }, ctx.context);
    },
  });
};
