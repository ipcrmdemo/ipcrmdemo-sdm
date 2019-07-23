import { DisableDeploy, DisplayDeployEnablement, EnableDeploy, GoalConfigurer } from "@atomist/sdm-core";
import { MyGoals } from "../goals";
import {
  ReplaceReadmeTitle, SetAtomistTeamInApplicationYml,
  SpringProjectCreationParameterDefinitions,
  SpringProjectCreationParameters, TransformMavenSpringBootSeedToCustomProject,
} from "@atomist/sdm-pack-spring";
import { replaceSeedSlug, replaceSeedSlugNode } from "../../transform/updateRepoSlug";
import { GitHubRepoRef } from "@atomist/automation-client";
import { PreferenceScope } from "@atomist/sdm";
import {
  DotnetCoreProjectFileCodeTransform,
} from "@atomist/sdm-pack-analysis-dotnet/lib/tranform/dotnetCoreTransforms";
import { SimpleDotNetCoreWebApplication } from "../../support/dotnet/support";
import {
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
  });

  sdm.addGeneratorCommand({
    name: "typescript-express-generator",
    parameters: NodeProjectCreationParametersDefinition,
    startingPoint: new GitHubRepoRef("atomist-seeds", "typescript-express-node"),
    intent: "create node",
    transform: [
      UpdatePackageJsonIdentification,
      UpdateReadmeTitle,
      replaceSeedSlugNode,
    ],
  });

  sdm.addGeneratorCommand({
    name: "dotnet-example-generator",
    startingPoint: new GitHubRepoRef("atomist-seeds", "dotnet-core-service"),
    intent: "create dotnetcore",
    transform: [
      SimpleDotNetCoreWebApplication,
      DotnetCoreProjectFileCodeTransform,
      replaceSeedSlug,
    ],
  });
};
