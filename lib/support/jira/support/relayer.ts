import { EventRelayer } from "@atomist/sdm-pack-event-relay";
import { GetJiraIssueByKey } from "@atomist/sdm-pack-jira/lib/typings/types";
import JiraIssue = GetJiraIssueByKey.JiraIssue;
import { addressEvent } from "@atomist/automation-client";
import { redactObjectProperty } from "@atomist/sdm-pack-event-relay/lib/support/util";

/**
 * JIRA Relay
 */
export const JiraRelay: EventRelayer<JiraIssue> = {
  name: "jiraRelay",
  test: payload => {
    return !!payload.body.webhookEvent && !!payload.body.issue_event_type_name;
  },
  targetEvent: {
    eventType: "private",
    eventTarget: addressEvent("JiraIssue"),
  },
  processor: async issue => {
    // Redact fields
    for (const r of ["body", "description", "summary", "displayName", "emailAddress"]) {
      await redactObjectProperty(issue.body, r);
    }
    return issue;
  },
};
