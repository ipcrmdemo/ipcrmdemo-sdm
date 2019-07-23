// Fingerprint Compliance
import {
  AutoCodeInspection,
  Autofix,
  Cancel,
  PushImpact,
} from "@atomist/sdm";
import { CloudFoundryDeploy } from "@atomist/sdm-pack-cloudfoundry";
import { DockerBuild } from "@atomist/sdm-pack-docker";
import {
  AllGoals,
  GoalCreator,
  Version,
} from "@atomist/sdm-core";
import { Build } from "@atomist/sdm-pack-build";
import { KubernetesDeploy } from "@atomist/sdm-pack-k8s";
import { EcsDeploy } from "@atomist/sdm-pack-ecs";

export interface MyGoals extends AllGoals {
  autofix: Autofix;
  version: Version;
  codeInspection: AutoCodeInspection;
  pushImpact: PushImpact;
  build: Build;
  dockerBuild: DockerBuild;
  k8sStagingDeployment: KubernetesDeploy;
  k8sProductionDeployment: KubernetesDeploy;
  ecsStagingDeploy: EcsDeploy;
  ecsProductionDeploy: EcsDeploy;
  pcfStagingDeploy: CloudFoundryDeploy;
  pcfProductionDeploy: CloudFoundryDeploy;
  cancel: Cancel;
}

export const MyGoalCreator: GoalCreator<MyGoals> = async () => {
  const goals: MyGoals = {
    autofix: new Autofix(),
    version: new Version(),
    codeInspection: new AutoCodeInspection(),
    pushImpact: new PushImpact(),
    build: new Build(),
    dockerBuild: new DockerBuild(),
    k8sStagingDeployment: new KubernetesDeploy({environment: "staging"}),
    k8sProductionDeployment: new KubernetesDeploy({environment: "production", preApproval: true}),
    ecsStagingDeploy: new EcsDeploy({
      displayName: "ECS Deploy Staging",
      approval: true,
      retry: true,
      uniqueName: "ecsDeployStaging",
      environment: "staging",
      descriptions: {
        inProcess: "Deploying to ECS `staging`",
        completed: "Deploy to ECS `staging`",
      },
    }),
    ecsProductionDeploy: new EcsDeploy({
      displayName: "ECS Deploy Prod",
      uniqueName: "ecsDeployProd",
      environment: "production",
      retry: true,
      descriptions: {
        inProcess: "Deploying to ECS `prod`",
        completed: "Deploy to ECS `prod`",
      },
    }),
    pcfStagingDeploy: new CloudFoundryDeploy({
      displayName: "Deploy to CF `staging`",
      environment: "staging",
      descriptions: {
        inProcess: "Deploying to Cloud Foundry `staging`",
        completed: "Deployed to Cloud Foundry `staging`",
      },
    }),
    pcfProductionDeploy: new CloudFoundryDeploy({
      displayName: "Deploy to CF `production`",
      environment: "production",
      preApproval: true,
      descriptions: {
        inProcess: "Deploying to Cloud Foundry `production`",
        completed: "Deployed to Cloud Foundry `production`",
      },
    }),
    cancel: new Cancel(),
  };

  return goals;
};
