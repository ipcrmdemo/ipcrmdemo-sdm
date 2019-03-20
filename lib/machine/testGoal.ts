import { GoalWithFulfillment, IndependentOfEnvironment } from "@atomist/sdm";
import { logger, Success } from "@atomist/automation-client";
// 2019-03-20T02:06:36.640Z [m:8210:15de61ce-a315-410b-8bb9-a63fd5c60792:ipcrmdemo_demo:SetGoalsOnPush:899]
// [error] Failed invocation of event subscription 'SetGoalsOnPush': Multiple matching implementations for goal
// 'testGoal' found: 'testGoalFulfillment1, testGoalFulfillment2, testGoalFulfillment3'

export const testGoal = new GoalWithFulfillment({
  displayName: "Test Goal",
  uniqueName: "testGoal",
  environment: IndependentOfEnvironment,
})
  .with({
    name: "testGoalFulfillment1",
    goalExecutor: () => {
      logger.error(`Test Goal Fulfillment 1`);
      return Success;
    },
  })
  .with({
    name: "testGoalFulfillment2",
    goalExecutor: () => {
      logger.error(`Test Goal Fulfillment 2`);
      return Success;
    },
  })
  .with({
    name: "testGoalFulfillment3",
    goalExecutor: () => {
      logger.error(`Test Goal Fulfillment 3`);
      return Success;
    },
  })
