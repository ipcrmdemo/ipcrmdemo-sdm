///*
// * Copyright © 2018 Atomist, Inc.
// *
// * Licensed under the Apache License, Version 2.0 (the "License");
// * you may not use this file except in compliance with the License.
// * You may obtain a copy of the License at
// *
// *     http://www.apache.org/licenses/LICENSE-2.0
// *
// * Unless required by applicable law or agreed to in writing, software
// * distributed under the License is distributed on an "AS IS" BASIS,
// * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// * See the License for the specific language governing permissions and
// * limitations under the License.
// */
//
//import {GitHubRepoRef} from "@atomist/automation-client";
//import {
//  AutoCodeInspection,
//  Autofix, DoNotSetAnyGoalsAndLock,
//  goalContributors,
//  goals,
//  not,
//  onAnyPush, PreferenceScope,
//  PushImpact,
//  SoftwareDeliveryMachine,
//  SoftwareDeliveryMachineConfiguration,
//  ToDefaultBranch,
//  whenPushSatisfies,
//} from "@atomist/sdm";
//import {
//  createSoftwareDeliveryMachine,
//  DisableDeploy,
//  DisplayDeployEnablement,
//  EnableDeploy,
//  githubGoalStatusSupport,
//  goalStateSupport,
//} from "@atomist/sdm-core";
//import {
//  buildAwareCodeTransforms,
//} from "@atomist/sdm-pack-build";
//import {
//    CloudFoundrySupport,
//    HasCloudFoundryManifest,
//} from "@atomist/sdm-pack-cloudfoundry";
//import {
//  DockerFrom,
//  HasDockerfile,
//} from "@atomist/sdm-pack-docker";
//import {
//  fingerprintSupport,
//  NpmDeps,
//  NpmCoordinates,
//  DefaultTargetDiffHandler,
//} from "@atomist/sdm-pack-fingerprints";
//import {
//  k8sSupport,
//} from "@atomist/sdm-pack-k8s";
//import {
//  IsNode, NodeModulesProjectListener,
//  NodeProjectCreationParametersDefinition,
//  UpdatePackageJsonIdentification,
//  UpdateReadmeTitle,
//} from "@atomist/sdm-pack-node";
//import {
//  IsMaven,
//  springSupport,
//  SpringProjectCreationParameters,
//  SpringProjectCreationParameterDefinitions,
//  ReplaceReadmeTitle,
//  SetAtomistTeamInApplicationYml,
//} from "@atomist/sdm-pack-spring";
//import { changelogSupport } from "@atomist/sdm-pack-changelog";
//import { issueSupport } from "@atomist/sdm-pack-issue";
//import {
//  hasJenkinsfile,
//  npmHasBuildScript,
//  isFirstCommit, hasTsLintConfig, hasTsConfig,
//} from "../support/preChecks";
//import { AddDockerFile } from "../transform/addDockerfile";
//import { AddJenkinsfileRegistration } from "../transform/addJenkinsfile";
//import { AddLicenseFile } from "../transform/addLicense";
//import {
//    FixSmallMemory,
//    ReduceMemorySize,
//} from "../transform/smallMemory";
//import { UpdateDockerfileMaintainer } from "../transform/updateDockerFileMaintainer";
//import { SuggestAddingDockerfile } from "../support/suggestAddDockerfile";
//import { AddFinalNameToPom } from "../transform/addFinalName";
//import {
//  addImplementation,
//  cfDeployment,
//  cfDeploymentStaging,
//  dockerBuild,
//  dotNetBuild,
//  dotNetVersion,
//  ecsDeployProd,
//  ecsDeployStaging,
//  externalBuild,
//  k8sProductionDeploy,
//  k8sStagingDeploy,
//  nodeBuild,
//  nodeVersion,
//} from "./goals";
//import { addRandomCommand } from "../support/randomCommand";
//import { jiraSupport } from "@atomist/sdm-pack-jira";
//import { TsLintAutofix } from "../transform/tsLintAutofix";
//import { isDotNetCore, SimpleDotNetCoreWebApplication } from "../support/dotnet/support";
//import {
//  DotnetCoreProjectFileCodeTransform,
//} from "@atomist/sdm-pack-analysis-dotnet/lib/tranform/dotnetCoreTransforms";
//import { replaceSeedSlug, replaceSeedSlugNode } from "../transform/updateRepoSlug";
//import { IsEcsDeployable, IsK8sDeployable, ZeroCommitPushTest } from "../support/pushTests";
//import { SuggestEnableEcsDeploy } from "../support/suggestEnableEcsDeploy";
//import { enableEcsDeployRegistration } from "../transform/enableEcsDeploy";
//import { SuggestEnableK8sDeploy } from "../support/suggestEnableK8sDeploy";
//import { enableK8sDeployRegistration } from "../transform/enableK8sDeploy";
//import {
//  jiraCreateProjectBranchReg,
//  jiraFindAndAssignReg,
//} from "@atomist/sdm-pack-jira/lib/support/commands/findAndAssign";
//import { createBugIssueReg } from "@atomist/sdm-pack-jira/lib/support/commands/createBugIssue";
//import {
//  TransformMavenSpringBootSeedToCustomProject,
//} from "@atomist/sdm-pack-spring/lib/spring/generate/transformSeedToCustomProject";
//import * as _ from "lodash";
//
//export function machine(
//    configuration: SoftwareDeliveryMachineConfiguration,
//): SoftwareDeliveryMachine {
//
//    const sdm: SoftwareDeliveryMachine = createSoftwareDeliveryMachine(
//        { name: "Organization ipcrmdemo sdm", configuration },
//    );
//
//    addImplementation(sdm);
//
//    // Bot Commands
//    sdm.addCommand(EnableDeploy)
//        .addCommand(DisableDeploy)
//        .addCommand(DisplayDeployEnablement)
//        .addCommand(jiraFindAndAssignReg)
//        .addCommand(jiraCreateProjectBranchReg)
//        .addCommand(createBugIssueReg)
//        .addCodeTransformCommand(AddDockerFile)
//        .addCodeTransformCommand(AddJenkinsfileRegistration)
//        .addCodeTransformCommand(UpdateDockerfileMaintainer)
//        .addCodeTransformCommand(enableEcsDeployRegistration)
//        .addCodeTransformCommand(enableK8sDeployRegistration)
//        .addCodeTransformCommand(FixSmallMemory);
//
//    // Channel Link Listeners
//    sdm.addChannelLinkListener(SuggestAddingDockerfile);
//    sdm.addChannelLinkListener(SuggestEnableEcsDeploy);
//    sdm.addChannelLinkListener(SuggestEnableK8sDeploy);
//    // sdm.addEvent(onJiraIssueEventApproval(JiraApproval));
//
//    /**
//     * Generic Goals
//     */
//    const pushImpact = new PushImpact();
//    const codeInspection = new AutoCodeInspection();
//
//    // Autofix
//    const autofix = new Autofix()
//        .with(ReduceMemorySize)
//        .with(AddLicenseFile);
//
//    const tsLint = TsLintAutofix
//      .withProjectListener(NodeModulesProjectListener);
//
//    /**
//     * Ext Pack setup
//     */
//    sdm.addExtensionPacks(
//        jiraSupport(),
//        springSupport({
//            review: {
//                springStyle: true,
//                cloudNative: true,
//            },
//            autofix: {
//                springStyle: true,
//            },
//            inspectGoal: codeInspection,
//            autofixGoal: autofix,
//            reviewListeners: [],
//        }),
//        buildAwareCodeTransforms({
//          buildGoal: nodeBuild,
//          issueCreation: {},
//        }),
//        k8sSupport({
//          addCommands: true,
//        }),
//        CloudFoundrySupport({
//            pushImpactGoal: pushImpact,
//        }),
//        githubGoalStatusSupport(),
//        goalStateSupport(),
//        changelogSupport(),
//        issueSupport(),
//        fingerprintSupport({
//          pushImpactGoal: pushImpact,
//          features: [
//            _.merge(NpmDeps,        NpmDeps.workflows = [DefaultTargetDiffHandler]),
//            _.merge(NpmCoordinates, NpmCoordinates.workflows = [DefaultTargetDiffHandler]),
//            _.merge(DockerFrom,     DockerFrom.workflows = [DefaultTargetDiffHandler]),
//          ],
//        }),
//    );
//
//    /**
//     * Generators
//     */
//    sdm.addGeneratorCommand<SpringProjectCreationParameters>({
//            name: "create-spring",
//            intent: "create spring",
//            description: "Create a new Java Spring Boot REST service",
//            parameters: SpringProjectCreationParameterDefinitions,
//            startingPoint: GitHubRepoRef.from({ owner: "atomist-seeds", repo: "spring-rest", branch: "master" }),
//            transform: [
//                ReplaceReadmeTitle,
//                SetAtomistTeamInApplicationYml,
//                ...TransformMavenSpringBootSeedToCustomProject,
//                AddFinalNameToPom,
//                replaceSeedSlug,
//                async (p, pi) => {
//                  const channel = pi.context.source.slack.channel.id;
//                  const team = pi.context.source.slack.team.id;
//                  await pi.preferences.put(
//                    `generator/${p.id.owner}/${p.id.repo}/channel`,
//                    { channel, team },
//                    { scope: PreferenceScope.Sdm });
//                },
//            ],
//        });
//
//    sdm.addGeneratorCommand<SpringProjectCreationParameters>({
//            name: "create-spring-external-build",
//            intent: "create spring jenkins build",
//            description: "Create a new Java Spring Boot REST service that builds with Jenkins",
//            parameters: SpringProjectCreationParameterDefinitions,
//            startingPoint: GitHubRepoRef.from({ owner: "ipcrmdemo", repo: "spring-rest-jenkins", branch: "master" }),
//            transform: [
//                ReplaceReadmeTitle,
//                SetAtomistTeamInApplicationYml,
//                ...TransformMavenSpringBootSeedToCustomProject,
//                AddFinalNameToPom,
//                replaceSeedSlug,
//            ],
//        });
//
//    sdm.addGeneratorCommand({
//            name: "typescript-express-generator",
//            parameters: NodeProjectCreationParametersDefinition,
//            startingPoint: new GitHubRepoRef("atomist-seeds", "typescript-express-node"),
//            intent: "create node",
//            transform: [
//                UpdatePackageJsonIdentification,
//                UpdateReadmeTitle,
//                replaceSeedSlugNode,
//            ],
//        });
//
//    sdm.addGeneratorCommand({
//      name: "dotnet-example-generator",
//      startingPoint: new GitHubRepoRef("atomist-seeds", "dotnet-core-service"),
//      intent: "create dotnetcore",
//      transform: [
//        SimpleDotNetCoreWebApplication,
//        DotnetCoreProjectFileCodeTransform,
//        replaceSeedSlug,
//      ],
//    });
//
//    /**
//     * Goals Definition
//     */
//    const GlobalGoals = goals("global")
//        .plan(autofix).after(tsLint)
//        .plan(codeInspection, pushImpact).after(autofix);
//
//    // Compliance Goals
//    const ComplianceGoals = goals("compliance-goals");
//        // .plan(fingerprintComplianceGoal).after(GlobalGoals);
//        // .plan(fingerprintComplianceGoal, SonarScanGoal).after(GlobalGoals);
//
//    // Maven
//    const MavenBaseGoals = goals("maven-base")
//      .plan(mavenVersion)
//      .plan(mavenBuild).after(mavenVersion, ComplianceGoals, GlobalGoals);
//
//    // Node
//    const NodeBaseGoals = goals("node-base")
//      .plan(nodeVersion)
//      .plan(nodeVersion, nodeBuild).after(ComplianceGoals, GlobalGoals);
//
//    // DotNet
//    const DotNetBasegoals = goals("dotnet-base")
//      .plan(dotNetVersion)
//      .plan(dotNetBuild).after(dotNetVersion, ComplianceGoals, GlobalGoals);
//
//    // K8s
//    const k8sDeployGoals = goals("deploy")
//      // .plan(JiraApproval)
//      .plan(k8sStagingDeploy).after(dockerBuild)
//      .plan(k8sProductionDeploy).after(k8sStagingDeploy);
//
//    // CF Deployment
//    const pcfDeploymentGoals = goals("cfdeploy")
//      .plan(cfDeploymentStaging).after(mavenBuild, nodeBuild)
//      .plan(cfDeployment).after(cfDeploymentStaging);
//
//    // ECS
//    const ecsDeployGoals = goals("ecsDeploy")
//      .plan(ecsDeployStaging).after(dockerBuild)
//      .plan(ecsDeployProd).after(ecsDeployStaging);
//
//    // Docker Build goals
//    const dockerBuildGoals = goals("docker-build")
//      .plan(dockerBuild).after(
//        mavenBuild,
//        nodeBuild,
//        externalBuild,
//        dotNetBuild,
//      );
//
//    /**
//     * Configure Push rules
//     */
//
//    sdm.addGoalContributions(goalContributors(
//        whenPushSatisfies(ZeroCommitPushTest).setGoals(DoNotSetAnyGoalsAndLock),
//
//        whenPushSatisfies(IsNode, hasTsLintConfig, hasTsConfig)
//          .setGoals(goals("node-autofix").plan(tsLint)),
//
//        onAnyPush()
//            .setGoals(GlobalGoals),
//
//        whenPushSatisfies(not(isFirstCommit), ToDefaultBranch)
//            .setGoals(ComplianceGoals),
//
//        whenPushSatisfies(IsMaven, not(hasJenkinsfile))
//            .setGoals(MavenBaseGoals),
//
//        whenPushSatisfies(IsNode, npmHasBuildScript, not(hasJenkinsfile))
//            .setGoals(NodeBaseGoals),
//
//        whenPushSatisfies(isDotNetCore, not(hasJenkinsfile))
//            .setGoals(DotNetBasegoals),
//
//        whenPushSatisfies(IsMaven, hasJenkinsfile)
//            .setGoals(goals("maven-external").plan(mavenVersion, externalBuild).after(GlobalGoals)),
//
//        whenPushSatisfies(HasDockerfile)
//          .setGoals(dockerBuildGoals),
//
//        whenPushSatisfies(HasCloudFoundryManifest, ToDefaultBranch)
//            .setGoals(pcfDeploymentGoals),
//
//        whenPushSatisfies(HasDockerfile, ToDefaultBranch, IsK8sDeployable)
//            .setGoals(k8sDeployGoals),
//
//        whenPushSatisfies(HasDockerfile, ToDefaultBranch, IsEcsDeployable)
//            .setGoals(ecsDeployGoals)));
//
//    addRandomCommand(sdm);
//    return sdm;
//}
