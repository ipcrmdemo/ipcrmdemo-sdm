import { GitProject, Project, ProjectReview, ReviewComment } from "@atomist/automation-client";
import {
  CodeInspection,
  LoggingProgressLog,
  PushImpactResponse,
  ReviewListenerRegistration,
  spawnLog,
} from "@atomist/sdm";
import { determineMavenCommand } from "@atomist/sdm-pack-spring/lib/maven/mavenCommand";
import * as xml2js from "xml2js";
import { Field, SlackMessage } from "@atomist/slack-messages";
import * as _ from "lodash";

export const SpotbugsSecurityReview: CodeInspection<ProjectReview> = async (p: Project): Promise<ProjectReview> => {
  await spawnLog(
    await determineMavenCommand(p), ["compile", "com.github.spotbugs:spotbugs-maven-plugin:3.1.7:spotbugs"], {
      cwd: (p as GitProject).baseDir,
      log: new LoggingProgressLog("spotbugs"),
    });
  const comments = await extractCommentsFromSpotbugsReport(p, "SECURITY");
  return {repoId: p.id, comments: _.flatten(comments)};
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
            lineFrom1: bugInstance.SourceLine[0].$.start,
            offset: 0,
          },
        });
      }
    }
  });
  return comments;
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
