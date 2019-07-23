import { GoalConfigurer } from "@atomist/sdm-core";
import { MyGoals } from "../goals";
import { hasJenkinsfile } from "../../support/preChecks";

export const ExternalBuildConfigurator: GoalConfigurer<MyGoals> = async (sdm, goals) => {
  goals.build
    .with({
      externalTool: "jenkins",
      pushTest: hasJenkinsfile,
    });

};
