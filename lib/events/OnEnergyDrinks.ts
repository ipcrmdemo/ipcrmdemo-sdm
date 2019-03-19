import { EventHandlerRegistration, findSdmGoalOnCommit, Goal, SdmGoalState, updateGoal } from "@atomist/sdm";
import { GitHubRepoRef, GraphQL, OnEvent, Success } from "@atomist/automation-client";
import * as types from "../typings/types";

function onEnergyDrinksEventHandler(goal: Goal):
  OnEvent<types.OnEnergyDrinks.Subscription> {
  return async (e, ctx) => {
    // e.data.EnergyDrinks[0].sha
    const result = await ctx.graphClient.query<types.EnergyDrinkLookup.Query, types.EnergyDrinkLookup.Variables>({
      name: "EnergyDrinkLookup",
      variables: {
        sha: e.data.EnergyDrinks[0].sha,
      },
    });

    const repoRef = GitHubRepoRef.from({
      owner: result.Push[0].commits[0].repo.owner,
      repo:  result.Push[0].commits[0].repo.name,
      sha: result.Push[0].commits[0].sha,
      branch: result.Push[0].branch,
    });

    const realGoal = await findSdmGoalOnCommit(
      ctx, repoRef, result.Push[0].commits[0].repo.org.scmProvider.providerId, goal);

    await updateGoal(ctx, realGoal, {
      state: SdmGoalState.success,
      description: goal.successDescription,
    });
    return Success;
  };
}

export const OnEnergyDrinksEvents = (goal: Goal):
  EventHandlerRegistration<types.OnEnergyDrinks.Subscription> => {
  return {
    name: "OnEnergyDrinkEvent",
    subscription: GraphQL.subscription("OnEnergyDrinks"),
    listener: onEnergyDrinksEventHandler(goal),
  };
};

