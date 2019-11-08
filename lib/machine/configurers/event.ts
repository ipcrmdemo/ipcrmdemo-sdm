import { GoalConfigurer } from "@atomist/sdm-core";
import { MyGoals } from "../goals";
import { GraphQL } from "@atomist/automation-client";
import { SuggestEnableEcsDeploy } from "../../support/creation/suggestEnableEcsDeploy";
import { SuggestAddingDockerfile } from "../../support/creation/suggestAddDockerfile";
import { SuggestEnableK8sDeploy } from "../../support/creation/suggestEnableK8sDeploy";

export const EventConfigurator: GoalConfigurer<MyGoals> = async (sdm, goals) => {
  /**
   * Channel Link Listeners
   */
  sdm.addChannelLinkListener(SuggestAddingDockerfile);
  sdm.addChannelLinkListener(SuggestEnableEcsDeploy);
  sdm.addChannelLinkListener(SuggestEnableK8sDeploy);

  sdm.addIngester(GraphQL.ingester("AppDeployment"));
};
