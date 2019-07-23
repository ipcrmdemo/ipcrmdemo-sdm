import { GoalConfigurer } from "@atomist/sdm-core";
import { MyGoals } from "../goals";
import { HasDockerfile } from "@atomist/sdm-pack-docker";
import { IsEcsDeployable } from "../../support/pushTests";
import { allSatisfied } from "@atomist/sdm";

export const EcsDeployConfigurator: GoalConfigurer<MyGoals> = async (sdm, goals) => {
  goals.ecsStagingDeploy
    .with({
      region: "us-east-1",
      pushTest: allSatisfied(IsEcsDeployable, HasDockerfile),
      serviceRequest: {
        cluster: "nonProd", // FARGATE Cluster
      },
      roleDetail: {
        RoleArn: "arn:aws:iam::247672886355:role/test_ecs_role",
        RoleSessionName: "ecs_example",
      },
    });

  goals.ecsProductionDeploy
    .with({
      region: "us-east-1",
      pushTest: allSatisfied(IsEcsDeployable, HasDockerfile),
      serviceRequest: {
        cluster: "prod", // EC2 Cluster
      },
      roleDetail: {
        RoleArn: "arn:aws:iam::247672886355:role/test_ecs_role",
        RoleSessionName: "ecs_example",
      },
    });
};
