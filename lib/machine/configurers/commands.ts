import { DisableDeploy, DisplayDeployEnablement, EnableDeploy, GoalConfigurer } from "@atomist/sdm-core";
import { MyGoals } from "../goals";
import {
  ReplaceReadmeTitle, SetAtomistTeamInApplicationYml,
  SpringProjectCreationParameterDefinitions,
  SpringProjectCreationParameters, TransformMavenSpringBootSeedToCustomProject,
} from "@atomist/sdm-pack-spring";
import { replaceSeedSlug, replaceSeedSlugNode } from "../../transform/updateRepoSlug";
import {
  addressEvent,
  GitHubRepoRef,
  Success
} from "@atomist/automation-client";
import { createJob, PreferenceScope, slackSuccessMessage } from "@atomist/sdm";
import {
  DotnetCoreProjectFileCodeTransform,
} from "@atomist/sdm-pack-analysis-dotnet/lib/tranform/dotnetCoreTransforms";
import { SimpleDotNetCoreWebApplication } from "../../support/dotnet/support";
import {
  NodeProjectCreationParameters,
  NodeProjectCreationParametersDefinition,
  UpdatePackageJsonIdentification,
  UpdateReadmeTitle,
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
  SetupJiraForNewProjectParams,
} from "../../support/creation/setupJiraForNewProject";
import { addSonarProp } from "../../transform/sonarProps";
import { prepJira } from "../../support/creation/prepJiraSetup";
import { filteredAspectApply } from "../../support/aspects/filteredAspectApply";
import { aspects } from "./extpacks";

export const CommandsConfigurator: GoalConfigurer<MyGoals> = async sdm => {
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
  sdm.addGeneratorCommand<SetupJiraForNewProject & SpringProjectCreationParameters>({
    name: "create-spring",
    intent: "create spring",
    description: "Create a new Java Spring Boot REST service",
    parameters: { ...SpringProjectCreationParameterDefinitions, ...SetupJiraForNewProjectParams },
    // startingPoint: GitHubRepoRef.from({ owner: "atomist-seeds", repo: "spring-rest", branch: "master" }),
    startingPoint: prepJira("atomist-seeds", "spring-rest"),
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
    afterAction: [channelMappingProjectAction, setupJiraForNewProject],
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
    startingPoint: prepJira("atomist-seeds", "typescript-express-node"),
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
        await ctx.addressChannels(
          slackSuccessMessage(
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

  sdm.addCommand(filteredAspectApply);
};
