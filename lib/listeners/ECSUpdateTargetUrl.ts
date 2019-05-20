import { configurationValue, logger } from "@atomist/automation-client";
import {
  EcsDeploymentListenerRegistration,
  EcsDeploymentListenerResponse,
} from "@atomist/sdm-pack-ecs/lib/support/listeners";

export const ECSUpdateTargetUrl: EcsDeploymentListenerRegistration = {
  name: "ECSUpdateTargetUrl",
  listener: async (p, r, event1, reg, dr): Promise<EcsDeploymentListenerResponse> => {
    logger.debug(`ECSUpdateTargetUrl: Starting`);
    if (event1 === "after") {
      r.progressLog.write(
        `ECSUpdateTargetUrl: Set external url to ${configurationValue<string>("sdm.aws.ecs.baseHostname")}/${p.name}`);

      r.progressLog.write(
        JSON.stringify(dr, undefined, 2),
      );

      return {
        code: 0,
        externalUrls: [{url: `${configurationValue<string>("sdm.aws.ecs.baseHostname")}/${p.name}`}],
      };
    }

    return {
      code: 0,
    };
  },
};
