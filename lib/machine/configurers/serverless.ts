import { GoalConfigurer } from "@atomist/sdm-core";
import { MyGoals } from "../goals";

export const ServerlessConfigurer: GoalConfigurer<MyGoals> = async (sdm, goals) => {
  goals.serverless.with({
    deployArgs: {
      stage: "dev",
    },
  });
};
