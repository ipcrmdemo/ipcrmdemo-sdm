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
    AutoCodeInspection,
    Autofix,
    goalContributors,
    goals,
    onAnyPush,
    PushImpact,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    whenPushSatisfies,
} from "@atomist/sdm";
import {
    Build,
} from "@atomist/sdm-pack-build";
import {
    createSoftwareDeliveryMachine,
    DisableDeploy,
    DisplayDeployEnablement,
    EnableDeploy,
    gitHubGoalStatus,
    goalState,
    Version,
} from "@atomist/sdm-core";
import {
    springSupport, MavenProjectVersioner, MavenDefaultOptions, mavenBuilder, IsMaven,
} from "@atomist/sdm-pack-spring";
import { AddDockerFile } from "../transform/addDockerfile";
import { AddJenkinsfileRegistration } from "../transform/addJenkinsfile";
import { AddLicenseFile } from "../transform/addLicense";
import {
    FixSmallMemory,
    ReduceMemorySize,
} from "../transform/smallMemory";
import { UpdateDockerfileMaintainer } from "../transform/updateDockerFileMaintainer";
import { SuggestAddingDockerfile } from "../support/suggestAddDockerfile";
import { presentSetFingerprints } from "../support/showFingerprints";
import {
  ciDockerMatchRegistration,
  optionalFailGoalsIfCiConfigDoesntMatchRegistration,
  correctCiConfiguration,
} from "../inspections/ciDockerMatch";

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
        .addCommand(presentSetFingerprints)
        .addCodeTransformCommand(AddDockerFile)
        .addCodeTransformCommand(AddJenkinsfileRegistration)
        .addCodeTransformCommand(UpdateDockerfileMaintainer)
        .addCodeTransformCommand(FixSmallMemory)
        .addCodeTransformCommand(correctCiConfiguration);

    // Maven
    const mavenVersion = new Version().withVersioner(MavenProjectVersioner);
    const mavenBuild = new Build()
    .with({
        ...MavenDefaultOptions,
        name: "maven-run-build",
        builder: mavenBuilder([{ name: "maven-run-build" }]),
        pushTest: MavenDefaultOptions.pushTest,
    });


    // Channel Link Listenrers
    sdm.addChannelLinkListener(SuggestAddingDockerfile);

    // Global
    const pushImpact = new PushImpact();

    // Autofix
    const autofix = new Autofix()
        .with(ReduceMemorySize)
        .with(AddLicenseFile);

    // Code Inspections
    const codeInspection = new AutoCodeInspection()
        .with(ciDockerMatchRegistration)
        .withListener(optionalFailGoalsIfCiConfigDoesntMatchRegistration);

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
        gitHubGoalStatus(),
        goalState(),
    );

    // global
    const GlobalGoals = goals("global")
        .plan(autofix, codeInspection, pushImpact);

    const MavenBaseGoals = goals("maven-base")
        .plan(mavenVersion, mavenBuild).after(GlobalGoals);

    // Rules
    sdm.addGoalContributions(goalContributors(
        onAnyPush()
            .setGoals(GlobalGoals),

        whenPushSatisfies(IsMaven)
            .setGoals(MavenBaseGoals),
    ));

    return sdm;
}
