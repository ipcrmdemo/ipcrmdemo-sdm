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
} from "@atomist/sdm";
import * as _ from "lodash";

export const AddDockerfileTransform: CodeTransform<NoParameters> = async (p, inv) => {
    const name = _.get(inv, "parameters.target.repo") || p.name;
    if (await p.hasFile("pom.xml")) {
        await p.addFile("Dockerfile", dockerFile(name));
        await p.addFile(".dockerignore", dockerIgnore(name));
    }
    return p;
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

function dockerFile(name: string): string {
    // tslint:disable:max-line-length
    return `FROM openjdk:8-alpine

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
}

function dockerIgnore(name: string): string {
    return `*
!target/${name}.jar
`;
}
