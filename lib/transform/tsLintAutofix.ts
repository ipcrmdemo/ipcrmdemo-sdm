import {
  DefaultGoalNameGenerator, execPromise,
  ExecuteGoalResult,
  GoalInvocation, GoalWithFulfillment,
  IndependentOfEnvironment,
  SdmGoalState,
} from "@atomist/sdm";
import * as path from "path";
import {mapTslintResultsToReviewComments} from "@atomist/sdm-pack-node/lib/inspection/tslint";
import { logger, ReviewComment } from "@atomist/automation-client";
import { IsNode } from "@atomist/sdm-pack-node";

export const TsLintAutofix = new GoalWithFulfillment({
  displayName: "tslint Autofix",
  uniqueName: "tslint-autofix",
  environment: IndependentOfEnvironment,
  workingDescription: "Running tslint Autofix",
  completedDescription: "TsLint Autofix: No changes applied",
  failedDescription: "TsLint Autofix failed",
  stoppedDescription: "TsLint Autofix: Changes applied",

}).with({
  name: DefaultGoalNameGenerator.generateName("tslint-autofix"),
  pushTest: IsNode,
  goalExecutor: tsLintTransform,
});

export async function tsLintTransform(gi: GoalInvocation): Promise<ExecuteGoalResult> {
  return gi.configuration.sdm.projectLoader.doWithProject({
    credentials: gi.credentials, id: gi.id, context: gi.context, readOnly: false,
  }, p => {
    return new Promise<ExecuteGoalResult>(async (resolve, reject) => {
      const tslintExe = path.join(p.baseDir, "node_modules", ".bin", "tslint");
      const tslintConfig = path.join(p.baseDir, "tslint.json");
      logger.debug(`Running ${tslintExe} using ${tslintConfig} on ${p.name} in ${p.baseDir}`);
      const tslintArgs = [
        "--config", tslintConfig,
        "--format", "json",
        "--project", p.baseDir,
        "--force",
      ];

      const comments: ReviewComment[] = [];
      try {
        const tslintResult = await execPromise(tslintExe, tslintArgs, { cwd: p.baseDir });
        if (tslintResult.stderr) {
          logger.debug(`TSLint standard error from ${p.name}: ${tslintResult.stderr}`);
        }
        const newComments = mapTslintResultsToReviewComments(tslintResult.stdout, p.baseDir);
        comments.push(...newComments);
        await execPromise(tslintExe, [...tslintArgs, "--fix"], { cwd: p.baseDir });
      } catch (e) {
        logger.error(`Failed to run TSLint: ${e.message}`);
        reject({
          code: 1,
          message: `Failed to run TSLint: ${e.message}`,
        });
      }

      if (!(await p.gitStatus()).isClean) {
        // We have a dirty repo, stuff changed
        const msg = comments.map(c => {
          return `${c.severity} - Line ${c.sourceLocation.lineFrom1}: ${c.detail}`;
        });

        // update goal log
        gi.progressLog.write(`TSLint Autofix Changes Applied!:`);
        gi.progressLog.write(msg.join("\n"));

        // Create new commit and push
        await p.commit(`TSLint Autofix Changes Applied!\n${msg.join("\n")}`);
        await p.push();

        // Return stopped state to skip all other goals
        resolve({
          code: 0,
          state: SdmGoalState.stopped,
          message: `Successfully applied tslint autofixes`,
        });
      } else {
        resolve({
          code: 0,
          message: `No Autofixes applied`,
        });
      }
    });
  });
}
