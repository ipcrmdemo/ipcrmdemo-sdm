import { GoalProjectListenerRegistration, spawnLog } from "@atomist/sdm";
import { configurationValue } from "@atomist/automation-client";
import * as _ from "lodash";

/**
 * ECRCreateRepository: This project listener creates new ECR repositories dynamically only if one does not already
 * exist.  It requires two things; the AWS CLI is installed, and that either credentials are configured on the host
 * filesystem, or (more commonly) an IAM role is applied to the compute environment.
 */
export const ECRCreateRepository: GoalProjectListenerRegistration = {
  name: "ECRCreateRepository",
  listener: async (p, r, event1) => {
    if (event1 === "before") {
      const result = await spawnLog(
       "aws",
       ["ecr", "describe-repositories", `--region=${configurationValue<string>("sdm.aws.region")}`],
        {
          cwd: p.baseDir,
          log: r.progressLog,
        },
      );

      // Get all the existing repos
      const repos: Array<{repositoryName: string}> = _.get(result.stdout, "repositories");
      const names = repos.map(repo => repo.repositoryName);

      // If our project name doesn't have a repo, create one
      if (!names.includes(p.name)) {
        await spawnLog(
          "aws",
          [
            "ecr",
            "create-repository",
            "--repository-name",
            p.name,
            `--region=${configurationValue<string>("sdm.aws.region")}`,
          ],
          {
            cwd: p.baseDir,
            log: r.progressLog,
          },
        );
      }
    }
  },
};
