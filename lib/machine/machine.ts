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

// import { sonarQubeSupport, SonarScan } from "@atomist/sdm-pack-sonarqube";
import {
    editModes,
    GitHubRepoRef,
    Issue,
    logger,
    ProjectOperationCredentials,
    RemoteRepoRef,
} from "@atomist/automation-client";
import {
    AutoMergeMethod,
    AutoMergeMode,
} from "@atomist/automation-client/lib/operations/edit/editModes";
import {
    AutoCodeInspection,
    Autofix, Cancel,
    Fingerprint,
    goalContributors,
    goals,
    IssueRouter,
    not,
    onAnyPush, ParametersObject,
    PushImpact, Queue,
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
    goalState, isConfiguredInEnv
} from "@atomist/sdm-core";
import {
    Artifact,
    buildAwareCodeTransforms,
} from "@atomist/sdm-pack-build";
import { changelogSupport } from "@atomist/sdm-pack-changelog";
import {
    CloudFoundrySupport,
    HasCloudFoundryManifest,
} from "@atomist/sdm-pack-cloudfoundry";
import { HasDockerfile } from "@atomist/sdm-pack-docker";
import {
    applyBackpackFingerprint,
    backpackFingerprint,
    fingerprintImpactHandler,
    fingerprintSupport,
    messageMaker,
    sha256,
} from "@atomist/sdm-pack-fingerprints";
import {
    applyDockerBaseFingerprint,
    dockerBaseFingerprint,
} from "@atomist/sdm-pack-fingerprints/lib/fingerprints/dockerFrom";
import {
    applyNpmDepsFingerprint,
    createNpmDepsFingerprints,
    diffNpmDepsFingerprints,
} from "@atomist/sdm-pack-fingerprints/lib/fingerprints/npmDeps";
import {
    checkCljCoordinatesImpactHandler,
    checkNpmCoordinatesImpactHandler,
} from "@atomist/sdm-pack-fingerprints/lib/machine/FingerprintSupport";
import { issueSupport } from "@atomist/sdm-pack-issue";
import { kubernetesSupport } from "@atomist/sdm-pack-k8";
import {
    IsNode,
    NodeProjectCreationParametersDefinition,
    UpdatePackageJsonIdentification,
    UpdateReadmeTitle,
} from "@atomist/sdm-pack-node";
import {
    IsMaven,
    ReplaceReadmeTitle,
    SetAtomistTeamInApplicationYml,
    SpringProjectCreationParameterDefinitions,
    SpringProjectCreationParameters,
    springSupport,
    TransformSeedToCustomProject,
} from "@atomist/sdm-pack-spring";
import { FixedRepoCreationParameters } from "../../index";
import {
    hasJenkinsfile,
    isFirstCommit,
    npmHasBuildScript,
} from "../support/preChecks";
import { SuggestAddingDockerfile } from "../support/suggestAddDockerfile";
import { AddDockerFile } from "../transform/addDockerfile";
import { AddFinalNameToPom } from "../transform/addFinalName";
import { AddJenkinsfileRegistration } from "../transform/addJenkinsfile";
import { AddLicenseFile } from "../transform/addLicense";
import {
    FixSmallMemory,
    ReduceMemorySize,
} from "../transform/smallMemory";
import { UpdateDockerfileMaintainer } from "../transform/updateDockerFileMaintainer";
import {
    addImplementation,
    cfDeployment,
    cfDeploymentStaging,
    dockerBuild,
    externalBuild,
    fingerprintComplianceGoal,
    k8sProductionDeploy,
    k8sStagingDeploy,
    mavenBuild,
    mavenVersion,
    nodeBuild,
    nodeVersion,
} from "./goals";
import { DockerGoalScheduler } from "../support/dockerScheduler";
import * as path from "path";
import * as os from "os";

export function machine(
    configuration: SoftwareDeliveryMachineConfiguration,
): SoftwareDeliveryMachine {

    const sdm: SoftwareDeliveryMachine = createSoftwareDeliveryMachine(
        { name: "Organization ipcrmdemo sdm", configuration },
    );

    if (isConfiguredInEnv("docker", "docker-all")) {
        configuration.sdm.goalScheduler = [new DockerGoalScheduler()];
        configuration.sdm.docker = {
            job: {
                isolateAll: true,
                image: "ipcrm/ipcrmdemo-sdm:latest",
                args: ["-v", `${path.join(os.homedir(), ".atomist")}:/root/.atomist`, "--rm"],
            },
        };
    }

    addImplementation(sdm);

    // Bot Commands
    sdm.addCommand(EnableDeploy)
        .addCommand(DisableDeploy)
        .addCommand(DisplayDeployEnablement)
        .addCodeTransformCommand(AddDockerFile)
        .addCodeTransformCommand(AddJenkinsfileRegistration)
        .addCodeTransformCommand(UpdateDockerfileMaintainer)
        .addCodeTransformCommand(FixSmallMemory);

    // Channel Link Listeners
    sdm.addChannelLinkListener(SuggestAddingDockerfile);

    /**
     * Generic Goals
     */
    const fingerprint = new Fingerprint();
    const pushImpact = new PushImpact();
    const artifact = new Artifact();
    const codeInspection = new AutoCodeInspection();

    // Autofix
    const autofix = new Autofix()
        .with(ReduceMemorySize)
        .with(AddLicenseFile);

    class MattsIssueRouter implements IssueRouter {
        public async raiseIssue(
            credentials: ProjectOperationCredentials,
            id: RemoteRepoRef,
            issue: Issue): Promise<void> {
            logger.info(`Run logic here!`);
        }
    }

    /**
     * Ext Pack setup
     */
    sdm.addExtensionPacks(
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
            issueCreation: {
                issueRouter: new MattsIssueRouter(),
            },
        }),
        kubernetesSupport(),
        CloudFoundrySupport({
            pushImpactGoal: pushImpact,
        }),
        goalState(),
        changelogSupport(),
        issueSupport(),
        // sonarQubeSupport(SonarScanGoal),
        fingerprintSupport(
            fingerprint,
            [
                {
                    extract: createNpmDepsFingerprints,
                    apply: applyNpmDepsFingerprint,
                    selector: fp => fp.name.startsWith("npm-project-dep"),
                    summary: diffNpmDepsFingerprints,
                },
                {
                    apply: applyDockerBaseFingerprint,
                    extract: dockerBaseFingerprint,
                    selector: myFp => myFp.name.startsWith("docker-base-image"),
                },
                {
                    extract: backpackFingerprint,
                    apply: applyBackpackFingerprint,
                    selector: fp => fp.name === "backpack-react-scripts",
                },
                {
                    extract: async () => {
                        return {
                            name: `matt-fake-test`,
                            abbreviation: `mft`,
                            version: "0.0.1",
                            data: "OK",
                            value: "OK",
                            sha: sha256("OK"),
                        };
                    },
                    apply: async () => true,
                    selector: fp => fp.name !== undefined,
                },
            ],
            checkNpmCoordinatesImpactHandler(),
            checkCljCoordinatesImpactHandler(),
            fingerprintImpactHandler(
                {
                    complianceGoal: fingerprintComplianceGoal,
                    transformPresentation: ci => {
                        return new editModes.PullRequest(
                            `apply-target-fingerprint-${Date.now()}`,
                            `Apply fingerprint ${ci.parameters.title} to project`,
                            "Nudge generated by Atomist",
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
        ),
    );

    interface MyParameters extends SpringProjectCreationParameters {
        foo: string;
        color: string;
    }

    const MyParametersDefinition: ParametersObject<MyParameters> = {
        ...SpringProjectCreationParameterDefinitions,
        foo: {
            required: true,
        },
        color: {
            order: 1,
            required: true,
            type: {
                kind: "single",
                options: [
                    { value: "red", description: "Red" },
                    { value: "blue", description: "Blue" }
                ],
            },
        },
    };

    /**
     * Generators
     */
    sdm.addGeneratorCommand<MyParameters>({
        name: "create-spring",
        intent: "create spring",
        description: "Create a new Java Spring Boot REST service",
        parameters: MyParametersDefinition,
        startingPoint: GitHubRepoRef.from({ owner: "atomist-seeds", repo: "spring-rest", branch: "master" }),
        transform: [
            ReplaceReadmeTitle,
            SetAtomistTeamInApplicationYml,
            TransformSeedToCustomProject,
            AddFinalNameToPom,
        ],
        fallbackTarget: () => new FixedRepoCreationParameters(),
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
            TransformSeedToCustomProject,
            AddFinalNameToPom,
        ],
        fallbackTarget: () => new FixedRepoCreationParameters(),
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
        fallbackTarget: () => new FixedRepoCreationParameters(),
    });

    const queueGoal = new Queue({concurrent: 2, fetch: 10});

    /**
     * Goals Definition
     */
    const GlobalGoals = goals("global")
        .plan(autofix, fingerprint).after(queueGoal)
        .plan(codeInspection, pushImpact).after(autofix);

    // Compliance Goals
    const ComplianceGoals = goals("compliance-goals");
    // .plan(fingerprintComplianceGoal).after(GlobalGoals);
    // .plan(fingerprintComplianceGoal, SonarScanGoal).after(GlobalGoals);

    // Maven
    const MavenBaseGoals = goals("maven-base")
        .plan(mavenVersion, mavenBuild);

    // Node
    const NodeBaseGoals = goals("node-base")
        .plan(nodeVersion, nodeBuild);

    // K8s
    const k8sDeployGoals = goals("deploy")
        .plan(k8sStagingDeploy).after(dockerBuild)
        .plan(k8sProductionDeploy).after(k8sStagingDeploy);

    // CF Deployment
    const pcfDeploymentGoals = goals("cfdeploy")
        .plan(cfDeploymentStaging).after(mavenBuild)
        .plan(cfDeployment).after(cfDeploymentStaging);

    const cancel = new Cancel({
        goals: [
          GlobalGoals,
          ComplianceGoals,
          MavenBaseGoals,
          NodeBaseGoals,
        ],
    });

    const controlGoals = goals("controls")
      .plan(cancel);

    /**
     * Configure Push rules
     */
    sdm.addGoalContributions(goalContributors(
        onAnyPush()
            .setGoals(controlGoals),

        onAnyPush()
            .setGoals(GlobalGoals),

        whenPushSatisfies(not(isFirstCommit))
            .setGoals(ComplianceGoals),

        whenPushSatisfies(IsMaven, not(hasJenkinsfile))
            .setGoals(MavenBaseGoals),

        whenPushSatisfies(IsNode, npmHasBuildScript, not(hasJenkinsfile))
            .setGoals(NodeBaseGoals),

        whenPushSatisfies(IsMaven, hasJenkinsfile)
            .setGoals(goals("maven-external").plan(mavenVersion, externalBuild).after(GlobalGoals)),

        whenPushSatisfies(HasDockerfile)
            .setGoals(
                goals("docker-build")
                    .plan(dockerBuild).after(mavenBuild, nodeBuild, externalBuild)
                    .plan(artifact).after(dockerBuild),
            ),

        whenPushSatisfies(HasCloudFoundryManifest, ToDefaultBranch)
            .setGoals(pcfDeploymentGoals),

        whenPushSatisfies(HasDockerfile, ToDefaultBranch)
            .setGoals(k8sDeployGoals)));

    sdm.addCommand<{ color: string }>({
        name: "hello",
        intent: "hello",
        parameters: {
            color: {
                type: {
                    kind: "single",
                    options: [
                        { value: "red", description: "Red" },
                        { value: "blue", description: "Blue" },
                    ],
                },
            },
        },
        listener: async cli => cli.addressChannels(`Hello ${cli.parameters.color}`),
    });

    return sdm;
}

// sdm.addCommand<{ name: string }>({
//     name: "hello",
//     intent: "hello",
//     parameters: {
//         name: { description: "Your name" },
//     },
//     listener: async cli => cli.addressChannels(`Hello ${cli.parameters.name}`),
// });
