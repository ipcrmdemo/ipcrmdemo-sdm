import {
  configurationValue,
  DefaultHttpClientFactory, HandlerResult,
  HttpClientFactory,
  HttpMethod, logger, MappedParameter, MappedParameters, Parameters,
} from "@atomist/automation-client";
import { CommandHandlerRegistration, CommandListenerInvocation, slackSuccessMessage } from "@atomist/sdm";

@Parameters()
class BitbucketWebhookParams {
  @MappedParameter(MappedParameters.GitHubOwner)
  public owner: string;

  @MappedParameter(MappedParameters.GitHubRepository)
  public repo: string;
}

export const createHook = async (projectKey: string, repoSlug: string): Promise<void> => {
  logger.debug(`BitBucket createHook: start creating new post-recieve hook for ${projectKey}/${repoSlug}`);
  const baseUrl = configurationValue<string>("sdm.git.url");
  const basePluginUrl = `${baseUrl}` +
    `/rest/api/1.0/projects/` +
    `${projectKey}` +
    `/settings/hooks/com.atlassian.stash.plugin.stash-web-post-receive-hooks-plugin:postReceiveHook`;
  const settingsUrl = `${basePluginUrl}/settings`;
  const enableUrl = `${basePluginUrl}/enabled`;

  const payload = {
    "hook-url-0": configurationValue<string>("sdm.git.webhookdest"),
  };

  const result = await configurationValue<HttpClientFactory>(
    "http.client.factory", DefaultHttpClientFactory).create(settingsUrl).exchange(settingsUrl, {
    method: HttpMethod.Put,
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

  await configurationValue<HttpClientFactory>(
    "http.client.factory", DefaultHttpClientFactory).create(enableUrl).exchange(enableUrl, {
    method: HttpMethod.Put,
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

  logger.debug(`BitBucket createHook: successfully created new webhook for ${projectKey}/${repoSlug}.` +
    `Details => ${JSON.stringify(result.body, undefined, 2)}`);
};

export async function createBitbucketPostRecieveHook(
  ci: CommandListenerInvocation<BitbucketWebhookParams>,
): Promise<HandlerResult> {
  await createHook(ci.parameters.owner, ci.parameters.repo);
  await ci.addressChannels(slackSuccessMessage(
    `Created/Updated Bitbucket Atomist Hook for ${ci.parameters.owner}/${ci.parameters.repo}`,
    `Post receive hook setup`,
  ));
  return { code: 0 };
}

export const createBitbucketHookReg: CommandHandlerRegistration<BitbucketWebhookParams> = {
  name: "CreateBitBucketRepoWebhook",
  description: "Create a webhook for a BitBucket Repo",
  intent: "bitbucket create post-receive hook",
  paramsMaker: BitbucketWebhookParams,
  listener: createBitbucketPostRecieveHook,
};
