// Fingerprint Compliance
import {
  allSatisfied,
  GoalWithFulfillment,
  LogSuppressor,
  SdmGoalEvent,
  SoftwareDeliveryMachine,
} from "@atomist/sdm";
import {
  IsMaven,
  mavenBuilder,
  MavenDefaultOptions,
  MavenProjectVersioner,
  MvnPackage,
  MvnVersion,
} from "@atomist/sdm-pack-spring";
import { CloudFoundryDeploy, CloudFoundryDeploymentStrategy } from "@atomist/sdm-pack-cloudfoundry";
import { DockerBuild, HasDockerfile } from "@atomist/sdm-pack-docker";
import {
  IsNode,
  nodeBuilder,
  NodeModulesProjectListener,
  NodeProjectVersioner,
  NpmCompileProjectListener,
  NpmProgressReporter,
  NpmVersionProjectListener,
} from "@atomist/sdm-pack-node";
import { Version } from "@atomist/sdm-core";
import { Build } from "@atomist/sdm-pack-build";
import { KubernetesDeploy } from "@atomist/sdm-pack-k8s";
import { hasJenkinsfile } from "../support/preChecks";
import {
  dotnetCoreBuilder,
  DotnetCoreProjectVersioner,
  DotnetCoreVersionProjectListener,
} from "@atomist/sdm-pack-analysis-dotnet";
import { isDotNetCore } from "../support/dotnet/support";
import { EcsDeploy } from "@atomist/sdm-pack-ecs";
import { IsEcsDeployable } from "../support/pushTests";
import { k8sCallback } from "../support/k8s/callback";

/**
 * Goals
 */
export const fingerprintComplianceGoal = new GoalWithFulfillment(
  {
    uniqueName: "fingerprint-compliance-check",
    displayName: "fingerprint-compliance-check",
  },
);

// Version-ers
export const mavenVersion = new Version().withVersioner(MavenProjectVersioner);
export const nodeVersion = new Version().withVersioner(NodeProjectVersioner);
export const dotNetVersion = new Version().withVersioner(DotnetCoreProjectVersioner);

// Builds
export const mavenBuild = new Build()
    .with({
        ...MavenDefaultOptions,
        name: "maven-run-build",
        builder: mavenBuilder(),
        pushTest: MavenDefaultOptions.pushTest,
    });

export const externalBuild = new Build();
export const nodeBuild = new Build();
export const dockerBuild = new DockerBuild();
export const dotNetBuild = new Build({ displayName: "dotnet build" });

// Kubernetes Deploys
export const k8sStagingDeploy = new KubernetesDeploy({
  environment: "testing",
  displayName: "Deployment to K8s `testing`",
  descriptions: {
    planned: "Deployment to K8s `testing` planned",
    requested: "Deployment to K8s `testing` requested",
    stopped: "Deployment to K8s `testing` stopped",
    inProcess: "Deployment to K8s `testing` running",
    completed: "Deployment to K8s `testing` completed",
    failed: "Deployment to K8s `testing` failed",
    waitingForApproval: "Deployment to K8s `testing` pending approval",
    waitingForPreApproval: "Deployment to K8s `testing` pending pre-approval",
  },
});

export const k8sBlueProd = new KubernetesDeploy(
  {
    uniqueName: "k8sblueprod",
    environment: "production",
    preApproval: true,
    displayName: "Blue Deployment to K8s `production`",
    descriptions: {
      planned: "Blue deployment to K8s `production` planned",
      requested: "Blue deployment to K8s `production` pending ",
      stopped: "Blue deployment to K8s `production` stopped ",
      inProcess: "Blue deployment to K8s `production` running ",
      completed: "Blue deployment to K8s `production` completed ",
      failed: "Blue deployment to K8s `production` failed ",
      waitingForApproval: "Blue deployment to K8s `production` pending approval ",
      waitingForPreApproval: "Blue deployment to K8s `production` pending pre-approval ",
    },
  });

export const k8sGreenProd = new KubernetesDeploy(
  {
    uniqueName: "k8sgreenprod",
    environment: "production",
    preApproval: true,
    displayName: "Green Deployment to K8s `production`",
    descriptions: {
      planned: "Green deployment to K8s `production` planned",
      requested: "Green deployment to K8s `production` pending ",
      stopped: "Green deployment to K8s `production` stopped ",
      inProcess: "Green deployment to K8s `production` running ",
      completed: "Green deployment to K8s `production` completed ",
      failed: "Green deployment to K8s `production` failed ",
      waitingForApproval: "Green deployment to K8s `production` pending approval ",
      waitingForPreApproval: "Green deployment to K8s `production` pending pre-approval ",
    },
  });

// ECS Deployment
export const ecsDeployStaging = new EcsDeploy({
  displayName: "ECS Deploy Staging",
  approval: true,
  uniqueName: "ecsDeployStaging",
  environment: "staging",
  descriptions: {
    inProcess: "Deploying to ECS `staging`",
    completed: "Deploy to ECS `staging`",
  },
});
export const ecsDeployProd = new EcsDeploy({
  displayName: "ECS Deploy Prod",
  uniqueName: "ecsDeployProd",
  environment: "production",
  descriptions: {
    inProcess: "Deploying to ECS `prod`",
    completed: "Deploy to ECS `prod`",
  },
});

// CF Deployment
export const cfDeployment = new CloudFoundryDeploy({
  displayName: "Deploy to CF `production`",
  environment: "production",
  preApproval: true,
  descriptions: {
    inProcess: "Deploying to Cloud Foundry `production`",
    completed: "Deployed to Cloud Foundry `production`",
  },
});
export const cfDeploymentStaging = new CloudFoundryDeploy({
    displayName: "Deploy to CF `testing`",
    environment: "testing",
    preApproval: true,
    descriptions: {
      inProcess: "Deploying to Cloud Foundry `testing`",
      completed: "Deployed to Cloud Foundry `testing`",
    },
  },
);

/**
 * Implementations
 * @param sdm
 */
export function addImplementation(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {
  /**
   * Builds
   */
  nodeBuild
    .with({
      logInterpreter: LogSuppressor,
      progressReporter: NpmProgressReporter,
      name: "node-run-build",
      builder: nodeBuilder(
        {
          command: "npm",
          args: ["install"],
        },
        {
          command: "npm",
          args: ["run", "build"],
        },
      ),
      pushTest: IsNode,
    });

  externalBuild
    .with({
      externalTool: "jenkins",
      pushTest: hasJenkinsfile,
    });

  dotNetBuild
    .with({
      logInterpreter: LogSuppressor,
      name: "dotnet-build",
      builder: dotnetCoreBuilder(),
    })
    .withProjectListener(DotnetCoreVersionProjectListener);

  dockerBuild
    .with({
        options: {
          push: true,
          ...sdm.configuration.sdm.dockerinfo,
        },
        pushTest: allSatisfied(IsMaven, HasDockerfile),
      })
        .withProjectListener(MvnVersion)
        .withProjectListener(MvnPackage)

    .with({
        options: { push: true, ...sdm.configuration.sdm.dockerinfo },
        pushTest: allSatisfied(IsNode, HasDockerfile),
      })
        .withProjectListener(NodeModulesProjectListener)
        .withProjectListener(NpmCompileProjectListener)
        .withProjectListener(NpmVersionProjectListener)

    .with({
      options: { push: true, ...sdm.configuration.sdm.dockerinfo },
      pushTest: allSatisfied(isDotNetCore, HasDockerfile),
    });

  /**
   * Deployments
   */
  cfDeployment
    .with({ environment: "production", strategy: CloudFoundryDeploymentStrategy.API });

  cfDeploymentStaging
    .with({ environment: "staging", strategy: CloudFoundryDeploymentStrategy.API });

  ecsDeployProd
    .with({
      region: "us-east-1",
      pushTest: allSatisfied(IsEcsDeployable, HasDockerfile),
      serviceRequest: {
        cluster: "fooecs2", // EC2 Cluster
      },
      roleDetail: {
        RoleArn: "arn:aws:iam::247672886355:role/test_ecs_role",
        RoleSessionName: "ecs_example",
      },
    });

  ecsDeployStaging
    .with({
      region: "us-east-1",
      pushTest: allSatisfied(IsEcsDeployable, HasDockerfile),
      serviceRequest: {
        cluster: "foo", // FARGATE Cluster
      },
      roleDetail: {
        RoleArn: "arn:aws:iam::247672886355:role/test_ecs_role",
        RoleSessionName: "ecs_example",
      },
    });

  const k8sRegistration = {
    // name: "@atomist/k8s-sdm_kubernetes",
    applicationData: k8sCallback,
  };

  k8sStagingDeploy
    .with(k8sRegistration);

  k8sBlueProd
    .with(k8sRegistration);

  k8sGreenProd
    .with(k8sRegistration);

  fingerprintComplianceGoal
    .with(
      {
        name: "fingerprint-compliance-waiting",
      },
    );

  return sdm;
}
