import {
  configurationValue,
  DefaultHttpClientFactory,
  HttpClientFactory,
  HttpClientOptions,
  HttpMethod,
  HttpResponse,
  logger,
} from "@atomist/automation-client";
import { bitBucketCredentials } from "./auth";
import {
  BasicAuthCredentials,
} from "@atomist/automation-client/lib/operations/common/BasicAuthCredentials";
import * as _ from "lodash";

/**
 * Stores the required information for mutating PRs
 */
export interface BitBucketPrData {
  owner: string;
  repo: string;
  branch: string;
  number: number;
}

/**
 * Stores the required information to mutate Branches
 */
export interface BitBucketBranchData {
  owner: string;
  repo: string;
  branch: string;
}

/**
 * Simple utility functino to return an authorization header
 * @param {BasicAuthCredentials} creds
 */
export function usernameColonPassword(creds: BasicAuthCredentials): { Authorization: string } {
    return {
      Authorization: `Basic ${Buffer.from(creds.username + ":" + creds.password).toString("base64")}`,
    };
}

/**
 * Generic function for sending API requests to the Bitbucket instance
 *   - Supply the URI beyond the base URL (from sdm.git.url)
 *   - Authentication (basic) is handled automatically
 *   - Optionally supply a response type
 *
 * @param uri
 * @param method
 * @param body
 * @param headers Optional
 */
export async function sendBitbucketApiRequest<R = any>(
  uri: string,
  method: HttpMethod,
  body?: any,
  headers?: HttpClientOptions["headers"],
): Promise<HttpResponse<R>> {
  const baseUrl = configurationValue<string>("sdm.git.url");
  const targetUrl = `${baseUrl}${uri.startsWith("/") ? "" : "/"}${uri}`;

  const initHeaders = headers ? headers : {
    "Accept": "application/json",
    "Content-Type": "application/json",
  };
  const authHeaders = usernameColonPassword(bitBucketCredentials());
  const finalHeaders = _.merge(initHeaders, {...authHeaders});

  logger.debug(`sendBitbucketApiRequest: Sending request to ${targetUrl}`);
  try {
    const result = await configurationValue<HttpClientFactory>("http.client.factory", DefaultHttpClientFactory)
      .create(targetUrl)
      .exchange<R>(targetUrl, {
          method,
          body,
          headers: finalHeaders,
        });

    logger.debug(`sendBitbucketApiRequest: Successfully sent request to ${targetUrl}`);
    return result;
  } catch (e) {
    logger.error(`sendBitbucketApiRequest: Failed to send request to ${targetUrl}`);
    throw e;
  }
}

/**
 * This function can be used to add comments to an existing PR.  See details in the API docs located here
 * https://docs.atlassian.com/bitbucket-server/rest/5.5.1/bitbucket-rest.html#idm139496951085440 in the /comments
 * section for valid comment data structure.
 *
 * @param {BitBucketPrData} data
 * @param {Object} comment
 */
export const createBitbucketPrComment = async (data: BitBucketPrData, comment: any): Promise<void> => {
  await sendBitbucketApiRequest(
    `/rest/api/1.0/projects/${data.owner}/repos/${data.repo}/pull-requests/${data.number}/comments`,
    HttpMethod.Post,
    comment,
  );
};

/**
 * This function can be used to decline an existing PR
 * @param {BitBucketPrData} data
 */
export const declineBitBucketPr = async (data: BitBucketPrData): Promise<void> => {
  const version = await sendBitbucketApiRequest<{version: number}>(
    `/rest/api/1.0/projects/${data.owner}/repos/${data.repo}/pull-requests/${data.number}`,
    HttpMethod.Get,
  );

  await sendBitbucketApiRequest(
    `/rest/api/1.0/projects/${data.owner}/repos/${data.repo}/pull-requests/${data.number}/decline`,
    HttpMethod.Post,
   {version: version.body.version},
  );
};

/**
 * This function can be used to delete a branch
 * @param {BitBucketBranchData} data
 */
export const deleteBitbucketBranch = async (data: BitBucketBranchData): Promise<void> => {
  await sendBitbucketApiRequest(
    `/rest/branch-utils/1.0/projects/${data.owner}/repos/${data.repo}/branches`,
    HttpMethod.Delete,
    {name: `refs/heads/${data.branch}`, dryRun: false},
  );
};
