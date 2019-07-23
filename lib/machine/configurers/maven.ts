import { IsMaven, mavenBuilder, MavenDefaultOptions, MavenProjectVersioner } from "@atomist/sdm-pack-spring";
import { cachePut, cacheRemove, cacheRestore, GoalConfigurer } from "@atomist/sdm-core";
import { MyGoals } from "../goals";
import { HasDockerfile } from "@atomist/sdm-pack-docker";
import { allSatisfied, not } from "@atomist/sdm";
import { mavenJarCache } from "../cache";
import { hasJenkinsfile } from "../../support/preChecks";

export const MavenGoalConfigurator: GoalConfigurer<MyGoals> = async (sdm, goals) => {
  goals.version.with({
    name: "maven-versioner",
    pushTest: IsMaven,
    versioner: MavenProjectVersioner,
  });

  goals.build
    .with({
      ...MavenDefaultOptions,
      name: "maven-run-build",
      builder: mavenBuilder(),
      pushTest: allSatisfied(MavenDefaultOptions.pushTest, not(hasJenkinsfile)),
  })
    .withProjectListener(cachePut(mavenJarCache));

  goals.dockerBuild.with({
    push: true,
    registry:  {
      ...sdm.configuration.sdm.dockerinfo,
    },
    pushTest: allSatisfied(IsMaven, HasDockerfile),
  })
    .withProjectListener(cacheRestore(mavenJarCache))
    .withProjectListener(cacheRemove(mavenJarCache));
};
