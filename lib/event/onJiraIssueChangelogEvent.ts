import { EventHandlerRegistration } from "@atomist/sdm";
import { GraphQL, OnEvent, logger, Success } from "@atomist/automation-client";
import * as types from "../typings/types";

function onJiraIssueChangelogEventHandler(): OnEvent<types.OnJiraIssueChangelogEvent.Subscription> {
    return async (e, ctx) => {
        logger.debug(`JIRA Issue Changelog Event recieved, ${JSON.stringify(e.data.JiraIssueChangelogEvent)}`);
        return Success;
    };
}

export const onJiraIssueChangelogEvent = (): EventHandlerRegistration<types.OnJiraIssueChangelogEvent.Subscription> => {
   return {
       name: "OnJiraChangelogEvent",
       subscription: GraphQL.subscription("OnJiraIssueChangelogEvent"),
       listener: onJiraIssueChangelogEventHandler(),
   };
};
