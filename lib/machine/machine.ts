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
    AnyPush,
    Build,
    GitHubRepoRef,
    goalContributors,
    goals,
    executeDeploy,
    onAnyPush,
    PushImpact,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    whenPushSatisfies,
    ToDefaultBranch,
    StagingEndpointGoal,
    ProductionEndpointGoal,
    ProductionUndeploymentGoal,
} from "@atomist/sdm";
import {
    StagingUndeploymentGoal,
} from "@atomist/sdm/lib/pack/well-known-goals/commonGoals";
import {
    createSoftwareDeliveryMachine,
    Version,
    DisableDeploy,
    DisplayDeployEnablement,
    EnableDeploy,
    pack,
    summarizeGoalsInGitHubStatus,
} from "@atomist/sdm-core";
import {
    DockerBuild,
    HasDockerfile,
} from "@atomist/sdm-pack-docker";
import {
    CloudNativeGitHubIssueRaisingReviewListener,
    IsMaven,
    MavenBuilder,
    MavenProgressReporter,
    MavenProjectVersioner,
    MavenVersionPreparation,
    ReplaceReadmeTitle,
    SetAtomistTeamInApplicationYml,
    SpringProjectCreationParameterDefinitions,
    SpringProjectCreationParameters,
    SpringStyleGitHubIssueRaisingReviewListener,
    springSupport,
    TransformSeedToCustomProject,
} from "@atomist/sdm-pack-spring";
import {
    enableDeployOnCloudFoundryManifestAddition,
} from "@atomist/sdm-pack-cloudfoundry/lib/listeners/enableDeployOnCloudFoundryManifestAddition";
import {
    AddDockerFile,
} from "../transform/addDockerfile";
import {
    ReduceMemorySize,
    FixSmallMemory,
} from "../transform/smallMemory";
import {
    hasJenkinsfile,
} from "../support/jenkinsChecks";
import { MavenPackage } from "../support/maven";
import { AddFinalNameToPom } from "../transform/addFinalName";
import {
    KubernetesDeploy,
    kubernetesSupport,
} from "@atomist/sdm-pack-k8";
import {
    CloudFoundrySupport,
    HasCloudFoundryManifest,
    CloudFoundryBlueGreenDeployer,
    EnvironmentCloudFoundryTarget,
} from "@atomist/sdm-pack-cloudfoundry";
import { SonarQubeSupport } from "@atomist/sdm-pack-sonarqube";
import {
    AutoCheckSonarScan,
} from "../support/sonarQube";
import {
    StagingDeploymentGoalWApproval,
    ProductionDeploymentGoalWPreApproval,
} from "./goals";

export function machine(
    configuration: SoftwareDeliveryMachineConfiguration,
): SoftwareDeliveryMachine {

    const sdm: SoftwareDeliveryMachine = createSoftwareDeliveryMachine(
        { name: "Organization ipcrmdemo sdm", configuration },
    );

    // Autofix
    const autofix = new Autofix()
        .with(ReduceMemorySize);

    // Code Inspections
    const codeInspectionGoal = new AutoCodeInspection()
        .with(AutoCheckSonarScan);

    // Versioners
    const version = new Version().withVersioner(MavenProjectVersioner);

    // Builds
    const sdmBuild = new Build().with({
        builder: new MavenBuilder(sdm),
        progressReporter: MavenProgressReporter,
    });

    const build = new Build();
    sdm.addGoalSideEffect(
        build,
        "build",
        allSatisfied(IsMaven, hasJenkinsfile),
    );

    const dockerBuild = new DockerBuild().with({
        preparations: [MavenVersionPreparation, MavenPackage],
        options: { push: true, ...sdm.configuration.sdm.dockerinfo },
    });

    // Kubernetes Deploys
    const K8sStagingDeploy    = new KubernetesDeploy({ environment: "testing", approval: true });
    const K8sProductionDeploy = new KubernetesDeploy({ environment: "production"  });
    const K8sDeployGoals = goals("deploy")
        .plan(dockerBuild).after(build)
        .plan(K8sStagingDeploy).after(dockerBuild)
        .plan(K8sProductionDeploy).after(K8sStagingDeploy);

    // PCF Deploys
    const deployToStaging = {
            deployer: new CloudFoundryBlueGreenDeployer(sdm.configuration.sdm.projectLoader),
            targeter: () => new EnvironmentCloudFoundryTarget("staging"),
            deployGoal: StagingDeploymentGoalWApproval,
            endpointGoal: StagingEndpointGoal,
            undeployGoal: StagingUndeploymentGoal,
    };

    sdm.addGoalImplementation("Staging CF deployer",
        deployToStaging.deployGoal,
        executeDeploy(
            sdm.configuration.sdm.artifactStore,
            sdm.configuration.sdm.repoRefResolver,
            deployToStaging.endpointGoal, deployToStaging),
        {
            pushTest: IsMaven,
            logInterpreter: deployToStaging.deployer.logInterpreter,
        },
    );

    sdm.addGoalSideEffect(
        deployToStaging.endpointGoal,
        deployToStaging.deployGoal.definition.displayName,
        AnyPush);

    const deployToProduction = {
        deployer: new CloudFoundryBlueGreenDeployer(sdm.configuration.sdm.projectLoader),
        targeter: () => new EnvironmentCloudFoundryTarget("production"),
        deployGoal: ProductionDeploymentGoalWPreApproval,
        endpointGoal: ProductionEndpointGoal,
        undeployGoal: ProductionUndeploymentGoal,
    };

    sdm.addGoalImplementation("Production CF deployer",
    deployToProduction.deployGoal,
    executeDeploy(
        sdm.configuration.sdm.artifactStore,
        sdm.configuration.sdm.repoRefResolver,
        deployToProduction.endpointGoal, deployToProduction),
        {
            pushTest: IsMaven,
            logInterpreter: deployToProduction.deployer.logInterpreter,
        },
    );

    sdm.addGoalSideEffect(
        deployToProduction.endpointGoal,
        deployToProduction.deployGoal.definition.displayName,
        AnyPush);

    const PcfDeploymentGoals = goals("cfdeploy")
        .plan(StagingDeploymentGoalWApproval).after(build)
        .plan(StagingEndpointGoal).after(StagingDeploymentGoalWApproval)
        .plan(ProductionDeploymentGoalWPreApproval).after(StagingDeploymentGoalWApproval)
        .plan(ProductionEndpointGoal).after(ProductionDeploymentGoalWPreApproval);

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
            inspectGoal: codeInspectionGoal,
            autofixGoal: autofix,
            reviewListeners: [
                CloudNativeGitHubIssueRaisingReviewListener,
                SpringStyleGitHubIssueRaisingReviewListener,
            ],
        }),
        kubernetesSupport(),
        CloudFoundrySupport,
        pack.goalState.GoalState,
        SonarQubeSupport,
    );

    // Generators
    sdm.addGeneratorCommand<SpringProjectCreationParameters>({
        name: "create-spring",
        intent: "create spring",
        description: "Create a new Java Spring Boot REST service",
        parameters: SpringProjectCreationParameterDefinitions,
        startingPoint: GitHubRepoRef.from({ owner: "atomist-seeds", repo: "spring-rest-seed", branch: "master" }),
        transform: [
            ReplaceReadmeTitle,
            SetAtomistTeamInApplicationYml,
            TransformSeedToCustomProject,
            AddFinalNameToPom,
        ],
    });

    // Generic Goals
    const BaseGoals = goals("checks")
        .plan(version, autofix, codeInspectionGoal, new PushImpact());
    const SdmBuildGoals = goals("build")
        .plan(sdmBuild).after(autofix, version);
    const BuildGoals = goals("build")
        .plan(build).after(autofix, version);

    // Goalset config
    sdm.addGoalContributions(goalContributors(
        onAnyPush().setGoals(BaseGoals),
        whenPushSatisfies(IsMaven, hasJenkinsfile)
            .setGoals(BuildGoals),
        whenPushSatisfies(IsMaven, not(hasJenkinsfile))
            .setGoals(SdmBuildGoals),
        whenPushSatisfies(HasCloudFoundryManifest, ToDefaultBranch)
            .setGoals(PcfDeploymentGoals),
        whenPushSatisfies(HasDockerfile, ToDefaultBranch)
            .setGoals(K8sDeployGoals)));

    // Bot Commands
    sdm.addCommand(EnableDeploy)
        .addCommand(DisableDeploy)
        .addCommand(DisplayDeployEnablement)
        .addPushImpactListener(enableDeployOnCloudFoundryManifestAddition(sdm))
        .addCodeTransformCommand(AddDockerFile)
        .addCodeTransformCommand(FixSmallMemory);

    // Github Integration
    summarizeGoalsInGitHubStatus(sdm);
    return sdm;
}
