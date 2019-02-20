import { EventHandlerRegistration, slackTs } from "@atomist/sdm";
import { configurationValue, GraphQL, logger, OnEvent, Success } from "@atomist/automation-client";
import * as types from "../typings/types";
import * as slack from "@atomist/slack-messages";
import { SnowOptions } from "../support/requestEmail";

function onScRequestEventHandler():
  OnEvent<types.OnScRequest.Subscription> {
  return async (e, ctx) => {
    logger.info(`ScRequest Event received, ${JSON.stringify(e.data.ScRequest, undefined, 2)}`);
    await ctx.messageClient.addressUsers(
      createReqSlackMessage(
        e.data.ScRequest[0].reqId,
        e.data.ScRequest[0].status,
        e.data.ScRequest[0].screenName,
      ),
      e.data.ScRequest[0].screenName,
      {
        id: `service-now-req/${e.data.ScRequest[0].reqId}`,
        ttl: 60 * 60 * 1000, // update this message for up to one hour; after that, post anew
      },
    );
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

export function createReqSlackMessage(
  request: string,
  status: string,
  screenName: string,
): slack.SlackMessage {
  const statusString = parseInt(status, undefined) < 3 ? `Underway` : `Completed`;
  const requestCompleted = {
    state: parseInt(status, undefined) === 3 ? `atomist_build_passed` : `atomist_build_started`,
    text: parseInt(status, undefined) === 3 ? `Requested completed!` : `Request not yet completed`,
  }
  const requestStarted = {
    state: parseInt(status, undefined) > 1 ? `atomist_build_passed` : `atomist_build_started`,
    text: parseInt(status, undefined) > 1 ? `Request underway!` : `Request not yet started`,
  }
  return {
    attachments: [
      {
        pretext: `*Service Now Request ${request} - ${parseInt(status, undefined) === 1 ? `Submitted` : statusString}*`,
        color: "#45B254",
        author_name: screenName,
        /* tslint:disable-next-line */
        author_icon: `https://library.kissclipart.com/20181224/ggq/kissclipart-head-clipart-xiaomi-redmi-note-6-pro-spring-labyri-bf42b752635cb141.png`,
        fallback: `Service Now Request status ${status}`,
        fields: [
          {
            title: slack.emoji(`atomist_build_passed`) + "Request Submitted",
            value: `Request has been submitted`,
          },
          {
            title: slack.emoji(requestStarted.state) + "Request Started",
            value: requestStarted.text,
          },
          {
            title: slack.emoji(requestCompleted.state) + "Request Completed",
            value: requestCompleted.text,
          },
        ],
        footer: scSlackFooter(request),
        footer_icon:
          `https://static.crozdesk.com/web_app_library/providers/logos/000/003/744/box/servicenow-1517340249-logo.png`,
        ts: slackTs(),
      },
    ],
  };
}

export function scSlackFooter(req: string): string {
  const snowConfig = configurationValue<SnowOptions>("sdm.snow");
  const footer = slack.url(`${snowConfig.url}`, `Request ID/${req}`);
  return footer;
}
