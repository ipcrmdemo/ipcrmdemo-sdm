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
    createSoftwareDeliveryMachine,
    pack,
    Version,
} from "@atomist/sdm-core";
import {
    Build,
} from "@atomist/sdm-pack-build";
import {
    IsMaven,
    MavenProjectVersioner,
} from "@atomist/sdm-pack-spring";
import {
    hasJenkinsfile,
} from "../support/preChecks";
import {
    ReduceMemorySize,
} from "../transform/smallMemory";

export function machine(
    configuration: SoftwareDeliveryMachineConfiguration,
): SoftwareDeliveryMachine {

    const sdm: SoftwareDeliveryMachine = createSoftwareDeliveryMachine(
        { name: "Organization ipcrmdemo sdm", configuration },
    );

    // Global
    const pushImpact = new PushImpact();

    // Autofix
    const autofix = new Autofix()
        .with(ReduceMemorySize);

    // Code Inspections
    const codeInspection = new AutoCodeInspection();

    // Versioners
    const mavenVersion = new Version().withVersioner(MavenProjectVersioner);

    const externalBuild = new Build()
        .with({
            externalTool: "jenkins",
            pushTest: hasJenkinsfile,
        });

    // Ext Packs setup
    sdm.addExtensionPacks(
        pack.goalState.GoalState,
//        pack.githubGoalStatus.GitHubGoalStatus,
    );

    // global
    const GlobalGoals = goals("global")
        .plan(autofix, codeInspection, pushImpact);

    // Rules
    sdm.addGoalContributions(goalContributors(
        onAnyPush()
            .setGoals(GlobalGoals),

        whenPushSatisfies(IsMaven)
            .setGoals(goals("maven-external").plan(mavenVersion, externalBuild)),
    ));
    return sdm;
}
