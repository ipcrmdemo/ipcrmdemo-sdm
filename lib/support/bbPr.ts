import {
  BitBucketServerRepoRef,
  configurationValue,
  HandlerResult, logger,
} from "@atomist/automation-client";
import {
  CommandHandlerRegistration,
  CommandListenerInvocation, ParametersDefinition,
  ProjectLoader, slackSuccessMessage
} from "@atomist/sdm";

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
    logger.debug(`raisePrForBranchHandler => Raising PR!`)
    await p.raisePullRequest(
      `Merge ${ci.parameters.branch} to master`,
      "[atomist:generated]",
      "master",
    );
    await ci.addressChannels(
     slackSuccessMessage(
       "Raise PR",
       "PR Opened"),
      {
        id: `openPR/${ci.parameters.owner}/${ci.parameters.name}/${p.branch}/master/${ci.parameters.sha}`,
      },
    );
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
