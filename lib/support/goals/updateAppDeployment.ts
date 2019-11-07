import { GoalExecutionListener } from "@atomist/sdm";
import { addressEvent } from "@atomist/automation-client";

export function updateAppDeployment(infrastructure: string): GoalExecutionListener {
  return async gi => {
    const data = {
      afterSha: gi.goalEvent.push.after.sha,
      branch: gi.goalEvent.push.branch,
      environment: gi.goalEvent.environment,
      infrastructure,
      ts: Date.now(),
      state: gi.goalEvent.state,
      endpoint:
        gi.goalEvent.hasOwnProperty("externalUrls") &&
        gi.goalEvent.externalUrls &&
        gi.goalEvent.externalUrls.length > 0 ? gi.goalEvent.externalUrls[0].url : undefined,
    };
    await gi.context.messageClient.send(data, addressEvent("AppDeployment"));
  };
}
