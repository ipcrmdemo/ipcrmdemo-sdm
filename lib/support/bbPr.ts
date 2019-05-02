import {
  BitBucketServerRepoRef,
  configurationValue,
  DefaultHttpClientFactory,
  HandlerResult,
  HttpClientFactory,
  HttpMethod,
  logger,
} from "@atomist/automation-client";
import {
  CommandHandlerRegistration,
  CommandListenerInvocation,
  ParametersDefinition,
  ProjectLoader,
  slackErrorMessage,
  slackSuccessMessage,
} from "@atomist/sdm";
import { usernameColonPassword } from "../inspections/spotbugs";
import * as _ from "lodash";

interface BitBucketConditions {
  reviewers: BitBucketReviewer[];
}
interface BitBucketReviewer {
  name: string;
  emailAddress: string;
  id: string;
  displayName: string;
  slug: string;
  type: string;
}

export async function getDefaultReviewers(project: string, repo?: string): Promise<string[]> {
  let reviewers: BitBucketConditions[] = [];
  let url: string;
  if (repo) {
    url = configurationValue<string>("sdm.git.url") +
      `/rest/default-reviewers/1.0/projects/${project.toUpperCase()}/repos/${repo}/conditions`;
  } else {
    url = configurationValue<string>("sdm.git.url") +
      `/rest/default-reviewers/1.0/projects/${project.toUpperCase()}/conditions`;
  }
  await configurationValue<HttpClientFactory>("http.client.factory", DefaultHttpClientFactory)
    .create(url)
    .exchange<BitBucketConditions[]>(url, {
      method: HttpMethod.Get,
      headers: {
        "Content-Type": "application/json",
        ...usernameColonPassword(),
      },
    })
    .then(async response => {
      logger.debug(`BB conditions => ${JSON.stringify(response.body, undefined, 2)}`);
      reviewers = response.body;
    });

  return _.flatten(reviewers.map(r => r.reviewers.map(u => u.slug)));
}

export async function raisePrForBranchHandler(
  ci: CommandListenerInvocation<{owner: string, name: string, branch: string, sha: string}>): Promise<HandlerResult> {
  const repoRef = new BitBucketServerRepoRef(
    configurationValue("sdm.git.url"),
    ci.parameters.owner,
    ci.parameters.name,
    undefined,
    undefined,
    undefined,
    ci.parameters.branch,
  );
  await configurationValue<ProjectLoader>("sdm.projectLoader").doWithProject({
    credentials: {
      username: configurationValue<string>("sdm.git.user"),
      password: configurationValue<string>("sdm.git.password"),
    },
    id: repoRef,
    readOnly: true,
  }, async p => {
    logger.debug(`raisePrForBranchHandler => Raising PR!`);
    const url = configurationValue<string>("sdm.git.url") +
      `/rest/api/1.0/projects/${ci.parameters.owner.toUpperCase()}/repos/${ci.parameters.name}/pull-requests`;

    const defaultProjectReviewers = await getDefaultReviewers(ci.parameters.owner);
    const defaultRepoReviewers = await getDefaultReviewers(ci.parameters.owner, ci.parameters.name);
    await configurationValue<HttpClientFactory>("http.client.factory", DefaultHttpClientFactory)
      .create(url)
      .exchange<any>(url, {
        method: HttpMethod.Post,
        body: {
          title: `Merge ${ci.parameters.branch} to master`,
          description: "[auto-merge:on-approve] [atomist:generated]",
          fromRef: {
            id: p.branch,
          },
          toRef: {
            id: "master",
          },
          reviewers: _.merge(defaultProjectReviewers, defaultRepoReviewers).map(r => {
            return {
                user: { name: r },
              };
            },
          ),
        },
        headers: {
          "Content-Type": "application/json",
          ...usernameColonPassword(),
        },
      })
      .then(async response => {
        logger.debug(`BB PR Changes => ${JSON.stringify(response.body, undefined, 2)}`);
        await ci.addressChannels(
          slackSuccessMessage(
            "Raise PR",
            "PR Opened"),
          {
            id: `openPR/${ci.parameters.owner}/${ci.parameters.name}/${p.branch}/master/${ci.parameters.sha}`,
          },
        );
      })
      .catch(async e => {
        logger.debug(`BB Raise PR Failed => ${JSON.stringify(e.response.data)}`);
        await ci.addressChannels(
          slackErrorMessage(
            "Raise PR Failed!",
            `Failed to open PR => ${JSON.stringify(e.response.data, undefined, 2)}`,
            ci.context,
          ),
          {
            id: `openPR/${ci.parameters.owner}/${ci.parameters.name}/${p.branch}/master/${ci.parameters.sha}`,
          },
        );
      });
  });
  return {
    code: 0,
  };
}

const RaisePrForBranchParams: ParametersDefinition = {
  name: {
    description: "Repo name",
  },
  owner: {
    description: "Owner name",
  },
  branch: {
    description: "Branch name",
  },
  sha: {
    description: "Sha name",
  },
};

export const raisePrForBranchReg: CommandHandlerRegistration<{
  name: string, owner: string, branch: string, sha: string}> = {
  name: "RaisePrForBranch",
  parameters: RaisePrForBranchParams,
  listener: raisePrForBranchHandler,
};
