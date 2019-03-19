import { GoalWithFulfillment, IndependentOfEnvironment } from "@atomist/sdm";

export const myFirstGoal = new GoalWithFulfillment({
  uniqueName: "myFirstGoal",
  displayName: "myFirstGoalDisplayName",
  environment: IndependentOfEnvironment,
})
  .with({
    name: "myFirstFulfilment",
  });
