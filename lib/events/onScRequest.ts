import { EventHandlerRegistration, slackInfoMessage } from "@atomist/sdm";
import { GraphQL, logger, OnEvent, Success } from "@atomist/automation-client";
import * as types from "../typings/types";

function onScRequestEventHandler():
  OnEvent<types.OnScRequest.Subscription> {
  return async (e, ctx) => {
    logger.info(`ScRequest Event received, ${JSON.stringify(e.data.ScRequest, undefined, 2)}`);
    await ctx.messageClient.addressUsers(
      slackInfoMessage(`ServiceNow Update`,
        `Request ${e.data.ScRequest[0].reqId} is closed!`),
      e.data.ScRequest[0].screenName,
    )
    return Success;
  };
}

export const onScRequestEvent = ():
  EventHandlerRegistration<types.OnScRequest.Subscription> => {
  return {
    name: "OnScRequest",
    subscription: GraphQL.subscription("OnScRequest"),
    listener: onScRequestEventHandler(),
  };
};
