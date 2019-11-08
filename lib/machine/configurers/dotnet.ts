import { GoalConfigurer } from "@atomist/sdm-core";
import { MyGoals } from "../goals";
import { HasDockerfile } from "@atomist/sdm-pack-docker";
import {
  dotnetCoreBuilder,
  DotnetCoreProjectVersioner,
} from "@atomist/sdm-pack-analysis-dotnet";
import { isDotNetCore } from "../../support/dotnet/support";
import { allSatisfied, LogSuppressor, not } from "@atomist/sdm";
import { hasJenkinsfile } from "../../support/pushTests/preChecks";

export const DotNetCoreGoalConfigurator: GoalConfigurer<MyGoals> = async (sdm, goals) => {
  goals.version.with({
    name: "dotnet-versioner",
    pushTest: isDotNetCore,
    versioner: DotnetCoreProjectVersioner,
  });

  goals.build
    .with({
      logInterpreter: LogSuppressor,
      name: "dotnet-build",
      pushTest: allSatisfied(isDotNetCore, not(hasJenkinsfile)),
      builder: dotnetCoreBuilder(),
    });

  goals.dockerBuild
    .with({
      push: true,
      registry:  {
        ...sdm.configuration.sdm.dockerinfo,
      },
      pushTest: allSatisfied(isDotNetCore, HasDockerfile),
    });
};
