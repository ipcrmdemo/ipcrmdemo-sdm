import {
  execPromise,
} from "@atomist/sdm";
import { configurationValue } from "@atomist/automation-client";
import * as _ from "lodash";
import { EcsDeploymentListenerRegistration } from "@atomist/sdm-pack-ecs/lib/support/listeners";

export const ECSCreateTargetGroup: EcsDeploymentListenerRegistration = {
  name: "ECSCreateTargetGroup",
  listener: async (p, r, event1, registration) => {
    r.progressLog.write(`ECSCreateTargetGroup: Starting`);
    if (event1 === "before") {
      const result = await execPromise(
        "aws",
        ["elbv2", "describe-target-groups", `--region=${configurationValue<string>("sdm.aws.region")}`],
      );

      // Get all the existing target groups
      const groups: Array<{ TargetGroupName: string, VpcId: string, TargetGroupArn: string }> =
        _.get(JSON.parse(result.stdout), "TargetGroups");
      const names = groups.map(g => g.TargetGroupName);

      // If our project name doesn't have a targetGroup, create one
      r.progressLog.write(`ECSCreateTargetGroup: Checking if a target group already exists for` +
        registration.serviceRequest.serviceName);

      if (!names.includes(registration.serviceRequest.serviceName)) {
        r.progressLog.write(
          `ECSCreateTargetGroup: Target group is missing for ${registration.serviceRequest.serviceName}` +
          `, creating`);

        const newGroup = await execPromise(
          "aws",
          [
            "elbv2",
            "create-target-group",
            `--name=${registration.serviceRequest.serviceName}`,
            `--region=${configurationValue<string>("sdm.aws.region")}`,
            "--protocol=HTTP",
            `--port=${registration.taskDefinition.containerDefinitions[0].portMappings[0].hostPort.toString()}`,
            `--vpc-id=${configurationValue<string>("sdm.aws.ecs.vpcId")}`,
            "--health-check-protocol=HTTP",
            `--health-check-port`,
            `${registration.taskDefinition.containerDefinitions[0].portMappings[0].hostPort.toString()}`,
            "--health-check-path=/",
            "--health-check-interval-seconds=30",
            "--health-check-timeout-seconds=5",
            "--target-type=ip",
          ],
        );

        const newGroupArn = _.get(JSON.parse(newGroup.stdout), "TargetGroups[0].TargetGroupArn");
        r.progressLog.write(`ECSCreateTargetGroup: New Group ARN => ${newGroupArn}`);

        registration.serviceRequest.loadBalancers = [{
          targetGroupArn: newGroupArn,
          containerPort: registration.taskDefinition.containerDefinitions[0].portMappings[0].containerPort,
          containerName: registration.taskDefinition.containerDefinitions[0].name,
        }];

        return {
          code: 0,
          registration,
          region: configurationValue<string>("sdm.aws.region"),
        };
      } else {
        // Group already exists
        const arn = groups.filter(g => g.TargetGroupName === registration.serviceRequest.serviceName)[0].TargetGroupArn;
        r.progressLog.write(`ECSCreateTargetGroup:` +
          `Existing Group ARN for ${registration.serviceRequest.serviceName} => ${arn}`);

        registration.serviceRequest.loadBalancers = [{
          targetGroupArn: arn,
          containerPort: registration.taskDefinition.containerDefinitions[0].portMappings[0].containerPort,
          containerName: registration.taskDefinition.containerDefinitions[0].name,
        }];

        return {
          code: 0,
          registration: {
            ...registration,
            region: configurationValue<string>("sdm.aws.region"),
          },
        };
      }

    } else {
      r.progressLog.write(`ECSCreateTargetGroup: Incorrect Event type`);
      return {
        code: 0,
      };
    }
  },
};
