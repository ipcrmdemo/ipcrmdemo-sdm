/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { editModes, GitHubRepoRef, logger } from "@atomist/automation-client";
import {
  AutoCodeInspection,
  Autofix,
  DoNotSetAnyGoalsAndLock, execPromise,
  Fingerprint,
  goalContributors,
  goals,
  not,
  onAnyPush,
  PreferenceScope,
  PushImpact,
  SdmGoalState,
  SoftwareDeliveryMachine,
  SoftwareDeliveryMachineConfiguration,
  ToDefaultBranch,
  whenPushSatisfies
} from "@atomist/sdm";
import {
  createSoftwareDeliveryMachine,
  DisableDeploy,
  DisplayDeployEnablement,
  EnableDeploy,
  githubGoalStatusSupport,
  goalStateSupport
} from "@atomist/sdm-core";
import { buildAwareCodeTransforms } from "@atomist/sdm-pack-build";
import { CloudFoundrySupport, HasCloudFoundryManifest } from "@atomist/sdm-pack-cloudfoundry";
import { HasDockerfile } from "@atomist/sdm-pack-docker";
import {
  applyFingerprint,
  checkNpmCoordinatesImpactHandler,
  depsFingerprints,
  fingerprintImpactHandler,
  fingerprintSupport,
  messageMaker,
  renderClojureProjectDiff
} from "@atomist/sdm-pack-fingerprints";
import {
  applyNpmDepsFingerprint,
  createNpmDepsFingerprints,
  diffNpmDepsFingerprints
} from "@atomist/sdm-pack-fingerprints/lib/fingerprints/npmDeps";
import { k8sSupport, KubernetesApplication } from "@atomist/sdm-pack-k8s";
import {
  IsNode,
  NodeModulesProjectListener,
  NodeProjectCreationParametersDefinition,
  UpdatePackageJsonIdentification,
  UpdateReadmeTitle
} from "@atomist/sdm-pack-node";
import {
  IsMaven,
  ReplaceReadmeTitle,
  SetAtomistTeamInApplicationYml,
  SpringProjectCreationParameterDefinitions,
  SpringProjectCreationParameters,
  springSupport,
  TransformMavenSpringBootSeedToCustomProject
} from "@atomist/sdm-pack-spring";
import { changelogSupport } from "@atomist/sdm-pack-changelog";
import { issueSupport } from "@atomist/sdm-pack-issue";
import { hasJenkinsfile, hasTsConfig, hasTsLintConfig, isFirstCommit, npmHasBuildScript } from "../support/preChecks";
import { AddDockerFile } from "../transform/addDockerfile";
import { AddJenkinsfileRegistration } from "../transform/addJenkinsfile";
import { AddLicenseFile } from "../transform/addLicense";
import { FixSmallMemory, ReduceMemorySize } from "../transform/smallMemory";
import { UpdateDockerfileMaintainer } from "../transform/updateDockerFileMaintainer";
import { SuggestAddingDockerfile } from "../support/suggestAddDockerfile";
import { AutoMergeMethod, AutoMergeMode } from "@atomist/automation-client/lib/operations/edit/editModes";
import { AddFinalNameToPom } from "../transform/addFinalName";
import {
  addImplementation,
  cfDeployment,
  cfDeploymentStaging,
  dockerBuild,
  dotNetBuild,
  dotNetVersion,
  ecsDeployProd,
  ecsDeployStaging,
  externalBuild,
  k8sBlueProd, k8sGreenProd,
  k8sStagingDeploy, k8sTrafficUpdate,
  mavenBuild,
  mavenVersion,
  nodeBuild,
  nodeVersion
} from "./goals";
import { addRandomCommand } from "../support/randomCommand";
import { applyFileFingerprint, createFileFingerprint } from "@atomist/sdm-pack-fingerprints/lib/fingerprints/jsonFiles";
import { jiraSupport } from "@ipcrmdemo/sdm-pack-jira";
import { TsLintAutofix } from "../transform/tsLintAutofix";
import { isDotNetCore, SimpleDotNetCoreWebApplication } from "../support/dotnet/support";
import {
  DotnetCoreProjectFileCodeTransform,
} from "@atomist/sdm-pack-analysis-dotnet/lib/tranform/dotnetCoreTransforms";
import { replaceSeedSlug } from "../transform/updateRepoSlug";
import {
  isBlueDeploy,
  IsEcsDeployable,
  isGreenDeploy,
  IsK8sDeployable,
  ZeroCommitPushTest
} from "../support/pushTests";
import { SuggestEnableEcsDeploy } from "../support/suggestEnableEcsDeploy";
import { enableEcsDeployRegistration } from "../transform/enableEcsDeploy";
import { SuggestEnableK8sDeploy } from "../support/suggestEnableK8sDeploy";
import { enableK8sDeployRegistration } from "../transform/enableK8sDeploy";
import {
  jiraCreateProjectBranchReg,
  jiraFindAndAssignReg
} from "@ipcrmdemo/sdm-pack-jira/lib/support/commands/findAndAssign";
import { createBugIssueReg } from "@ipcrmdemo/sdm-pack-jira/lib/support/commands/createBugIssue";
import { deleteApplication } from "@atomist/sdm-pack-k8s/lib/kubernetes/application";
import * as _ from "lodash";
import { Deferred } from "@atomist/automation-client/lib/internal/util/Deferred";
// import { JiraApproval } from "@ipcrmdemo/sdm-pack-jira/lib/goals/JiraApproval";
// import { onJiraIssueEventApproval } from "@ipcrmdemo/sdm-pack-jira/lib/event/onJiraIssueEventApproval";

export function machine(
    configuration: SoftwareDeliveryMachineConfiguration,
): SoftwareDeliveryMachine {

    const sdm: SoftwareDeliveryMachine = createSoftwareDeliveryMachine(
        { name: "Organization ipcrmdemo sdm", configuration },
    );

    addImplementation(sdm);

    // Bot Commands
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

    // Channel Link Listeners
    sdm.addChannelLinkListener(SuggestAddingDockerfile);
    sdm.addChannelLinkListener(SuggestEnableEcsDeploy);
    sdm.addChannelLinkListener(SuggestEnableK8sDeploy);
    // sdm.addEvent(onJiraIssueEventApproval(JiraApproval));

    /**
     * Generic Goals
     */
    const fingerprint = new Fingerprint();
    const pushImpact = new PushImpact();
    const codeInspection = new AutoCodeInspection();

    // Autofix
    const autofix = new Autofix()
        .with(ReduceMemorySize)
        .with(AddLicenseFile);

    const tsLint = TsLintAutofix
      .withProjectListener(NodeModulesProjectListener);

    /**
     * Ext Pack setup
     */
    sdm.addExtensionPacks(
        jiraSupport(),
        springSupport({
            review: {
                springStyle: true,
                cloudNative: true,
            },
            autofix: {
                springStyle: true,
            },
            inspectGoal: codeInspection,
            autofixGoal: autofix,
            reviewListeners: [],
        }),
        buildAwareCodeTransforms({
          buildGoal: nodeBuild,
          issueCreation: {},
        }),
        k8sSupport({
          addCommands: true,
        }),
        CloudFoundrySupport({
            pushImpactGoal: pushImpact,
        }),
        githubGoalStatusSupport(),
        goalStateSupport(),
        changelogSupport(),
        issueSupport(),
        fingerprintSupport({
          fingerprintGoal: fingerprint,
          fingerprints:
            [
              {
                extract: createNpmDepsFingerprints,
                apply: applyNpmDepsFingerprint,
                selector: fp => fp.name.startsWith("npm-project-dep"),
                summary: diffNpmDepsFingerprints,
              },
              {
                extract: p => depsFingerprints(p.baseDir),
                apply: (p, fp) => applyFingerprint(p.baseDir, fp),
                selector: fp => {
                  return fp.name.startsWith("maven-project") || fp.name.startsWith("clojure-project");
                },
                summary: renderClojureProjectDiff,
              },
              {
                extract: createFileFingerprint(
                  "tslint.json",
                  "tsconfig.json"),
                apply: applyFileFingerprint,
                selector: fp => fp.name.startsWith("file-"),
              },
            ],
          handlers: [
            checkNpmCoordinatesImpactHandler(),
            fingerprintImpactHandler(
              {
                transformPresentation: ci => {
                  return new editModes.PullRequest(
                    `apply-target-fingerprint-${Date.now()}`,
                    ci.parameters.title,
                    `> generated by Atomist \`\`\`${ci.parameters.body}\`\`\``,
                    undefined,
                    "master",
                    {
                      method: AutoMergeMethod.Squash,
                      mode: AutoMergeMode.ApprovedReview,
                    });
                },
                messageMaker,
              },
            ),
          ],
        }),
    );

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
            startingPoint: new GitHubRepoRef("ipcrmdemo", "typescript-node-api"),
            intent: "create node",
            transform: [
                UpdatePackageJsonIdentification,
                UpdateReadmeTitle,
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

    /**
     * Goals Definition
     */
    const GlobalGoals = goals("global")
        .plan(autofix, fingerprint).after(tsLint)
        .plan(codeInspection, pushImpact).after(autofix);

    // Compliance Goals
    const ComplianceGoals = goals("compliance-goals");
        // .plan(fingerprintComplianceGoal).after(GlobalGoals);
        // .plan(fingerprintComplianceGoal, SonarScanGoal).after(GlobalGoals);

    // Maven
    const MavenBaseGoals = goals("maven-base")
      .plan(mavenVersion)
      .plan(mavenBuild).after(mavenVersion, ComplianceGoals, GlobalGoals);

    // Node
    const NodeBaseGoals = goals("node-base")
      .plan(nodeVersion)
      .plan(nodeVersion, nodeBuild).after(ComplianceGoals, GlobalGoals);

    // DotNet
    const DotNetBasegoals = goals("dotnet-base")
      .plan(dotNetVersion)
      .plan(dotNetBuild).after(dotNetVersion, ComplianceGoals, GlobalGoals);

    sdm.addGoalCompletionListener(async l => {
      if (l.completedGoal.uniqueName.includes("k8sDeployToProd") && l.completedGoal.state === SdmGoalState.success) {
        const deployInfo = _.get(
          JSON.parse(l.completedGoal.data as any), "@atomist/sdm-pack-k8s") as KubernetesApplication;
        // Wait for convergence
        // Starting polling
        const result = new Deferred<string>();
        const times = 20;
        let counter = 0;
        const timer = setInterval(async () => {
            if (counter >= times) {
              clearInterval(timer);
            }

            logger.debug(`------> Testing if ${deployInfo.name} has converged`);
            const output = await execPromise(
              "kubectl",
              ["get", "deployment", "-n", "production", deployInfo.name, "-o", "json"],
            );

            // @ts-ignore
            const parsed = JSON.parse(output.stdout);
            if (!parsed.status.hasOwnProperty("unavailableReplicas")) {
              logger.debug(`------> ${deployInfo.name} has converged, proceeding with canary cleanup`);
              result.resolve(true);
            } else {
              logger.debug(`------> ${deployInfo.name} has not yet converged, sleeping`);
            }

            counter++;
        }, 3000);

        // Wait for polling to finish
        // @ts-ignore
        const status = await result.promise;
        clearInterval(timer);

        if (status) {
          deployInfo.name = deployInfo.name + "canary";
          logger.debug(`------> Removing old K8s canary ${deployInfo.name}!`);
          await deleteApplication(deployInfo);
          logger.debug(`------> Succeeded removing old K8s canary ${deployInfo.name}!`);
        } else {
          logger.debug(`------> Deployment ${deployInfo.name} failed to start all replicas!`);
        }

      }
    });

    // K8s
    const k8sDeployGoals = goals("deploy")
      // .plan(JiraApproval)
      .plan(k8sStagingDeploy).after(dockerBuild);

    const k8sBlueGoal = goals("deploy-blue")
      .plan(k8sBlueProd).after(k8sStagingDeploy)
      .plan(k8sTrafficUpdate).after(k8sBlueProd);

    const k8sGreenGoal = goals("deploy-green")
      .plan(k8sGreenProd).after(k8sStagingDeploy)
      .plan(k8sTrafficUpdate).after(k8sGreenProd);

    // CF Deployment
    const pcfDeploymentGoals = goals("cfdeploy")
      .plan(cfDeploymentStaging).after(mavenBuild, nodeBuild)
      .plan(cfDeployment).after(cfDeploymentStaging);

    // ECS
    const ecsDeployGoals = goals("ecsDeploy")
      .plan(ecsDeployStaging).after(dockerBuild)
      .plan(ecsDeployProd).after(ecsDeployStaging);

    // Docker Build goals
    const dockerBuildGoals = goals("docker-build")
      .plan(dockerBuild).after(
        mavenBuild,
        nodeBuild,
        externalBuild,
        dotNetBuild,
      );

    /**
     * Configure Push rules
     */
    sdm.addGoalContributions(goalContributors(
        whenPushSatisfies(ZeroCommitPushTest).setGoals(DoNotSetAnyGoalsAndLock),

        // whenPushSatisfies(IsNode, hasTsLintConfig, hasTsConfig)
        //   .setGoals(goals("node-autofix").plan(tsLint)),
        //
        // onAnyPush()
        //     .setGoals(GlobalGoals),
        //
        // whenPushSatisfies(not(isFirstCommit), ToDefaultBranch)
        //     .setGoals(ComplianceGoals),
        //
        // whenPushSatisfies(IsMaven, not(hasJenkinsfile))
        //     .setGoals(MavenBaseGoals),
        //
        whenPushSatisfies(IsNode, npmHasBuildScript, not(hasJenkinsfile))
            .setGoals(NodeBaseGoals),
        //
        // whenPushSatisfies(isDotNetCore, not(hasJenkinsfile))
        //     .setGoals(DotNetBasegoals),
        //
        // whenPushSatisfies(IsMaven, hasJenkinsfile)
        //     .setGoals(goals("maven-external").plan(mavenVersion, externalBuild).after(GlobalGoals)),

        whenPushSatisfies(HasDockerfile)
          .setGoals(dockerBuildGoals),

        whenPushSatisfies(HasCloudFoundryManifest, ToDefaultBranch)
            .setGoals(pcfDeploymentGoals),

        whenPushSatisfies(HasDockerfile, ToDefaultBranch, IsK8sDeployable)
            .setGoals(k8sDeployGoals),

        whenPushSatisfies(HasDockerfile, ToDefaultBranch, IsK8sDeployable, isBlueDeploy)
            .setGoals(k8sBlueGoal),

        whenPushSatisfies(HasDockerfile, ToDefaultBranch, IsK8sDeployable, isGreenDeploy)
          .setGoals(k8sGreenGoal),

        whenPushSatisfies(HasDockerfile, ToDefaultBranch, IsEcsDeployable)
            .setGoals(ecsDeployGoals)));

    addRandomCommand(sdm);
    return sdm;
}
