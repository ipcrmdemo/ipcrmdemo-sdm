import { EventHandlerRegistration } from "@atomist/sdm";
import * as types from "../typings/types";
import {
    GraphQL, OnEvent, Success, logger,
} from "@atomist/automation-client";

function onJiraIssueLifecycleEventHandler(): OnEvent<types.OnJiraIssueLifecycleEvent.Subscription> {
    return async (e, ctx) => {
        logger.debug(`JIRA: Event recieved, ${JSON.stringify(e.data.JiraIssueLifecycleEvent)}`);
        return Success;
    };
}

export const onJiraIssueLifecycleEvent = (): EventHandlerRegistration<types.OnJiraIssueLifecycleEvent.Subscription> => {
    return {
        name: "OnJiraIssueLifecycleEvent",
        subscription: GraphQL.subscription("OnJiraIssueLifecycleEvent"),
        listener: onJiraIssueLifecycleEventHandler(),
    };
};
