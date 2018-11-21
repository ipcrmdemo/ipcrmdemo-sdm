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
    Fingerprint,
    goals,
    onAnyPush,
    PushImpact,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    ParametersObject,
    CodeTransform,
} from "@atomist/sdm";
import {
    createSoftwareDeliveryMachine,
    DisableDeploy,
    DisplayDeployEnablement,
    EnableDeploy,
    goalState,
} from "@atomist/sdm-core";
import {
    kubernetesSupport,
} from "@atomist/sdm-pack-k8";
import {
    springSupport,
} from "@atomist/sdm-pack-spring";
import { changelogSupport } from "@atomist/sdm-pack-changelog";
import { IssueSupport } from "@atomist/sdm-pack-issue";
import { AddDockerFile } from "../transform/addDockerfile";
import { AddJenkinsfileRegistration } from "../transform/addJenkinsfile";
import {
    FixSmallMemory,
    ReduceMemorySize,
} from "../transform/smallMemory";
import { UpdateDockerfileMaintainer } from "../transform/updateDockerFileMaintainer";
import { GitProject, logger, safeExec } from "@atomist/automation-client";
import * as fs from "fs";

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

    // Autofix
    const autofix = new Autofix()
        .with(ReduceMemorySize);

    // Code Inspections
    const codeInspection = new AutoCodeInspection();

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
    );

    // global
    const GlobalGoals = goals("global")
        .plan(autofix, fingerprint, codeInspection, pushImpact);

    // Rules
    sdm.withPushRules(
        onAnyPush()
           .setGoals(GlobalGoals),
     );

    return sdm;
}

export const DropkickTransform: CodeTransform<DropkickProjectCreationParameters> = async (p, parms) => {
    logger.debug("Running dropkick generation, repo " + parms.parameters.aws);
    const cwd = (p as GitProject).baseDir;
    const result = await safeExec("ls", ["-l"], { cwd });
    fs.writeFile(`${cwd}/outfile`, await result.stdout, err => {
            if (err) {
                logger.debug(err.message);
            }
        });
//    }
    return p;
};

export interface DropkickProjectCreationParameters {
    aws: string;
    postgress: string;
}

export const DropkickProjectCreationParameterDefinitions: ParametersObject = {
    aws: {
        pattern: /.*/,
        description: "Should use aws",
        required: true,
    },

    postgress: {
        pattern: /.*/,
        description: "Should use postgress",
        required: true,
    },
};
