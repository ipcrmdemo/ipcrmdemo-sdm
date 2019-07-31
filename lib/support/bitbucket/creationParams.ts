import { bitBucketCredentials } from "./auth";
import { BitBucketServerRepoRef, ProjectOperationCredentials, RemoteRepoRef, Value } from "@atomist/automation-client";
import {
  NewRepoCreationParameters,
} from "@atomist/automation-client/lib/operations/generate/NewRepoCreationParameters";

export class FixedRepoCreationParameters extends NewRepoCreationParameters {
  @Value("sdm.git.url")
  public apiUrl: string;

  get credentials(): ProjectOperationCredentials {
    return bitBucketCredentials();
  }

  /**
   * Return a single RepoRef or undefined if we're not identifying a single repo
   * This implementation returns a GitHub.com repo but it can be overriden
   * to return any kind of repo
   * @return {RepoRef}
   */
  get repoRef(): RemoteRepoRef {
    return new BitBucketServerRepoRef(
      this.apiUrl,
      this.owner, this.repo,
      true);
  }

}
