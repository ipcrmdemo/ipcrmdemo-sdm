import {
  PredicatePushTest,
  predicatePushTest,
  spawnLog,
  StringCapturingProgressLog,
} from "@atomist/sdm";
import { logger, GitProject } from "@atomist/automation-client";

export const isMaster: PredicatePushTest = predicatePushTest(
    "isMaster",
    async p => {
        return p.id.branch === "master";
    },
);

export const hasJenkinsfile: PredicatePushTest = predicatePushTest(
    "hasJenkinsfile",
    async p => {
        return p.hasFile("Jenkinsfile");
    },
);
export const hasTsLintConfig: PredicatePushTest = predicatePushTest(
  "hasTsLintConfig",
  async p => {
    return p.hasFile("tslint.json");
  },
);
export const hasTsConfig: PredicatePushTest = predicatePushTest(
  "hasTsConfig",
  async p => {
    return p.hasFile("tsconfig.json");
  },
);

export const isFirstCommit: PredicatePushTest = predicatePushTest(
    "isFirstCommit",
    async p => {
        const project = p as GitProject;
        const log = new StringCapturingProgressLog();
        const result = await spawnLog(
            "git",
            ["--no-pager", "diff", "HEAD~1"],
            {
                log,
                cwd: project.baseDir,
            },
        );

        if (result.code === 0) {
            logger.debug(`isFirstCommit: resolved to false! Result: ${JSON.stringify(result, undefined, 2)}`);
            return false;
        } else {
            logger.debug(`isFirstCommit: resolved to true! Result: ${JSON.stringify(result, undefined, 2)}`);
            return true;
        }
    },
);

export const npmHasBuildScript: PredicatePushTest = predicatePushTest(
    "npmHasBuildScript",
    async p => {
        if (await p.hasFile("package.json")) {
            const npmFile = await p.getFile("package.json");
            const packageFile = JSON.parse(await npmFile.getContent());
            const hasBuild = packageFile.scripts.hasOwnProperty("build");
            return hasBuild;
        } else {
            return false;
        }
    });
