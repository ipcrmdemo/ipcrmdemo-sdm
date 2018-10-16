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

import {
    not,
    allSatisfied,
    AutoCodeInspection,
    Autofix,
    goalContributors,
    goals,
    onAnyPush,
    PushImpact,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    whenPushSatisfies,
    ToDefaultBranch,
    Fingerprint,
} from "@atomist/sdm";
import {
    GitHubRepoRef,
} from "@atomist/automation-client";
import {
    Build,
} from "@atomist/sdm-pack-build";
import {
    createSoftwareDeliveryMachine,
    Version,
    DisableDeploy,
    DisplayDeployEnablement,
    EnableDeploy,
    pack,
} from "@atomist/sdm-core";
import {
    DockerBuild,
    HasDockerfile,
} from "@atomist/sdm-pack-docker";
import {
    IsMaven,
    MavenProjectVersioner,
    ReplaceReadmeTitle,
    SetAtomistTeamInApplicationYml,
    SpringProjectCreationParameterDefinitions,
    SpringProjectCreationParameters,
    springSupport,
    TransformSeedToCustomProject,
    mavenBuilder,
    MavenDefaultOptions,
    MvnVersion,
    MvnPackage,
} from "@atomist/sdm-pack-spring";
import {
    KubernetesDeploy,
    kubernetesSupport,
} from "@atomist/sdm-pack-k8";
import {
    CloudFoundrySupport,
    HasCloudFoundryManifest,
    CloudFoundryDeploy,
    CloudFoundryDeploymentStrategy,
} from "@atomist/sdm-pack-cloudfoundry";
import { sonarQubeSupport } from "@atomist/sdm-pack-sonarqube";
import {
    fingerprintSupport,
    forFingerprints,
    renderDiffSnippet,
} from "@atomist/sdm-pack-fingerprints";
import {
    setNewTarget,
} from "@atomist/sdm-pack-fingerprints/lib/handlers/commands/pushImpactCommandHandlers";
import {
    IsNode,
    nodeBuilder,
    NpmVersionProjectListener,
} from "@atomist/sdm-pack-node";
import {
    AddDockerFile,
} from "../transform/addDockerfile";
import {
    UpdateDockerfileMaintainer,
} from "../transform/updateDockerFileMaintainer";
import {
    ReduceMemorySize,
    FixSmallMemory,
} from "../transform/smallMemory";
import {
    hasJenkinsfile,
} from "../support/jenkinsChecks";
import { AddFinalNameToPom } from "../transform/addFinalName";
// import {
//     AutoCheckSonarScan,
// } from "../support/sonarQube";

export const FingerprintGoal = new Fingerprint();
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
        .addCodeTransformCommand(UpdateDockerfileMaintainer)
        .addCodeTransformCommand(FixSmallMemory);

    // Autofix
    const autofix = new Autofix()
        .with(ReduceMemorySize);

    // Code Inspections
    const codeInspectionGoal = new AutoCodeInspection();
    // const autoCheckSonarGoal = new AutoCodeInspection().with(AutoCheckSonarScan);

    // Versioners
    const MavenVersion = new Version().withVersioner(MavenProjectVersioner);

    // Builds
    const build = new Build()
        .with({...MavenDefaultOptions,
            name: "maven-run-build",
            builder: mavenBuilder([{name: "maven-run-build"}]),
            pushTest: MavenDefaultOptions.pushTest })
        .with({
            externalTool: "jenkins",
            pushTest: hasJenkinsfile })
        .with({
            name: "node-run-build",
            builder: nodeBuilder("node-run-build"),
            pushTest: IsNode,
        });

    const SdmDockerBuild = new DockerBuild()
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

    // Kubernetes Deploys
    const K8sStagingDeploy    = new KubernetesDeploy({ environment: "testing", approval: true });
    const K8sProductionDeploy = new KubernetesDeploy({ environment: "production"  });
    const K8sDeployGoals = goals("deploy")
        .plan(SdmDockerBuild).after(build)
        .plan(K8sStagingDeploy).after(SdmDockerBuild)
        .plan(K8sProductionDeploy).after(K8sStagingDeploy);

    // PCF Deploys
    const PcfStagingDeploy = new CloudFoundryDeploy({
        uniqueName: "cf-staging-deploy",
        approval: true,
        preApproval: false,
        retry: true,
    })
        .with({environment: "staging", strategy: CloudFoundryDeploymentStrategy.BLUE_GREEN });

    // const PcfProductionDeploy = new CloudFoundryDeploy({
    //     uniqueName: "cf-production-deploy",
    //     approval: true,
    //     preApproval: false,
    //     retry: true,
    // })
    //     .with({environment: "production", strategy: CloudFoundryDeploymentStrategy.API });

    const PcfDeploymentGoals = goals("cfdeploy")
        .plan(PcfStagingDeploy).after(build);
        // .plan(PcfProductionDeploy).after(PcfStagingDeploy);

    // Ext Packs setup
    sonarQubeSupport({...sdm.configuration.sdm.sonar});
    sdm.addExtensionPacks(
        springSupport({
            review: {
                springStyle: true,
                cloudNative: true,
            },
            autofix: {
                springStyle: true,
            },
            inspectGoal: codeInspectionGoal,
            autofixGoal: autofix,
            reviewListeners: [],
        }),
        kubernetesSupport(),
        CloudFoundrySupport({}),
        pack.goalState.GoalState,
        pack.githubGoalStatus.GitHubGoalStatus,
        fingerprintSupport(
            FingerprintGoal,
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

    // Maven
    const MavenBaseGoals = goals("checks")
        .plan(MavenVersion, autofix, new PushImpact());
    const SdmBuildGoals = goals("build")
        .plan(build).after(autofix, MavenVersion);
    const BuildGoals = goals("build")
        .plan(build).after(autofix, MavenVersion);

    // Node
    const NodeBaseGoals = goals("checks")
        .plan(autofix, FingerprintGoal, new PushImpact());

    // Rules
    sdm.addGoalContributions(goalContributors(
        onAnyPush(),
        whenPushSatisfies(IsMaven, not(IsNode))
            .setGoals(MavenBaseGoals),
        whenPushSatisfies(not(IsMaven), IsNode)
            .setGoals(NodeBaseGoals),
        whenPushSatisfies(IsMaven, hasJenkinsfile)
            .setGoals(BuildGoals),
        whenPushSatisfies(IsMaven, not(hasJenkinsfile))
            .setGoals(SdmBuildGoals),
        whenPushSatisfies(HasCloudFoundryManifest, ToDefaultBranch)
            .setGoals(PcfDeploymentGoals),
        whenPushSatisfies(HasDockerfile, ToDefaultBranch)
            .setGoals(K8sDeployGoals)));

    return sdm;
}
