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

import { Configuration, HttpMethod, logger } from "@atomist/automation-client";
import {
    ConfigureOptions,
    configureSdm,
} from "@atomist/sdm-core";
import { machine } from "./machine/machine";
import * as bodyParser from "body-parser";
import _ = require("lodash");

const machineOptions: ConfigureOptions = {
    requiredConfigurationValues: [],
};

export const configuration: Configuration = {
    postProcessors: [
            async config => {
                config.http.customizers.push(
                    c => {
                        c.use(bodyParser.urlencoded({extended: true}));
                        c.use(bodyParser.json());

                        c.post("/buildevent", async (req, res) => {
                            res.send(JSON.stringify(req.body));
                            const buildDetails = _.get(req.body, "build");

                            interface TeamCityProperties {
                                name: string;
                                value: string;
                            }

                            const tcDetails = _.get(buildDetails, "teamcityProperties") as TeamCityProperties[];
                            const branch = tcDetails.filter( n =>
                                n.name === "vcsroot.branch")[0].value.split("/").pop();
                            const repo = tcDetails.filter(
                                r => r.name === "vcsroot.url")[0].value.split("/").pop();
                            const org = tcDetails.filter(
                                d => d.name === "vcsroot.url")[0].value.split("/").slice(-2)[0];

                            let buildResult: string;
                            switch (_.get(buildDetails, "buildResult")) {
                                case "running":
                                    buildResult = "started";
                                    break;
                                case "failure":
                                    buildResult = "failed";
                                    break;
                                case "success":
                                    buildResult = "passed";
                                    break;
                            }

                            const pushResult = {
                                branch,
                                build_url: _.get(buildDetails, "buildStatusUrl"),
                                commit: tcDetails.filter( n => _.get(n, "name") === "build.vcs.number")[0].value,
                                id: _.get(buildDetails, "buildNumber"),
                                name: _.get(buildDetails, "projectName"),
                                number: _.get(buildDetails, "buildNumber"),
                                provider: "team_city",
                                repository: {
                                    name: repo,
                                    owner_name: org,
                                },
                                status: buildResult,
                                type: "push",
                            };
                            logger.debug(`BuildEvent Payload: ${JSON.stringify(pushResult)}`);

                            // tslint:disable-next-line:max-line-length
                            const url = `https://webhook.atomist.com/atomist/build/teams/${config.workspaceIds.pop()}`;
                            const httpClient = config.http.client.factory.create(url);

                            const result = await httpClient.exchange(
                                url, { method: HttpMethod.Post, body: JSON.stringify(pushResult) });

                            logger.debug(`BuildEvent Push result: ${JSON.stringify(result)}`);

                        });

                    },
                );

                return config;
            },
        configureSdm(machine, machineOptions),
    ],
};
