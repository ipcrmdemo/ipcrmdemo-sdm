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
  BitBucketServerRepoRef,
  Configuration,
  configurationValue,
  ProjectOperationCredentials, RemoteRepoRef,
  Value,
} from "@atomist/automation-client";
import {
  ConfigurationBasedBasicCredentialsResolver,
  ConfigureOptions,
  configureSdm,
} from "@atomist/sdm-core";
import { machine } from "./lib/machine/machine";
import { BitBucketRepoCreationParameters } from "@atomist/sdm";
import { BasicAuthCredentials } from "@atomist/automation-client/lib/operations/common/BasicAuthCredentials";

const machineOptions: ConfigureOptions = {
  requiredConfigurationValues: [],
};

export const configuration: Configuration = {
  sdm: {
    credentialsResolver: new ConfigurationBasedBasicCredentialsResolver(),
  },
  postProcessors: [
    configureSdm(machine, machineOptions),
  ],
};

export function bitBucketCredentials(): BasicAuthCredentials {
  return {
    username: configurationValue<string>("sdm.git.user"),
    password: configurationValue<string>("sdm.git.password"),
  };
}

export class FixedRepoCreationParameters extends BitBucketRepoCreationParameters {
  @Value("sdm.git.url")
  public apiUrl: string;

  get credentials(): ProjectOperationCredentials {
    return bitBucketCredentials();
  }

  get repoRef(): RemoteRepoRef {
    return new BitBucketServerRepoRef(
      this.apiUrl,
      this.owner, this.repo,
      true);
  }
}
