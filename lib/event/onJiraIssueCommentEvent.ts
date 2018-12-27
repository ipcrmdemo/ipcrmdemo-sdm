import { EventHandlerRegistration } from "@atomist/sdm";
import { GraphQL, OnEvent, logger, Success } from "@atomist/automation-client";
import * as types from "../typings/types";

function onJiraIssueCommmentEventHandler(): OnEvent<types.OnJiraIssueCommentEvent.Subscription> {
    return async (e, ctx) => {
        logger.debug(`JIRA Issue Comment Event recieved, ${JSON.stringify(e.data.JiraIssueCommentEvent)}`);
        return Success;
    };
}

export const onJiraIssueCommmentEvent = (): EventHandlerRegistration<types.OnJiraIssueCommentEvent.Subscription> => {
   return {
       name: "OnJiraIssueCommentEvent",
       subscription: GraphQL.subscription("OnJiraIssueCommentEvent"),
       listener: onJiraIssueCommmentEventHandler(),
   };
};
