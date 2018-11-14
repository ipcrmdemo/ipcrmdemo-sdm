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

import { GitHubRepoRef } from "@atomist/automation-client";
import {
    allSatisfied,
    AutoCodeInspection,
    Autofix,
    Fingerprint,
    goalContributors,
    goals,
//    LogSuppressor,
    not,
    onAnyPush,
    PushImpact,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    ToDefaultBranch,
    whenPushSatisfies,
} from "@atomist/sdm";
import {
    createSoftwareDeliveryMachine,
    DisableDeploy,
    DisplayDeployEnablement,
    EnableDeploy,
    goalState,
    Version,
} from "@atomist/sdm-core";
import {
    Artifact,
    Build,
} from "@atomist/sdm-pack-build";
// import {
//     // CloudFoundryDeploy,
//     // CloudFoundryDeploymentStrategy,
//     CloudFoundrySupport,
//     // HasCloudFoundryManifest,
// } from "@atomist/sdm-pack-cloudfoundry";
import {
    DockerBuild,
    HasDockerfile,
} from "@atomist/sdm-pack-docker";
import {
    fingerprintSupport,
    forFingerprints,
    renderDiffSnippet,
} from "@atomist/sdm-pack-fingerprints";
import { setNewTarget } from "@atomist/sdm-pack-fingerprints/lib/handlers/commands/pushImpactCommandHandlers";
import {
    // KubernetesDeploy,
    kubernetesSupport,
} from "@atomist/sdm-pack-k8";
import {
    IsNode,
    // nodeBuilder,
    // NodeProjectVersioner,
    // NpmProgressReporter,
    NpmVersionProjectListener,
} from "@atomist/sdm-pack-node";
import {
    IsMaven,
    mavenBuilder,
    MavenDefaultOptions,
    MavenProjectVersioner,
    MvnPackage,
    MvnVersion,
    ReplaceReadmeTitle,
    SetAtomistTeamInApplicationYml,
    SpringProjectCreationParameterDefinitions,
    SpringProjectCreationParameters,
    springSupport,
    TransformSeedToCustomProject,
} from "@atomist/sdm-pack-spring";
import { changelogSupport } from "@atomist/sdm-pack-changelog";
import { IssueSupport } from "@atomist/sdm-pack-issue";
import {
    hasJenkinsfile,
    // npmHasBuildScript,
} from "../support/preChecks";
import { AddDockerFile } from "../transform/addDockerfile";
import { AddFinalNameToPom } from "../transform/addFinalName";
import { AddJenkinsfileRegistration } from "../transform/addJenkinsfile";
import {
    FixSmallMemory,
    ReduceMemorySize,
} from "../transform/smallMemory";
import { UpdateDockerfileMaintainer } from "../transform/updateDockerFileMaintainer";
import { EcsDeploy } from "../support/ecs/deploy";
// import { sonarQubeSupport } from "@atomist/sdm-pack-sonarqube";
// import {
//     AutoCheckSonarScan,
// } from "../support/sonarQube";

export const fingerprint = new Fingerprint();

export function machine(
    configuration: SoftwareDeliveryMachineConfiguration,
): SoftwareDeliveryMachine {

    const sdm: SoftwareDeliveryMachine = createSoftwareDeliveryMachine(
        { name: "Organization ipcrmdemo sdm", configuration },
    );

    // Bot Commands
    sdm.addCommand(EnableDeploy)
        .addCommand(DisableDeploy)
        .addCommand(DisplayDeployEnablement)
        .addCodeTransformCommand(AddDockerFile)
        .addCodeTransformCommand(AddJenkinsfileRegistration)
        .addCodeTransformCommand(UpdateDockerfileMaintainer)
        .addCodeTransformCommand(FixSmallMemory);

    // Global
    const pushImpact = new PushImpact();

    // Artifact
    const artifact = new Artifact();

    // Autofix
    const autofix = new Autofix()
        .with(ReduceMemorySize);

    // Code Inspections
    const codeInspection = new AutoCodeInspection();

    // Versioners
    const mavenVersion = new Version().withVersioner(MavenProjectVersioner);
    // const nodeVersion = new Version().withVersioner(NodeProjectVersioner);

    // Builds
    const mavenBuild = new Build()
        .with({
            ...MavenDefaultOptions,
            name: "maven-run-build",
            builder: mavenBuilder([{ name: "maven-run-build" }]),
            pushTest: MavenDefaultOptions.pushTest,
        });

    // const externalBuild = new Build()
    //     .with({
    //         externalTool: "jenkins",
    //         pushTest: hasJenkinsfile,
    //     });

    // const nodeBuild = new Build()
    //     .with({
    //         logInterpreter: LogSuppressor,
    //         progressReporter: NpmProgressReporter,
    //         name: "node-run-build",
    //         builder: nodeBuilder("npm run build"),
    //         pushTest: IsNode,
    //     });

    const dockerBuild = new DockerBuild()
        .with({
            options: { push: true, ...sdm.configuration.sdm.dockerinfo },
            pushTest: allSatisfied(IsMaven, HasDockerfile),
        })
        .withProjectListener(MvnVersion)
        .withProjectListener(MvnPackage)

        .with({
            options: { push: true, ...sdm.configuration.sdm.dockerinfo },
            pushTest: allSatisfied(IsNode, HasDockerfile),
        })
        .withProjectListener(NpmVersionProjectListener);

    // // Kubernetes Deploys
    // const k8sStagingDeploy = new KubernetesDeploy({ environment: "testing", approval: true });
    // const k8sProductionDeploy = new KubernetesDeploy({ environment: "production" });

    // const k8sDeployGoals = goals("deploy")
    //     .plan(dockerBuild).after(mavenBuild, nodeBuild, externalBuild)
    //     .plan(k8sStagingDeploy).after(dockerBuild)
    //     .plan(k8sProductionDeploy).after(k8sStagingDeploy);

    // // CF Deployment
    // const cfDeployment = new CloudFoundryDeploy({
    //     displayName: "Deploy to CF `production`",
    //     environment: "production",
    //     preApproval: true,
    //     descriptions: {
    //         inProcess: "Deploying to Cloud Foundry `production`",
    //         completed: "Deployed to Cloud Foundry `production`",
    //     },
    // })
    //     .with({ environment: "production", strategy: CloudFoundryDeploymentStrategy.API });

    // ECS
    const ecsDeployStaging = new EcsDeploy({
        displayName: "Test ECS Deploy",
        uniqueName: "ecs-test-1",
        environment: "production",
        preApproval: false,
        descriptions: {
            inProcess: "Deploying to ecs `prod`",
            completed: "deployed to ecs `prod`",
        },
    })
        .with({
            serviceName: "ecs-test-1-production",
            taskDefinition: "tutorial:1",
            launchType: "FARGATE",
            cluster: "tutorial",
            desiredCount: 1,
            networkConfiguration: {
                awsvpcConfiguration: {
                    subnets: ["subnet-02ddf34bfe7f6c19a", "subnet-0c5bfb43a631bee45"],
                    securityGroups: ["sg-0959d9866b23698f2"],
                    assignPublicIp: "ENABLED",
                },
            },
        });

    // const cfDeploymentStaging = new CloudFoundryDeploy({
    //         displayName: "Deploy to CF `testing`",
    //         environment: "testing",
    //         preApproval: true,
    //         descriptions: {
    //             inProcess: "Deploying to Cloud Foundry `testing`",
    //             completed: "Deployed to Cloud Foundry `testing`",
    //         },
    //     },
    // )
    //     .with({ environment: "staging", strategy: CloudFoundryDeploymentStrategy.API });

    // const pcfDeploymentGoals = goals("cfdeploy")
    //     .plan(cfDeploymentStaging).after(mavenBuild)
    //     .plan(cfDeployment).after(cfDeploymentStaging);

    // Ext Packs setup
    sdm.addExtensionPacks(
        // sonarQubeSupport({
        //     ...sdm.configuration.sdm.sonar,
        //     inspectGoal: codeInspection,
        // }),
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
        kubernetesSupport(),
        // CloudFoundrySupport({
        //     pushImpactGoal: pushImpact,
        // }),
        goalState(),
        changelogSupport(),
        IssueSupport,
        fingerprintSupport(
            fingerprint,
            {
                selector: forFingerprints(
                    "clojure-project-deps",
                    "maven-project-deps",
                    "npm-project-deps"),
                diffHandler: renderDiffSnippet,
            },
            {
                selector: forFingerprints(
                    "clojure-project-coordinates",
                    "maven-project-coordinates",
                    "npm-project-coordinates"),
                diffHandler: async (ctx, diff) => {

                    await ctx.messageClient.addressChannels(
                        `Version update to ${diff.to.data.name}:
                                 Change from ${diff.from.data.version} to ${diff.to.data.version}`,
                        diff.channel);
                    return setNewTarget(
                        ctx,
                        diff.to.name,
                        diff.to.data.name,
                        diff.to.data.version,
                        diff.channel);
                },
            },
        ),
    );

    // Generators
    sdm.addGeneratorCommand<SpringProjectCreationParameters>({
        name: "create-spring",
        intent: "create spring",
        description: "Create a new Java Spring Boot REST service",
        parameters: SpringProjectCreationParameterDefinitions,
        startingPoint: GitHubRepoRef.from({ owner: "atomist-seeds", repo: "spring-rest", branch: "master" }),
        transform: [
            ReplaceReadmeTitle,
            SetAtomistTeamInApplicationYml,
            TransformSeedToCustomProject,
            AddFinalNameToPom,
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
            TransformSeedToCustomProject,
            AddFinalNameToPom,
        ],
    });

    // global
    const GlobalGoals = goals("global")
        .plan(autofix, fingerprint, codeInspection, pushImpact);

    // Maven
    const MavenBaseGoals = goals("maven-base")
        .plan(mavenVersion, mavenBuild, artifact);

    // Node
    // const NodeBaseGoals = goals("node-base")
    //     .plan(nodeVersion, nodeBuild);

        // .with({
        // });

    const ecsDeployGoals = goals("ecs-goals")
        .plan(dockerBuild).after(mavenBuild)
        .plan(ecsDeployStaging).after(dockerBuild);

    // Rules
    sdm.addGoalContributions(goalContributors(
        onAnyPush()
           .setGoals(GlobalGoals),

        whenPushSatisfies(IsMaven, not(hasJenkinsfile))
            .setGoals(MavenBaseGoals),

        whenPushSatisfies(ToDefaultBranch)
            .setGoals(ecsDeployGoals)));
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
