
import {
  HandlerContext,
  RemoteRepoRef,
  RepoFinder,
} from "@atomist/automation-client";
import * as _ from "lodash";
import { TeamRepos } from "../typings/types";
import { RepoRefResolver } from "@atomist/sdm";

const PageSize = 1000;

/**
 * Use a GraphQL query to find all repos for the current team
 * @param rrr RepoRefResolver used to find RepoRef from GraphQL result
 * @constructor
 */
export function customRepoFinder(rrr: RepoRefResolver): RepoFinder {
  return (context: HandlerContext) => {
    return queryForPage(rrr, context, 0);
  };
}

/**
 * Recursively query for repos from the present offset
 * @param rrr repo ref resolver to use
 * @param {HandlerContext} context
 * @param {number} offset
 * @return {Promise<RepoRef[]>}
 */
function queryForPage(rrr: RepoRefResolver, context: HandlerContext, offset: number): Promise<RemoteRepoRef[]> {
  return context.graphClient.query<TeamRepos.Query, TeamRepos.Variables>({
    name: "TeamRepos",
    variables: { offset, size: PageSize },
  })
    .then(result => {
      return result.Repo.map(r => rrr.toRemoteRepoRef(r, {}));
    })
    .then(repos => {
      return (repos.length < PageSize) ?
        repos :
        queryForPage(rrr, context, offset + PageSize)
          .then(moreRepos => repos.concat(moreRepos));
    });
}
