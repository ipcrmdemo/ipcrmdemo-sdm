import { JiraIssueWebhook } from "../issueDefs";
import { logger } from "@atomist/automation-client";

/**
 * Handler for new Jira Issue comment webhooks
 * @param {JiraIssueWebhook} payload the payload of a Jira webhook for issue comments
 */
export const jiraIssueComment = (payload: JiraIssueWebhook) => {
    logger.debug(
        `New comment on issue ${payload.issue.key} (${payload.issue.self}) in project` +
        `${payload.issue.fields.project.name}: ${payload.comment.body}`);

    const responseData = {
        link: payload.issue.self,
        key: payload.issue.key,
        project: payload.issue.fields.project.name,
        summary: payload.issue.fields.summary,
        body: payload.comment.body,
        author: {
            self: payload.comment.author.self,
            name: payload.comment.author.name,
            key: payload.comment.author.key,
            emailAddress: payload.comment.author.emailAddress,
            displayName: payload.comment.author.displayName,
            active: payload.comment.author.active,
            timeZone: payload.comment.author.timeZone,
        },
        ts: Date.now(),
    };
    return responseData;
};