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
import * as axios from "axios";

export const AddJenkinsfileTransform: CodeTransform<NoParameters> = async (p, inv) => {
    const newJenkinsfile = await axios.default
        .get("https://raw.githubusercontent.com/ipcrmdemo/spring-rest-jenkins/master/Jenkinsfile");
    if (await p.hasFile("pom.xml")) {
        await p.addFile("Jenkinsfile", newJenkinsfile.data);
    }
    return p;
};
const AtomistGeneratedMarker = "[atomist:generated]";
const AddJenkinsfileMarker = "[atomist:add-jenkinsfile]";

export const AddJenkinsfileRegistration: CodeTransformRegistration = {
    transform: AddJenkinsfileTransform,
    name: "AddJenkinsfileTransform",
    intent: "Add Jenkinsfile",
    transformPresentation: () => new PullRequest(
        `add-jenkinsfile-${Date.now()}`,
        "Add a Jenkinsfile",
        `Adding a Jenkinsfile to enable build in external system
    ${AtomistGeneratedMarker}`,
        `Add Jenkinsfile
${AddJenkinsfileMarker}`),
};