import { JiraChangelog, JiraIssueWebhook } from "../issueDefs";
import { logger } from "@atomist/automation-client";

/**
 * Convert a JiraChangelog to a human readable string
 * @param {JiraChangelog} changlog A JiraChangelog object
 * @returns {string} A human readable string of what elements of a particular Issue chagned
 */
export const jiraUnpackChangelogToString = (changelog: JiraChangelog): string => {
    let message: string = "";
    changelog.items.forEach(i => {
        message += `${i.field} changed from ${i.fromString} to ${i.toString}\n`;
    });

    return message.trim();
};

/**
 * Handler for issue updates that produce a changelog entry.  Examples; issue type change, state transition, etc.
 * @param {JiraIssueWebhook} payload Webhook payload from JIRA when an issue changes and produces a changelog
 */
export const jiraIssueChangelogEvent = (payload: JiraIssueWebhook) => {
    logger.debug(
        `jiraIssueChangelogEvent: Issue updated (changelog).  Issue ${payload.issue.key} (${payload.issue.self})` +
        `in project ${payload.issue.fields.project.name}: ${jiraUnpackChangelogToString(payload.changelog)}`);

    const responseData = {
        key: payload.issue.key,
        link: payload.issue.self,
        project: payload.issue.fields.project.name,
        summary: payload.issue.fields.summary,
        author: {
            self: payload.issue.fields.creator.self,
            name: payload.issue.fields.creator.name,
            key: payload.issue.fields.creator.key,
            emailAddress: payload.issue.fields.creator.emailAddress,
            displayName: payload.issue.fields.creator.displayName,
            active: payload.issue.fields.creator.active,
            timeZone: payload.issue.fields.creator.timeZone,
        },
        changelog: {
            id: payload.changelog.id,
            items: payload.changelog.items,
        },
        ts: Date.now(),
    };

    return responseData;
};