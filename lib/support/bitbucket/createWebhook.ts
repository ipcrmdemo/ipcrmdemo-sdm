import {
  configurationValue,
  DefaultHttpClientFactory,
  HandlerResult,
  HttpClientFactory,
  HttpMethod, logger,
  MappedParameter,
  MappedParameters, NoParameters,
  Parameters
} from "@atomist/automation-client";
import {
  CommandHandlerRegistration,
  CommandListenerInvocation,
  ProjectAction,
  slackSuccessMessage
} from "@atomist/sdm";
import * as slack from "@atomist/slack-messages";

@Parameters()
class BitbucketWebhookParams {
  @MappedParameter(MappedParameters.GitHubOwner)
  public owner: string;

  @MappedParameter(MappedParameters.GitHubRepository)
  public repo: string;
}

interface BitbucketWebhookResponse {
  id: number;
  name: string;
  createdDate: number;
  updatedDate: number;
  events: string[];
  configuration: any;
  url: string;
  active: boolean;
}

export const bitbucketCreateWebHookProjectAction: ProjectAction<NoParameters> = async (p, ctx) => {
  await createWebhook(p.id.owner, p.id.repo);
  await ctx.addressChannels(slackSuccessMessage(
    `Create Bitbucket Webhooks`,
    `Created Bitbucket Webhooks for ${p.id.owner}/${p.id.repo}`,
  ));
};

export const createWebhook = async (projectKey: string, repoSlug: string): Promise<BitbucketWebhookResponse> => {
  logger.debug(`BitBucket createWebhook: start creating new webhook for ${projectKey}/${repoSlug}`);
  const baseUrl = configurationValue<string>("sdm.git.url");
  const targetUrl = `${baseUrl}/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/webhooks`;

  const payload = {
    name: "Atomist",
    events: [
      "repo:comment:deleted",
      "pr:opened",
      "repo:forked",
      "pr:reviewer:approved",
      "pr:declined",
      "repo:comment:edited",
      "repo:comment:added",
      "pr:modified",
      "pr:reviewer:needs_work",
      "pr:merged",
      "repo:modified",
      "pr:reviewer:updated",
      "pr:comment:deleted",
      "pr:deleted",
      "pr:reviewer:unapproved",
      "pr:comment:added",
      "repo:refs_changed",
      "pr:comment:edited",
    ],
    configuration: {},
    url: configurationValue<string>("sdm.git.webhookdest"),
    active: true,
  };

  const result = await configurationValue<HttpClientFactory>(
    "http.client.factory", DefaultHttpClientFactory).create(targetUrl).exchange<BitbucketWebhookResponse>(targetUrl, {
    method: HttpMethod.Post,
    body: payload,
    headers: {
      "Content-Type": "application/json",
    },
    options: {
        auth: {
            username: configurationValue<string>("sdm.git.user"),
            password: configurationValue<string>("sdm.git.password"),
        },
    },
  });

  logger.debug(`BitBucket createWebhook: successfully created new webhook for ${projectKey}/${repoSlug}.` +
    `Details => ${JSON.stringify(result.body, undefined, 2)}`);
  return result.body;
};

export async function createBitbucketWebhook(
  ci: CommandListenerInvocation<BitbucketWebhookParams>,
): Promise<HandlerResult> {

  const result = await createWebhook(ci.parameters.owner, ci.parameters.repo);
  await ci.addressChannels(slackSuccessMessage(
    `Created/Updated Bitbucket Atomist Webhook for ${ci.parameters.owner}/${ci.parameters.repo}`,
    `Details: ${slack.codeBlock(JSON.stringify(result, undefined, 2))}`,
  ));
  return { code: 0 };
}

export const createBitbucketWebhookReg: CommandHandlerRegistration<BitbucketWebhookParams> = {
  name: "CreateBitBucketRepoWebhook",
  description: "Create a webhook for a BitBucket Repo",
  intent: "bitbucket create webhook",
  paramsMaker: BitbucketWebhookParams,
  listener: createBitbucketWebhook,
};
