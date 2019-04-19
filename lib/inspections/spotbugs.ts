import {
  configurationValue, DefaultHttpClientFactory,
  GitProject,
  HttpClientFactory, HttpMethod,
  Project,
  ProjectReview,
  ReviewComment,
  logger,
} from "@atomist/automation-client";
import {
  CodeInspection,
  LoggingProgressLog, predicatePushTest, PredicatePushTest, PushAwareParametersInvocation,
  PushImpactResponse,
  ReviewListenerRegistration,
  spawnLog,
} from "@atomist/sdm";
import { determineMavenCommand } from "@atomist/sdm-pack-spring/lib/maven/mavenCommand";
import * as xml2js from "xml2js";
import { Field, SlackMessage } from "@atomist/slack-messages";
import * as _ from "lodash";
import { GetPrByOwnerNameSourceBranch } from "../typings/types";
import { isBasicAuthCredentials } from "@atomist/automation-client/lib/operations/common/BasicAuthCredentials";
import { bitBucketCredentials } from "../../index";

export const SpotbugsSecurityReview: CodeInspection<ProjectReview> =
  async (p: Project, papi: PushAwareParametersInvocation<ProjectReview>): Promise<ProjectReview> => {

  await spawnLog(
    await determineMavenCommand(p), ["compile", "com.github.spotbugs:spotbugs-maven-plugin:3.1.7:spotbugs"], {
      cwd: (p as GitProject).baseDir,
      log: new LoggingProgressLog("spotbugs"),
    });
  const comments = await extractCommentsFromSpotbugsReport(p, "SECURITY");

  // Should remove comments that are not from files that were changed on this push
  const keepers = comments.filter(c => papi.push.filesChanged.includes(c.sourceLocation.path));
  return {repoId: p.id, comments: _.flatten(keepers)};
};

async function extractCommentsFromSpotbugsReport(p: Project, categoryFilter?: string): Promise<ReviewComment[]> {
  const report = await p.getFile("target/spotbugsXml.xml");
  const parser = new xml2js.Parser();
  const comments: ReviewComment[] = [];
  parser.parseString(await report.getContent(), (err: any, result: any) => {
    if (result.BugCollection.BugInstance !== undefined) {
      const bugInstances: any[] = result.BugCollection.BugInstance;
      for (const bugInstance of bugInstances) {
        comments.push({
          severity: "error",
          category: "spotbugs",
          detail: bugInstance.ShortMessage[0],
          subcategory: "security",
          sourceLocation: {
            path: "src/main/java/" + bugInstance.SourceLine[0].$.sourcepath,
            lineFrom1: _.get(bugInstance, "SourceLine[0].$.start", 0),
            offset: 0,
          },
        });
      }
    }
  });
  return comments;
}

interface MRChanges {
  fromHash: string;
  toHash: string;
  properties: MRChangesProperties;
  values: MRChangesValues[];
  size: number;
  isLastPage: boolean;
  start: number;
  limit: number;
  nextPageStart: number;
}
interface MRChangesValues {
  contentId: string;
  fromContentId: string;
  path: MRChangesValuesPath;
  executable: boolean;
  percentUnchanged: number;
  type: string;
  nodeType: string;
  srcExecutable: boolean;
  properties: MRChangesValuesProperties;
}
interface MRChangesProperties {
  changeScope: string;
}
interface MRChangesValuesPath {
  components: string[];
  parent: string;
  name: string;
  extension: string;
  toString: string;
}
interface MRChangesValuesProperties {
  orphanedComments: number;
  gitChangeType: string;
  activeComments: number;
}
interface MRComments {
  text: string;
  anchor: MRCommentsAnchor;
}
interface MRCommentsAnchor {
  line: number;
  lineType: string;
  fileType: string;
  path: string;
}
interface MRExistingComments {
  isLastPage: boolean;
  values: MRExistingCommentsValue[];
}
interface MRExistingCommentsValue {
  text: string;
  anchor: MRCommentsAnchor;
}

export const BbPRReviewListener: ReviewListenerRegistration = {
  name: "bbReviewListener",
  listener: async l => {
    const bbBaseUrl = configurationValue<string>("sdm.git.url");
    const prUrlBase =
      `${bbBaseUrl}/rest/api/1.0/projects/${l.review.repoId.owner}/repos/${l.review.repoId.repo}/pull-requests`;

    // Find out if this push has a PR on it
    const pr = await l.context.graphClient
      .query<GetPrByOwnerNameSourceBranch.Query, GetPrByOwnerNameSourceBranch.Variables>({
        name: "GetPrByOwnerNameSourceBranch",
        variables: {
          name: l.review.repoId.repo,
          owner: l.review.repoId.owner,
          sourceBranch: l.review.repoId.branch,
        },
      });

    // Get Changes Present in this PR
    let changes: MRChanges;
    try {
      const sortedPRs = _.sortBy(pr.PullRequest, "name");
      const lastPr = sortedPRs.pop();
      const changesUrl = `${prUrlBase}/${lastPr.name}/changes`;
      await configurationValue<HttpClientFactory>("http.client.factory", DefaultHttpClientFactory)
          .create(changesUrl)
          .exchange<MRChanges>(changesUrl, {
            method: HttpMethod.Get,
            headers: {
              "Content-Type": "application/json",
              ...usernameColonPassword(),
            },
          })
          .then(response => {
            logger.debug(`BB PR Changes => ${JSON.stringify(response.body, undefined, 2)}`);
            changes = response.body;
          });

      // Using the knowledge of the changes in the PR, process review comments and set the correct gitChangeType
      const prComments: MRComments[] = [];
      for (const c of l.review.comments) {
            prComments.push({
              text: `:exclamation:  ${c.severity}: ${c.category}\n${c.detail} detected`,
              anchor: {
                line: c.sourceLocation.lineFrom1,
                lineType: changes.values.filter(change =>
                  change.path.toString === c.sourceLocation.path)[0].properties.gitChangeType === "ADD"
                    ? "ADDED" : "CONTEXT",
                fileType: "TO",
                path: c.sourceLocation.path,
              },
            });
          }

      // For each prepared comment, lookup comments on that file and determine if this comment is already in the PR
      //   If not, create it
      const prUrl = `${prUrlBase}/${lastPr.name}/comments`;
      await Promise.all(
        prComments.map(async c => {
          const commentPrUrl = `${prUrl}?path=${c.anchor.path}`;
          let existingComments: MRExistingComments;
          await configurationValue<HttpClientFactory>("http.client.factory", DefaultHttpClientFactory)
            .create(commentPrUrl)
            .exchange<MRExistingComments>(commentPrUrl, {
              method: HttpMethod.Get,
              headers: {
                "Content-Type": "application/json",
                ...usernameColonPassword(),
              },
            })
            .then(response => {
              logger.debug(`BB PR Existing Comments => ${JSON.stringify(response.body, undefined, 2)}`);
              existingComments = response.body;
            });

         // If this comment doesn't exist - send it
          if (
            existingComments &&
            existingComments.values.filter(v => (v.text === c.text && v.anchor.path === c.anchor.path)).length === 0
          ) {
            await configurationValue<HttpClientFactory>("http.client.factory", DefaultHttpClientFactory)
              .create(prUrl)
              .exchange(prUrl, {
                method: HttpMethod.Post,
                body: c,
                headers: {
                  "Content-Type": "application/json",
                  ...usernameColonPassword(),
                },
              })
              .then(response => {
                logger.debug(`BB PR Comments => ${JSON.stringify(response.body, undefined, 2)}`);
              });
          }
        }),
      );
    } catch (e) {
      logger.error(`BB PR Comments (error) => ${JSON.stringify(e)}`);
    }

    // Control if goal fails here
    if (l.review.comments.length > 0 && l.review.comments.filter(c => c.severity === "error")) {
      return PushImpactResponse.failGoals;
    } else {
      return PushImpactResponse.proceed;
    }
  },
};

function usernameColonPassword(): { Authorization: string } | {} {
  const creds = bitBucketCredentials();
  if (isBasicAuthCredentials(creds)) {
    return {
      Authorization: `Basic ${Buffer.from(creds.username + ":" + creds.password).toString("base64")}`
    };
  } else {
    return {};
  }
}

export const SlackFormattedReviewListener: ReviewListenerRegistration = {
  name: "consoleListener",
  listener: async l => {
    const fields: Field[] = [];
    for (const c of l.review.comments) {
      fields.push({
        title: `:exclamation:  ${c.severity}: ${c.category}`,
        value: `${c.detail}\ndetected at ${c.sourceLocation.path}:${c.sourceLocation.lineFrom1}`,
        short: false,
      });
    }
    const message: SlackMessage = {
      attachments: [{
        color: "#b42e4b",
        title: "Review comments",
        fields,
        fallback: `${l.review.comments.length} review comments`,
        footer: "Slack formatted review listener",
        author_name: "Atomist",
      }],
    };
    await l.addressChannels(message);
    if (l.review.comments.length > 0) {
      return PushImpactResponse.failGoals;
    } else {
      return PushImpactResponse.proceed;
    }
  },
};

export const HasPlugin: PredicatePushTest = predicatePushTest(
  "hasPlugin",
  async p => {
    let state = false;
    if (await p.hasFile("pom.xml")) {
      const pF = await p.getFile("pom.xml");
      const parser = new xml2js.Parser();
      parser.parseString(await pF.getContent(), (err: any, result: any) => {
        try {
          result.project.reporting[0].plugins.forEach(plu => {
            if (plu.plugin[0].artifactId[0] === "spotbugs-maven-plugin") {
              state = true;
            }
          });
        } catch {
          return;
        }
      });
    }

    return state;
  },
);

