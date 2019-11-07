import { GoalConfigurer } from "@atomist/sdm-core";
import { MyGoals } from "../goals";
import { SuggestEnableEcsDeploy } from "../../support/suggestEnableEcsDeploy";
import { SuggestAddingDockerfile } from "../../support/suggestAddDockerfile";
import { SuggestEnableK8sDeploy } from "../../support/suggestEnableK8sDeploy";
import { GraphQL } from "@atomist/automation-client";

export const EventConfigurator: GoalConfigurer<MyGoals> = async (sdm, goals) => {
  /**
   * Channel Link Listeners
   */
  sdm.addChannelLinkListener(SuggestAddingDockerfile);
  sdm.addChannelLinkListener(SuggestEnableEcsDeploy);
  sdm.addChannelLinkListener(SuggestEnableK8sDeploy);

  sdm.addIngester(GraphQL.ingester("AppDeployment"));
};
