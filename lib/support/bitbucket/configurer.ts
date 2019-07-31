import { GoalConfigurer } from "@atomist/sdm-core";
import { MyGoals } from "../../machine/goals";
import { firstPushToBitbucket } from "./firstPushListener";

export const BitBucketConfigurer: GoalConfigurer<MyGoals> = async (sdm, goals) => {
  sdm.addFirstPushListener(firstPushToBitbucket);
};
