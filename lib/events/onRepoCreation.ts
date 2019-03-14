import { PreferenceScope, PushListener } from "@atomist/sdm";

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

export const ChannelMappingFirstPushListener: PushListener = async pi => {
  const channel = await pi.preferences.get<{ channel: string, team: string }>(
    `generator/${pi.project.id.owner}/${pi.project.id.repo}/channel`, { scope: PreferenceScope.Sdm });
  if (!!channel) {
    await pi.context.graphClient.mutate({
      mutation: LinkChannelMutation,
      variables: {
        teamId: channel.team,
        channelId: channel.channel,
        repo: pi.push.repo.name,
        owner: pi.push.repo.owner,
        providerId: pi.push.repo.org.provider.providerId,
      },
    });
  }
};
