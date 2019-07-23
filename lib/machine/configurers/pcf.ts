import { GoalConfigurer } from "@atomist/sdm-core";
import { MyGoals } from "../goals";
import { CloudFoundryDeploymentStrategy } from "@atomist/sdm-pack-cloudfoundry";

export const PcfDeployConfigurator: GoalConfigurer<MyGoals> = async (sdm, goals) => {
  goals.pcfProductionDeploy
    .with({ environment: "production", strategy: CloudFoundryDeploymentStrategy.API });

  goals.pcfStagingDeploy
    .with({ environment: "staging", strategy: CloudFoundryDeploymentStrategy.API });
};
