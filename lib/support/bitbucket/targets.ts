import { BitBucketRepoTargets } from "@atomist/sdm";
import { automationClientInstance, BitBucketServerRepoRef } from "@atomist/automation-client";

export class FixedBitBucketRepoTargets extends BitBucketRepoTargets {
  get repoRef(): BitBucketServerRepoRef {
    return (!!this.owner && !!this.repo && !this.usesRegex) ?
      new BitBucketServerRepoRef(
        automationClientInstance().configuration.sdm.git.url,
        this.owner, this.repo,
        true,
        this.branch ? this.branch : this.sha) :
      undefined;
  }
}
