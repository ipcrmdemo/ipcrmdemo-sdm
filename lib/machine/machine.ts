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
    kubernetesSupport,
} from "@atomist/sdm-pack-k8";
import {
    IsNode,
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

    // Ext Packs setup
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
        kubernetesSupport(),
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
            name: "test",
            pushTest: HasDockerfile,
            serviceRequest: {
                serviceName: "ecs-test-1-production",
                launchType: "FARGATE",
                cluster: "tutorial",
                desiredCount: 3,
                networkConfiguration: {
                    awsvpcConfiguration: {
                        subnets: ["subnet-02ddf34bfe7f6c19a", "subnet-0c5bfb43a631bee45"],
                        securityGroups: ["sg-0959d9866b23698f2"],
                        assignPublicIp: "ENABLED",
                    },
                },
            },
        });

    // global
    const GlobalGoals = goals("global")
        .plan(autofix, fingerprint, codeInspection, pushImpact);

    // Maven
    const MavenBaseGoals = goals("maven-base")
        .plan(mavenVersion, mavenBuild, artifact);

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
