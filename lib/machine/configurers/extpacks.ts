import { cacheRestore, githubGoalStatusSupport, GoalConfigurer, goalStateSupport } from "@atomist/sdm-core";
import { MyGoals} from "../goals";
import { jiraSupport } from "@atomist/sdm-pack-jira";
import { springSupport } from "@atomist/sdm-pack-spring";
import { buildAwareCodeTransforms } from "@atomist/sdm-pack-build";
import { k8sSupport } from "@atomist/sdm-pack-k8s";
import { cloudFoundrySupport } from "@atomist/sdm-pack-cloudfoundry";
import { changelogSupport } from "@atomist/sdm-pack-changelog";
import { issueSupport } from "@atomist/sdm-pack-issue";
import { DefaultTargetDiffHandler, fingerprintSupport, NpmCoordinates, NpmDeps } from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";
import { DockerFrom } from "@atomist/sdm-pack-docker";
import { eventRelaySupport } from "@atomist/sdm-pack-event-relay";
import { JiraRelay } from "../../support/jira/support/relayer";
import { mavenJarCache } from "../cache";

export const ExtPacksConfigurator: GoalConfigurer<MyGoals> = async (sdm, goals) => {
  sdm.addExtensionPacks(
    jiraSupport(),
    springSupport({
      review: {
        springStyle: true,
        cloudNative: true,
      },
      autofix: {
        springStyle: true,
      },
      inspectGoal: goals.codeInspection,
      autofixGoal: goals.autofix,
      reviewListeners: [],
    }),
    buildAwareCodeTransforms({
      buildGoal: goals.build,
      issueCreation: {},
    }),
    k8sSupport({
      addCommands: true,
    }),
    cloudFoundrySupport(),
    githubGoalStatusSupport(),
    goalStateSupport(),
    changelogSupport(),
    issueSupport(),
    fingerprintSupport({
      pushImpactGoal: goals.pushImpact,
      aspects: [
        _.merge(NpmDeps,        NpmDeps.workflows = [DefaultTargetDiffHandler]),
        _.merge(NpmCoordinates, NpmCoordinates.workflows = [DefaultTargetDiffHandler]),
        _.merge(DockerFrom,     DockerFrom.workflows = [DefaultTargetDiffHandler]),
      ],
    }),
    eventRelaySupport({
      eventRelayers: [
        JiraRelay,
      ],
    }),
  );

  /**
   * Extension pack specific listeners
   */
  // sdm.addEvent(onJiraIssueEventApproval(JiraApproval));
  goals.publishS3
    .withProjectListener(cacheRestore(mavenJarCache));
};
