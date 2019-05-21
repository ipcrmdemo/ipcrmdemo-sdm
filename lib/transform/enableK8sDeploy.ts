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

export const enableK8sDeploy: CodeTransform<NoParameters> = async (p, inv) => {
    await addDockerfileIfMissing(p, inv);
    await p.addDirectory(".atomist");
    await p.addDirectory(".atomist/kubernetes");
    await p.addFile(".atomist/kubernetes/deployment.json", "{}");
    return p;
};
const AtomistGeneratedMarker = "[atomist:generated]";
const AddDockerfileMarker = "[atomist:add-k8s-details]";

export const enableK8sDeployRegistration: CodeTransformRegistration = {
    transform: enableK8sDeploy,
    name: "EnableK8sDeploy",
    intent: "Enable K8s Deployment",
    transformPresentation: () => new PullRequest(
        `enable-k8s-deploy-${Date.now()}`,
        "Enable K8s deployment",
        `Adding a dockerfile and empty K8s deployment spec file
    ${AtomistGeneratedMarker}`,
        `Add K8s Deployment info
${AddDockerfileMarker}`),
};
