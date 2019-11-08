import { ProjectAction } from "@atomist/sdm";
import { createChannel } from "@atomist/sdm-pack-lifecycle/lib/handlers/command/slack/CreateChannel";
import * as _ from "lodash";
import { inviteUserToSlackChannel } from "@atomist/sdm-pack-lifecycle/lib/handlers/command/slack/AssociateRepo";
import { addBotToSlackChannel } from "@atomist/sdm-pack-lifecycle/lib/handlers/command/slack/AddBotToChannel";
import { NoParameters } from "@atomist/automation-client";

const LinkChannelMutation = `mutation linkSlackChannelToRepo(
  $teamId: String!
  $channelId: String!
  $repo: String!
  $owner: String!
  $providerId: String
) {
  linkSlackChannelToRepo(
    chatTeamId: $teamId
    channelId: $channelId
    repo: $repo
    owner: $owner
    providerId: $providerId
  ) {
    id
  }
}
`;

export const channelMappingProjectAction: ProjectAction<NoParameters> = async (p, ctx) => {
  const result = await ctx.context.graphClient.query({
    query: `{ ChatTeam { id } }`,
  });
  const chatTeam = _.get(result, "ChatTeam[0].id");
  const newId = await createChannel(ctx.context, chatTeam, p.id.repo);

  await addBotToSlackChannel(
    ctx.context,
    chatTeam,
    newId.createSlackChannel.id,
  );

  const query = `
    query RepoProviderId ($owner: String!, $name: String!){
      Repo(owner: $owner, name: $name) {
        org {
          provider {
            id
          }
        }
      }
    }`;

  const repoProviderId = await ctx.context.graphClient.query({
    query,
    variables: {
      owner: p.id.owner,
      name: p.id.repo,
    },
  });
  // A2MO4H2RG_iswe15ziy7i3yfo
  const providerId = _.get(repoProviderId, "Repo[0].org.provider.id").split("_")[1];
  await ctx.context.graphClient.mutate({
    mutation: LinkChannelMutation,
    variables: {
      teamId: chatTeam,
      channelId: newId.createSlackChannel.id,
      repo: p.id.repo,
      owner: p.id.owner,
      providerId,
    },
  });
  await inviteUserToSlackChannel(ctx.context, chatTeam, newId.createSlackChannel.id, ctx.context.source.slack.user.id);
};
