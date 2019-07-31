import { FixedBitBucketRepoTargets } from "./targets";
import { ConfigurationBasedBasicCredentialsResolver } from "@atomist/sdm-core";
import { ConfigurationPostProcessor } from "@atomist/automation-client";

/**
 * Setup targets and creds resolver for BB
 * @param {Configuration} config
 */
export const bitbucketPostProcessor: ConfigurationPostProcessor = async config => {
  config.sdm.targets = FixedBitBucketRepoTargets;
  config.sdm.credentialsResolver = new ConfigurationBasedBasicCredentialsResolver();

  return config;
};
