import * as bodyParser from "body-parser";
import { logger, Configuration, HttpMethod } from "@atomist/automation-client";
import { JiraIssueWebhook } from "./issueDefs";
import { getIngesterWebhookUrl } from "./registrationInfo";
import { jiraIssueComment } from "./hookHandlers/jiraIssueComment";
import { jiraIssueChangelogEvent } from "./hookHandlers/jiraIssueChangelogEvent";
import { jiraIssueLifecycleEvent } from "./hookHandlers/jiraIssueLIfecycleEvent";

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
                await jiraWebHookExtractEventData(req.body, config);
            });
        },
    );

    return config;
};
