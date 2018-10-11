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

import { NoParameters, PullRequest } from "@atomist/automation-client";
import {
    AutofixRegistration,
    CodeTransform,
    CodeTransformRegistration,
    logger,
} from "@atomist/sdm";
import { parse } from "docker-file-parser";

const newMaintainer = "ipcrm <ipcrm@noreply.com>";

export const AddDockerfileMaintainerTransform: CodeTransform<NoParameters> = async (p, inv) => {
    if (await p.hasFile("pom.xml") && await p.hasFile("Dockerfile")) {
        const dF = await p.getFile("Dockerfile");
        let currentDockerFile = await dF.getContent();
        const parsedDockerFile = parse(await currentDockerFile, { includeComments: false});

        for (const cmd of parsedDockerFile) {
            if (cmd.name === "MAINTAINER" && cmd.args !== newMaintainer) {
                logger.debug(`DEBUG - ${cmd.name}`);
                currentDockerFile = currentDockerFile
                    .replace(/(\s+)?MAINTAINER.*/i, `\nMAINTAINER ${newMaintainer}\n`);
                logger.debug(`${currentDockerFile}`);
            }
        }

        await dF.setContent(currentDockerFile);
    }
    return p;
};
const AtomistGeneratedMarker = "[atomist:generated]";
const DockerfileMaintainerMarker = "[atomist:update-dockerfile-maintainer]";

export const UpdateDockerfileMaintainer: CodeTransformRegistration = {
    transform: AddDockerfileMaintainerTransform,
    name: "UpdateDockerFileMainatiner",
    intent: "Update Dockerfile Maintainer",
    transformPresentation: () => new PullRequest(
        `update-dockerfile-maintainer-${Date.now()}`,
        "Update dockerfile maintainer",
        `Change the dockerfile maintainer.
    ${AtomistGeneratedMarker}`,
        `Update Dockerfile Maintainer
${DockerfileMaintainerMarker}`),
};

export const UpdateDockerfileMaintainerAutofix: AutofixRegistration<NoParameters> = {
    name: "Dockerfile",
    transform: AddDockerfileMaintainerTransform,
};
