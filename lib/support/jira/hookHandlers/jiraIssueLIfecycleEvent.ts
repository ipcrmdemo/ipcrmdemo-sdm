import { JiraIssueWebhook } from "../issueDefs";
import { logger } from "@atomist/automation-client";

/**
 * Handler for Jira Issue creation/deletion
 * @param {JiraIssueWebhook} payload the payload of a Jira webhook for issue lifecycle evenets (created/deleted)
 */
export const jiraIssueLifecycleEvent = (payload: JiraIssueWebhook) => {
    if (payload.issue_event_type_name === "issue_created") {
        logger.debug(
            `jiraIssueLifecycleEvent: Issue created ${payload.issue.key} (${payload.issue.self}) in project` +
            `${payload.issue.fields.project.name}: ` +
            `${payload.issue.fields.summary} / ${payload.issue.fields.description}`);

        // TODO - Create an interface for this
        const responseData = {
            key: payload.issue.key,
            link: payload.issue.self,
            project: payload.issue.fields.project.name,
            summary: payload.issue.fields.summary,
            description: payload.issue.fields.description,
            author: {
                self: payload.issue.fields.creator.self,
                name: payload.issue.fields.creator.name,
                key: payload.issue.fields.creator.key,
                emailAddress: payload.issue.fields.creator.emailAddress,
                displayName: payload.issue.fields.creator.displayName,
                active: payload.issue.fields.creator.active,
                timeZone: payload.issue.fields.creator.timeZone,
            },
            state: "CREATED",
            ts: Date.now(),
        };
        return responseData;
    } else {
        logger.debug(`jiraIssueLifecycleEvent: ${payload.issue.key} deleted`);

        // TODO - Create an interface for this
        const responseData = {
            key: payload.issue.key,
            link: undefined,
            project: undefined,
            summary: payload.issue.fields.summary,
            description: undefined,
            author: undefined,
            state: "DELETED",
            ts: Date.now(),
        };
        return responseData;
    }
};
