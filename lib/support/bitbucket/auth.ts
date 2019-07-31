import { BasicAuthCredentials } from "@atomist/automation-client/lib/operations/common/BasicAuthCredentials";
import { configurationValue } from "@atomist/automation-client";

export function bitBucketCredentials(): BasicAuthCredentials {
  return {
    username: configurationValue<string>("sdm.git.user"),
    password: configurationValue<string>("sdm.git.password"),
  };
}
