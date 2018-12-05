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

import { GitHubRepoRef, GitProject, editModes, HandlerContext } from "@atomist/automation-client";
import {
    allSatisfied,
    AutoCodeInspection,
    Autofix,
    Fingerprint,
    goalContributors,
    goals,
    LogSuppressor,
    not,
    onAnyPush,
    PushImpact,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    ToDefaultBranch,
    whenPushSatisfies,
    GoalWithFulfillment,
    Goals,
} from "@atomist/sdm";
import {
    createSoftwareDeliveryMachine,
    DisableDeploy,
    DisplayDeployEnablement,
    EnableDeploy,
    pack,
    Version,
} from "@atomist/sdm-core";
import {
    Artifact,
    Build,
} from "@atomist/sdm-pack-build";
import {
    CloudFoundryDeploy,
    CloudFoundryDeploymentStrategy,
    CloudFoundrySupport,
    HasCloudFoundryManifest,
} from "@atomist/sdm-pack-cloudfoundry";
import {
    DockerBuild,
    HasDockerfile,
} from "@atomist/sdm-pack-docker";
import {
    applyFingerprint,
    depsFingerprints,
    Diff,
    fingerprintImpactHandler,
    fingerprintSupport,
    FP,
    messageMaker,
    simpleImpactHandler,
    checkLibraryImpactHandler,
    // renderData,
    // renderDiffSnippet,
} from "@atomist/sdm-pack-fingerprints";
import {
    KubernetesDeploy,
    kubernetesSupport,
} from "@atomist/sdm-pack-k8";
import {
    IsNode,
    nodeBuilder,
    NodeProjectVersioner,
    NpmProgressReporter,
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
import { setNewTarget } from "@atomist/sdm-pack-fingerprints/lib/handlers/commands/setLibraryGoal";
import { changelogSupport } from "@atomist/sdm-pack-changelog";
import { IssueSupport } from "@atomist/sdm-pack-issue";
import {
    hasJenkinsfile,
    npmHasBuildScript,
} from "../support/preChecks";
import { AddDockerFile } from "../transform/addDockerfile";
import { AddFinalNameToPom } from "../transform/addFinalName";
import { AddJenkinsfileRegistration } from "../transform/addJenkinsfile";
import {
    FixSmallMemory,
    ReduceMemorySize,
} from "../transform/smallMemory";
import { UpdateDockerfileMaintainer } from "../transform/updateDockerFileMaintainer";
// import { sonarQubeSupport } from "@atomist/sdm-pack-sonarqube";
// import {
//     AutoCheckSonarScan,
// } from "../support/sonarQube";

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

    const backpackComplianceGoal = new GoalWithFulfillment(
        {
            uniqueName: "backpack-react-script-compliance",
            displayName: "backpack-compliance",
        },
    ).with(
        {
            name: "backpack-react-waiting",
        },
    );

    const FingerprintGoal = new Fingerprint();
    const FingerprintingGoals: Goals = goals("check fingerprints")
        .plan(FingerprintGoal, backpackComplianceGoal);

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
    const nodeVersion = new Version().withVersioner(NodeProjectVersioner);

    // Builds
    const mavenBuild = new Build()
        .with({
            ...MavenDefaultOptions,
            name: "maven-run-build",
            builder: mavenBuilder([{ name: "maven-run-build" }]),
            pushTest: MavenDefaultOptions.pushTest,
        });

    const externalBuild = new Build()
        .with({
            externalTool: "jenkins",
            pushTest: hasJenkinsfile,
        });

    const nodeBuild = new Build()
        .with({
            logInterpreter: LogSuppressor,
            progressReporter: NpmProgressReporter,
            name: "node-run-build",
            builder: nodeBuilder("npm run build"),
            pushTest: IsNode,
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

    // Kubernetes Deploys
    const k8sStagingDeploy = new KubernetesDeploy({ environment: "testing", approval: true });
    const k8sProductionDeploy = new KubernetesDeploy({ environment: "production" });

    const k8sDeployGoals = goals("deploy")
        .plan(dockerBuild).after(mavenBuild, nodeBuild, externalBuild)
        .plan(k8sStagingDeploy).after(dockerBuild)
        .plan(k8sProductionDeploy).after(k8sStagingDeploy);

    // CF Deployment
    const cfDeployment = new CloudFoundryDeploy({
        displayName: "Deploy to CF `production`",
        environment: "production",
        preApproval: true,
        descriptions: {
            inProcess: "Deploying to Cloud Foundry `production`",
            completed: "Deployed to Cloud Foundry `production`",
        },
    })
        .with({ environment: "production", strategy: CloudFoundryDeploymentStrategy.API });

    const cfDeploymentStaging = new CloudFoundryDeploy({
            displayName: "Deploy to CF `testing`",
            environment: "testing",
            preApproval: true,
            descriptions: {
                inProcess: "Deploying to Cloud Foundry `testing`",
                completed: "Deployed to Cloud Foundry `testing`",
            },
        },
    )
        .with({ environment: "staging", strategy: CloudFoundryDeploymentStrategy.API });

    const pcfDeploymentGoals = goals("cfdeploy")
        .plan(cfDeploymentStaging).after(mavenBuild)
        .plan(cfDeployment).after(cfDeploymentStaging);

    async function npmDepUpdated(ctx: HandlerContext, diff: Diff): Promise<any> {
        return setNewTarget(
            ctx,
            diff.to.name,
            diff.to.data.name,
            diff.to.data.version,
            diff.channel);
    }

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
        CloudFoundrySupport({
            pushImpactGoal: pushImpact,
        }),
        pack.goalState.GoalState,
        pack.githubGoalStatus.GitHubGoalStatus,
        changelogSupport(),
        IssueSupport,
        fingerprintSupport(
            FingerprintGoal,
            async (p: GitProject) => {
                // COMPUTE fingerprints: called on every Push
                // this default impl includes the backpack-react-scripts fingerprint
                return depsFingerprints(p.baseDir);
            },
            fingerprintImpactHandler(
                {
                    transform: async (p: GitProject, fp: FP) => {
                        // TRANSFORM project containing different version of Fingerprint
                        // this default impl will transform projects containing backpack-react-scripts fingerprints
                        return applyFingerprint(p.baseDir, fp);
                    },
                    transformPresentation: ci => {
                        return new editModes.PullRequest(
                            `apply-target-fingerprint-${Date.now()}`,
                            `Apply fingerprint ${ci.parameters.fingerprint} to project`,
                            "Nudge generated by Atomist");
                    },
                    complianceGoal: backpackComplianceGoal,
                    messageMaker,
                },
                "backpack-react-scripts",
            ),
            simpleImpactHandler( npmDepUpdated, "npm-project-coordinates"),
            checkLibraryImpactHandler(),
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
        .plan(autofix, codeInspection, pushImpact);

    // Maven
    const MavenBaseGoals = goals("maven-base")
        .plan(mavenVersion, mavenBuild, artifact);

    // Node
    const NodeBaseGoals = goals("node-base")
        .plan(nodeVersion, nodeBuild);

    // Rules
    sdm.addGoalContributions(goalContributors(
        onAnyPush()
            .setGoals(GlobalGoals)
            .setGoals(FingerprintingGoals),

        whenPushSatisfies(IsMaven, not(hasJenkinsfile))
            .setGoals(MavenBaseGoals),

        whenPushSatisfies(IsNode, npmHasBuildScript, not(hasJenkinsfile))
            .setGoals(NodeBaseGoals),

        whenPushSatisfies(IsMaven, hasJenkinsfile)
            .setGoals(goals("maven-external").plan(mavenVersion, externalBuild)),

        whenPushSatisfies(HasCloudFoundryManifest, ToDefaultBranch)
            .setGoals(pcfDeploymentGoals),

        whenPushSatisfies(HasDockerfile, ToDefaultBranch)
            .setGoals(k8sDeployGoals)));
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
