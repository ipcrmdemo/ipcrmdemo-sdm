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

import { NoParameters } from "@atomist/automation-client";
import {
    CodeTransform,
    CodeTransformRegistration,
} from "@atomist/sdm";
import { PullRequest } from "@atomist/automation-client/lib/operations/edit/editModes";
import { addDockerfileIfMissing } from "./shared/createDockerfile";

export const enableEcsDeploy: CodeTransform<NoParameters> = async (p, inv) => {
    await addDockerfileIfMissing(p, inv);
    await p.addDirectory(".atomist");
    await p.addDirectory(".atomist/ecs");
    await p.addFile(".atomist/ecs/task-definition.json", "{}");
    await p.addFile(".atomist/ecs/service.json", "{}");

    return p;
};
const AtomistGeneratedMarker = "[atomist:generated]";
const AddDockerfileMarker = "[atomist:add-ecs-details]";

export const enableEcsDeployRegistration: CodeTransformRegistration = {
    transform: enableEcsDeploy,
    name: "EnableEcsDeploy",
    intent: "Enable ECS Deployment",
    transformPresentation: () => new PullRequest(
        `enable-ecs-deploy-${Date.now()}`,
        "Enable ECS deployment",
        `Adding a dockerfile and empty ECS task and service definitions
    ${AtomistGeneratedMarker}`,
        `Add ECS Deployment info
${AddDockerfileMarker}`),
};

