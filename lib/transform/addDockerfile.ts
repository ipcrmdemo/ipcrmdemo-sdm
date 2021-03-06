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
    AutofixRegistration,
    CodeTransform,
    CodeTransformRegistration,
} from "@atomist/sdm";
import { PullRequest } from "@atomist/automation-client/lib/operations/edit/editModes";
import { addDockerfileIfMissing } from "./shared/createDockerfile";

export const AddDockerfileTransform: CodeTransform<NoParameters> = async (p, inv) => {
    return addDockerfileIfMissing(p, inv);
};

const AtomistGeneratedMarker = "[atomist:generated]";
const AddDockerfileMarker = "[atomist:add-dockerfile-manifest]";
export const AddDockerFile: CodeTransformRegistration = {
    transform: AddDockerfileTransform,
    name: "AddDockerFileTransform",
    intent: "Add Dockerfile",
    transformPresentation: () => new PullRequest(
        `add-dockerfile-${Date.now()}`,
        "Add a dockerfile",
        `Adding a dockerfile to enable build/deployment in container format.
    ${AtomistGeneratedMarker}`,
        `Add Dockerfile
${AddDockerfileMarker}`),
};

export const AddDockerfileAutofix: AutofixRegistration<NoParameters> = {
    name: "Dockerfile",
    transform: AddDockerfileTransform,
};
