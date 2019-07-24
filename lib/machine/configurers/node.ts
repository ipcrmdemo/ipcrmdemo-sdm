import { MyGoals } from "../goals";
import { cachePut, cacheRemove, cacheRestore, GoalConfigurer } from "@atomist/sdm-core";
import { HasDockerfile } from "@atomist/sdm-pack-docker";
import {
  IsNode,
  nodeBuilder,
  NodeProjectVersioner,
  NpmCompileProjectListener,
  NpmProgressReporter,
  NpmVersionProjectListener,
} from "@atomist/sdm-pack-node";
import { allSatisfied, LogSuppressor, not } from "@atomist/sdm";
import { NodeModulesCacheOptions } from "../cache";
import { hasJenkinsfile } from "../../support/preChecks";

export const NodeGoalConfigurator: GoalConfigurer<MyGoals> = async (sdm, goals) => {
  goals.version.with({
    name: "node-versioner",
    pushTest: IsNode,
    versioner: NodeProjectVersioner,
  });

  goals.build
    .with({
      logInterpreter: LogSuppressor,
      progressReporter: NpmProgressReporter,
      name: "node-run-build",
      pushTest: allSatisfied(IsNode, not(hasJenkinsfile)),
      builder: nodeBuilder(
        {
          command: "npm",
          args: ["install"],
        },
        {
          command: "npm",
          args: ["run", "build"],
        },
      ),
    })
    .withProjectListener(cachePut(NodeModulesCacheOptions));

  goals.dockerBuild
    .with({
      push: true,
      registry:  {
        ...sdm.configuration.sdm.dockerinfo,
      },
      pushTest: allSatisfied(IsNode, HasDockerfile),
    })
    .withProjectListener(cacheRestore(NodeModulesCacheOptions))
    .withProjectListener(NpmCompileProjectListener)
    .withProjectListener(NpmVersionProjectListener)
    .withProjectListener(cacheRemove(NodeModulesCacheOptions));
};
