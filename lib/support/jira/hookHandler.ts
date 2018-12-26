import * as bodyParser from "body-parser";
import { logger } from "@atomist/automation-client";
import { JiraIssueWebhook, JiraChangelog } from "../jira/issueDefs";
import { inspect } from "util";

export const jiraIssueComment = (payload: JiraIssueWebhook) => {
    logger.debug(`New comment on issue ${payload.issue.key} (${payload.issue.self}) in project
        ${payload.issue.fields.project.name}: ${payload.comment.body}`);
};

export const jiraIssueLifecycleEvent = (payload: JiraIssueWebhook) => {
    if (payload.issue_event_type_name === "issue_created") {
        logger.debug(`Issue created ${payload.issue.key} (${payload.issue.self}) in project
            ${payload.issue.fields.project.name}:
                ${payload.issue.fields.summary} / ${payload.issue.fields.description}`);

    } else {
        logger.debug(`Issue ${payload.issue.key} State Change - ${payload.webhookEvent}`);
    }
};

export const jiraUnpackChangelogToString = (changelog: JiraChangelog): string => {
    let message: string = "";
    changelog.items.forEach(i => {
        message += `${i.field} changed from ${i.fromString} to ${i.toString}\n`;
    });

    return message;
};

export const jiraIssueChangelogEvent = (payload: JiraIssueWebhook) => {
    logger.debug(`Issue updated (changelog).  Issue ${payload.issue.key} (${payload.issue.self}) in project
        ${payload.issue.fields.project.name}: ${jiraUnpackChangelogToString(payload.changelog)}`);
};

export const jiraWebHookExtractEventData = (payload: JiraIssueWebhook) => {
    const eventTypeName = payload.webhookEvent;

    logger.debug(`Event Type: ${eventTypeName}`);
    switch (eventTypeName) {
        case "jira:issue_created": {
            // do stuff
            jiraIssueLifecycleEvent(payload);
            break;
        }

        case "jira:issue_updated": {
            const jiraUpdateDetail = payload.issue_event_type_name;

            if (jiraUpdateDetail === "issue_commented") {
                jiraIssueComment(payload);
            } else if (jiraUpdateDetail === "issue_generic") {
                jiraIssueChangelogEvent(payload);
            }

            break;
        }

        case "jira:issue_deleted": {
            jiraIssueLifecycleEvent(payload);
            break;
        }

    }
};

export const jiraWebHookProcessor = async config => {
    config.http.customizers.push(
        c => {
            c.use(bodyParser.urlencoded({extended: true}));
            c.use(bodyParser.json());

            c.post("/jiraevent", async (req, res) => {
                // logger.debug(`BuildEvent Payload: ${JSON.stringify(req.body)}`);
                jiraWebHookExtractEventData(req.body);
            });
            logger.debug(inspect(config));
        },
    );

    return config;
};
