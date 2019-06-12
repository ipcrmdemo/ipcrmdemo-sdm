// Fingerprint Compliance
import {
  allSatisfied,
  GoalWithFulfillment,
  LogSuppressor, SdmGoalEvent,
  SoftwareDeliveryMachine
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
  NodeProjectVersioner, NpmCompileProjectListener, NpmProgressReporter,
  NpmVersionProjectListener,
} from "@atomist/sdm-pack-node";
import { Version } from "@atomist/sdm-core";
import { Build } from "@atomist/sdm-pack-build";
import { KubernetesApplication, KubernetesDeploy } from "@atomist/sdm-pack-k8s";
import { hasJenkinsfile } from "../support/preChecks";
import * as _ from "lodash";
import { ApplicationDataCallback } from "@atomist/sdm-pack-k8s/lib/deploy/goal";
import { dotnetCoreBuilder,
  DotnetCoreProjectVersioner,
  DotnetCoreVersionProjectListener,
} from "@atomist/sdm-pack-analysis-dotnet";
import { isDotNetCore } from "../support/dotnet/support";
import { EcsDeploy } from "@atomist/sdm-pack-ecs";
import { IsEcsDeployable } from "../support/pushTests";

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
export const dotNetBuild = new Build({ displayName: "dotnet build" })

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

export const k8s10CanaryDeploy = new KubernetesDeploy(
  {
    uniqueName: "10canary",
    environment: "production",
    preApproval: true,
    displayName: "Canary Deployment to K8s `production` (10%)",
    descriptions: {
      planned: "Canary deployment to K8s `production` planned (10%)",
      requested: "Canary deployment to K8s `production` pending (10%)",
      stopped: "Canary deployment to K8s `production` stopped (10%)",
      inProcess: "Canary deployment to K8s `production` running (10%)",
      completed: "Canary deployment to K8s `production` completed (10%)",
      failed: "Canary deployment to K8s `production` failed (10%)",
      waitingForApproval: "Canary deployment to K8s `production` pending approval (10%)",
      waitingForPreApproval: "Canary deployment to K8s `production` pending pre-approval (10%)",
    },
  });

export const k8s50CanaryDeploy = new KubernetesDeploy(
  {
    uniqueName: "50canary",
    environment: "production",
    preApproval: true,
    displayName: "Canary Deployment to K8s `production` (50%)",
    descriptions: {
      planned: "Canary deployment to K8s `production` planned (50%)",
      requested: "Canary deployment to K8s `production` pending (50%)",
      stopped: "Canary deployment to K8s `production` stopped (50%)",
      completed: "Canary deployment to K8s `production` completed (50%)",
      inProcess: "Canary deployment to K8s `production` running (50%)",
      failed: "Canary deployment to K8s `production` failed (50%)",
      waitingForApproval: "Canary deployment to K8s `production` pending approval (50%)",
      waitingForPreApproval: "Canary deployment to K8s `production` pending pre-approval (50%)",
    },
  });

export const k8sProductionDeploy = new KubernetesDeploy({
  environment: "production",
  displayName: "Promote Canary to K8s `production`",
  uniqueName: "k8sDeployToProd",
  preApproval: true,
  descriptions: {
    planned: "Promote Canary deployment to K8s `production` planned",
    requested: "Promote Canary deployment to K8s `production` requested",
    stopped: "Promote Canary deployment to K8s `production` stopped",
    completed: "Promote Canary deployment to K8s `production` completed",
    inProcess: "Promote Canary deployment to K8s `production` running",
    failed: "Promote Canary deployment to K8s `production` failed",
    waitingForPreApproval: "Promote Canary deployment to K8s `production` pending pre-approval",
    waitingForApproval: "Promote Canary deployment to K8s `production` pending approval",
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

const setCanaryIngressAnnotations = async (e: SdmGoalEvent, annotation: any): Promise<any> => {
  if (e.uniqueName.includes("canary")) {
    const updatedAnnotation = _.merge({
      "nginx.ingress.kubernetes.io/canary": "true",
      "nginx.ingress.kubernetes.io/canary-weight": e.uniqueName.split("canary")[0],
    }, annotation);
    return updatedAnnotation;
  } else {
    return annotation;
  }
};

const setCanaryDeploymentDetails = async (
  e: SdmGoalEvent,
  a: KubernetesApplication,
): Promise<KubernetesApplication> => {
  if (e.uniqueName.includes("canary")) {
    a.name = `${a.name}canary`;
  }

  return a;
};

const k8sCallback: ApplicationDataCallback = async (a, p, g, e) => {
  const app = await setCanaryDeploymentDetails(e, a);
  app.ns = e.environment.includes("prod") ? "production" : "testing";
  app.path = `/${app.ns}/${p.name}`;

  let annotations: any;
  if (
    app.ingressSpec &&
    app.ingressSpec.metadata &&
    app.ingressSpec.metadata.annotations
  ) {
    annotations = await setCanaryIngressAnnotations(e, _.merge({
        "kubernetes.io/ingress.class": "nginx",
        "nginx.ingress.kubernetes.io/rewrite-target": "/",
        "nginx.ingress.kubernetes.io/ssl-redirect": "false",
      },
      a.ingressSpec.metadata.annotations,
    ));
  } else {
    annotations = await setCanaryIngressAnnotations(e, {
      "kubernetes.io/ingress.class": "nginx",
      "nginx.ingress.kubernetes.io/rewrite-target": "/",
      "nginx.ingress.kubernetes.io/ssl-redirect": "false",
    });
  }
  a.ingressSpec = {
    metadata: {
      annotations,
    },
  };
  return app;
};

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
    name: "@atomist/k8s-sdm_kubernetes",
    applicationData: k8sCallback,
  };

  k8sStagingDeploy
    .with(k8sRegistration);

  k8s10CanaryDeploy
    .with(k8sRegistration);

  k8s50CanaryDeploy
    .with(k8sRegistration);

  k8sProductionDeploy
    .with(k8sRegistration);

  fingerprintComplianceGoal
    .with(
      {
        name: "fingerprint-compliance-waiting",
      },
    );

  return sdm;
}
