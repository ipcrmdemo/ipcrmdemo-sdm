import * as bodyParser from "body-parser";
import { logger, Configuration, HttpMethod } from "@atomist/automation-client";
import { JiraIssueWebhook, JiraChangelog } from "../jira/issueDefs";
import { getIngesterWebhookUrl } from "./registrationInfo";

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

/**
 * Handler for incoming JIRA webhooks.  Extracts issue change type and routes to the proper handler
 * @param {JiraIssueWebhook} payload Raw payload of an incoming JIRA event hook
 * @param {Configuration} config sdm configuration
 */
export const jiraWebHookExtractEventData = async (payload: JiraIssueWebhook, config: Configuration) => {
    const eventTypeName = payload.webhookEvent;
    const jiraUpdateDetail = payload.issue_event_type_name;

    logger.debug(`jiraWebHookExtractEventData received webhook, type: ${eventTypeName}/${jiraUpdateDetail}`);
    switch (eventTypeName) {
        case "jira:issue_deleted":
        case "jira:issue_created": {
            await sdmPostWebhook(
                await getIngesterWebhookUrl(config, "JiraIssueLifecycleEvent"),
                jiraIssueLifecycleEvent(payload),
                config,
            );
            break;
        }

        case "jira:issue_updated": {
            if (jiraUpdateDetail === "issue_commented") {
                await sdmPostWebhook(
                    await getIngesterWebhookUrl(config, "JiraIssueCommentEvent"),
                    jiraIssueComment(payload),
                    config,
                );
            } else if (jiraUpdateDetail === "issue_generic" || jiraUpdateDetail === "issue_updated") {
                await sdmPostWebhook(
                    await getIngesterWebhookUrl(config, "JiraIssueChangelogEvent"),
                    jiraIssueChangelogEvent(payload),
                    config,
                );
            }
            break;
        }
    }
};

/**
 * Post data to an ingester webhook using httpClient from the SDM
 * @param url The url to send data to
 * @param payload Payload of data to send to the endpoint (object form; gets converted to JSON)
 * @param {Configuration} config sdm configuration
 */
export const sdmPostWebhook = async (url, payload, config: Configuration) => {
    const httpClient = config.http.client.factory.create(url);

    try {
        const result = await httpClient.exchange(
            url, {
                method: HttpMethod.Post,
                body: JSON.stringify(payload),
                headers: { ["Content-Type"]: "application/json" },
        });
        logger.debug(`sdmPostWebhook Result: ${JSON.stringify(result)}`);

    } catch (e) {
        logger.error("sdmPostWebhook:  Error! Failed to send webhook.  Failure: " + e.message);
        throw new Error(e);
    }
};

/**
 * Post-processor that exposes a /jiraevent endpoint on the SDM that can be used as a webhook target by JIRA.
 * The post processer then formats the data and will submit it to custom ingestion endpoints.  These events
 * ultimately are turned into events in the SDM.
 *
 * @param {Configuration} config sdm configuration
 */
export const jiraWebHookProcessor = async (config: Configuration) => {
    config.http.customizers.push(
        c => {
            c.use(bodyParser.urlencoded({extended: true}));
            c.use(bodyParser.json());

            c.post("/jiraevent", async (req, res) => {
                jiraWebHookExtractEventData(req.body, config);
            });
        },
    );

    return config;
};
