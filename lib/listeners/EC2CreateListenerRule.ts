import { execPromise } from "@atomist/sdm";
import { configurationValue } from "@atomist/automation-client";
import * as _ from "lodash";
import { EcsDeploymentListenerRegistration } from "@atomist/sdm-pack-ecs/lib/support/listeners";

export const EC2CreateListenerRule: EcsDeploymentListenerRegistration = {
  name: "EC2CreateListenerRule",
  listener: async (p, r, event1, registration) => {
    r.progressLog.write(`EC2CreateListenerRule: Starting`);
    if (event1 === "before") {
      const result = await execPromise(
        "aws",
        [
          "elbv2",
          "describe-rules",
          `--region=${configurationValue<string>("sdm.aws.region")}`,
          `--listener-arn=${configurationValue<string>("sdm.aws.ecs.listenerArn")}`,
        ],
      );

      // Get all the existing listenerRules
      const values: Array<{ Conditions: Array<{Values: string[]}> }> =
        _.get(JSON.parse(result.stdout), "Rules");

      // Get the priorities
      const priority: Array<{ Priority: string }> =
        _.get(JSON.parse(result.stdout), "Rules");

      const newPrioritys: number[] = []
      priority.forEach(prio => {
        const num = parseInt(prio.Priority, undefined);
        if (!isNaN(num)) {
          newPrioritys.push(num);
        }
      });

      const newPriority = newPrioritys.sort((a, b) => a - b).pop() + 1;

      // TODO: Yikes ugly
      //  - this produces a flat list of all the paths that are being serviced, if service name is not there we
      //  need to create a listener
      const paths = _.flatten(_.flatten(values.map(v => v.Conditions)).map(a => a.Values));
      if (!paths.includes(registration.serviceRequest.serviceName)) {
        r.progressLog.write(
          `EC2CreateListenerRule: Rule for ${registration.serviceRequest.serviceName} does not exist, creating...`);
        await execPromise(
          "aws",
          [
            "elbv2",
            "create-rule",
            `--region=${configurationValue<string>("sdm.aws.region")}`,
            `--listener-arn=${configurationValue<string>("sdm.aws.ecs.listenerArn")}`,
            `--priority=${newPriority}`,
            `--conditions=Field=path-pattern,Values=/${registration.serviceRequest.serviceName}`,
            `--actions=Type=forward,TargetGroupArn=${registration.serviceRequest.loadBalancers[0].targetGroupArn}`,
          ],
        );
      } else {
        r.progressLog.write(
          `EC2CreateListenerRule: Rule for ${registration.serviceRequest.serviceName} already exists`);
      }
    } else {
      r.progressLog.write(`EC2CreateListenerRule: Wrong event type => ${event1}`);
    }

    return {
      code: 0,
    };
  },
};
