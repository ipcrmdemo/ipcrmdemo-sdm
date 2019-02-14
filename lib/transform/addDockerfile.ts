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
import * as _ from "lodash";
import { PullRequest } from "@atomist/automation-client/lib/operations/edit/editModes";
import { BuildAwareMarker } from "@atomist/sdm-pack-build";
import { ConfigurationBasedBasicCredentialsResolver } from "@atomist/sdm-core";

export const AddDockerfileTransform: CodeTransform<NoParameters> = async (p, inv) => {
    const name = _.get(inv, "parameters.target.repo") || p.name;
    if (await p.hasFile("pom.xml")) {
        await p.addFile("Dockerfile", dockerFile(name, "maven"));
        await p.addFile(".dockerignore", dockerIgnore(name));
    } else if (await p.hasFile("package.json")) {
        await p.addFile("Dockerfile", dockerFile(name, "node"));
    }
    return p;
};
const AtomistGeneratedMarker = "[atomist:generated]";
const AddDockerfileMarker = "[atomist:add-dockerfile-manifest]";

export const AddDockerFile: CodeTransformRegistration = {
    transform: AddDockerfileTransform,
    name: "AddDockerFileTransform",
    intent: "Add Dockerfile",
    paramsMaker: ConfigurationBasedBasicCredentialsResolver,
    transformPresentation: () => new PullRequest(
        `add-dockerfile-${Date.now()}`,
        "Add a dockerfile",
        `Adding a dockerfile to enable build/deployment in container format.
    ${AtomistGeneratedMarker} ${BuildAwareMarker}`,
        `Add Dockerfile
${AddDockerfileMarker} ${BuildAwareMarker}`),
};

export const AddDockerfileAutofix: AutofixRegistration<NoParameters> = {
    name: "Dockerfile",
    transform: AddDockerfileTransform,
};

function dockerFile(name: string, type: "maven" | "node"): string {
    // tslint:disable:max-line-length
    const maven = `FROM openjdk:8-alpine

RUN wget -O /usr/local/bin/dumb-init https://github.com/Yelp/dumb-init/releases/download/v1.2.2/dumb-init_1.2.2_amd64 && \\
chmod 755 /usr/local/bin/dumb-init

MAINTAINER Atomist <docker@atomist.com>

RUN mkdir -p /opt/app

WORKDIR /opt/app

EXPOSE 8080

CMD ["-jar", "${name}.jar"]

ENTRYPOINT ["/usr/local/bin/dumb-init", "java", "-XX:+UnlockExperimentalVMOptions", "-XX:+UseCGroupMemoryLimitForHeap", "-Xmx256m", "-Djava.security.egd=file:/dev/urandom"]

COPY target/${name}.jar ${name}.jar
`;

    const node = `FROM node:10

# Create app directory
WORKDIR /usr/src/app

# Install req'd
COPY package*.json ./
RUN npm install --only=production

# Bundle app source
RUN mkdir dist
COPY dist/. dist/.

# Configure
EXPOSE 3000
CMD [ "npm", "start" ]
    `;

    if (type === "maven") {
        return maven;
    } else if (type === "node") {
        return node;
    } else {
        throw new Error("Invalid Dockerfile type requested!");
    }
}

function dockerIgnore(name: string): string {
    return `*
!target/${name}.jar
`;
}
