import { GoalConfigurer } from "@atomist/sdm-core";
import { MyGoals } from "../goals";
import { ReduceMemorySize } from "../../transform/smallMemory";
import { AddLicenseFile } from "../../transform/addLicense";

export const GlobalGoalsConfigurator: GoalConfigurer<MyGoals> = async (sdm, goals) => {
  // Autofix
  goals.autofix
    .with(ReduceMemorySize)
    .with(AddLicenseFile);
};
