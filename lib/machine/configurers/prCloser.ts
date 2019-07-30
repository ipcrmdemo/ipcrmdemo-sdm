import { GoalConfigurer } from "@atomist/sdm-core";
import { MyGoals } from "../goals";
import { GetPrsForBranch } from "../../typings/types";
import { execPromise, slackInfoMessage } from "@atomist/sdm";
import { logger, TokenCredentials } from "@atomist/automation-client";
import * as _ from "lodash";
import * as GithubApi from "@octokit/rest";

export const PrCloserConfigurator: GoalConfigurer<MyGoals> = async (sdm, goals) => {
  goals.pushImpact.withListener(
    async i => {
      /**
       * Go find all the PRs opened where the destination branch is the branch we are currently operating on
       */
      const repos = await i.context.graphClient.query<GetPrsForBranch.Query, GetPrsForBranch.Variables>({
        name: "GetPrsForBranch",
        variables: {
          owner: i.push.repo.owner,
          repo: i.push.repo.name,
          branch: i.push.branch,
        },
      });

      /**
       * The Push Impact goal does a shallow clone (depth=2).  We need more history to compare branches
       */
      await execPromise("git", ["fetch", "origin", `--depth=1000`], { cwd: i.project.baseDir });

      /**
       * Find all open PRs targeting this branch
       */
      const prsOnThisBranch = _.flatten(repos.Repo[0].branches.map(b => b.pullRequests));
      const closeThesePrs: Array<{number: number, branch: string}> = [];

      /**
       * If no open PRs are found exit successfully
       */
      if (prsOnThisBranch.length === 0) {
        return {
          code: 0,
        };
      }

      /**
       * For each one, check if there is a difference between this branch and sourceBranch
       */
      for (const opr of prsOnThisBranch) {
        try {
          // Fetch the remote branch to a local reference
          await execPromise("git",
            ["fetch", "origin", `${opr.sourceBranch.name}:${opr.sourceBranch.name}`],
            { cwd: i.project.baseDir },
          );
        } catch (e) {
          logger.error(`Failed to fetch upstream branch ${opr.sourceBranch.name} `
          + `for repo ${i.push.repo.owner}/${i.push.repo.name}.  Error => ${JSON.stringify(e)}`);
          continue;
        }

        try {
          // Perform a non-committing merge.  This allows us to check if the repo is dirty post-merge
          await execPromise("git",
            [ "merge", "--no-commit", "--no-ff", `${opr.sourceBranch.name}`],
            {
                    cwd: i.project.baseDir,
                  },
          );

          /**
           * If the project is clean there were no changes staged in the merge above, meaning there is no valid diffs.
           * If it is clean, add it to the list of PRs that need to be closed
           */
          if (await i.project.isClean()) {
            closeThesePrs.push({ number: opr.number, branch: opr.sourceBranch.name });
          } else {
            logger.info(`Not Closing PR#${opr.number} - ${opr.name}, there are valid changes to merge.`);
          }
        } catch (e) {
          /**
           * We could have gotten an error for a few reasons, but most likely it was merge conflicts -
           * which could be valid changes that need to be applied
           */
          logger.error(`Not closing PR#${opr.number} - ${opr.name}, error found comparing => ${e}`);
        } finally {
          // After the comparison for this PR reset our working dir back to HEAD before another comparison
          await execPromise(
            "git",
            [ "reset", "--hard", "HEAD"],
            {
              cwd: i.project.baseDir,
            });
        }
      }

      /**
       * For each PR that needs to be closed
       * - Create a new PR comment saying why the PR is being closed
       * - Close the PR
       * - Delete the sourceBranch
       * - Send a message to the channel saying it was purged
       */
      logger.debug(`Found the following PR numbers to close ${JSON.stringify(closeThesePrs)}`);
      for (const closePr of closeThesePrs) {
        const gh = new GithubApi({
          auth: `token ${(i.credentials as TokenCredentials).token}`,
        });
        const data = {
          owner: i.push.repo.owner,
          repo: i.push.repo.name,
        };

        await gh.issues.createComment({
          ...data,
          issue_number: closePr.number,
          body: `Atomist closed this PR because it no longer contains any valid changes.`,
        });

        await gh.pulls.update({ ...data, pull_number: closePr.number, state: "closed"});
        await gh.git.deleteRef({ ...data, ref: `heads/${closePr.branch}` });

        await i.addressChannels(slackInfoMessage(
          `Closed PR#${closePr.number} and deleted branch ${closePr.branch}`,
          `The base branch for this PR is already up to date with ${i.push.branch}`,
        ));
      }

      return {
        code: 0,
      };
    },
  );
};
