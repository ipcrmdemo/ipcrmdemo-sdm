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

import { Configuration, logger } from "@atomist/automation-client";
import {
    ConfigureOptions,
    configureSdm,
} from "@atomist/sdm-core";
import { machine } from "./machine/machine";
import * as bodyParser from "body-parser";

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
                            logger.debug(`BuildEvent Payload: ${JSON.stringify(req.body)}`);
                        });

                    },
                );

                return config;
            },
        configureSdm(machine, machineOptions),
    ],
};
