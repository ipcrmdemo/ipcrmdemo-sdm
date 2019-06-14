// Fingerprint Compliance
import {
  allSatisfied,
  DefaultGoalNameGenerator, ExecuteGoal, ExecuteGoalResult,
  FulfillableGoalDetails,
  FulfillableGoalWithRegistrations,
  getGoalDefinitionFrom, Goal, GoalInvocation,
  GoalProjectListenerEvent,
  GoalProjectListenerRegistration,
  GoalWithFulfillment,
  LogSuppressor,
  SdmGoalEvent,
  SdmGoalState,
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
import { KubernetesApplication, KubernetesDeploy, KubernetesDeployRegistration } from "@atomist/sdm-pack-k8s";
import { hasJenkinsfile } from "../support/preChecks";
import * as _ from "lodash";
import {
  ApplicationDataCallback,
  defaultDataSources,
} from "@atomist/sdm-pack-k8s/lib/deploy/goal";
import {
  dotnetCoreBuilder,
  DotnetCoreProjectVersioner,
  DotnetCoreVersionProjectListener,
} from "@atomist/sdm-pack-analysis-dotnet";
import { isDotNetCore } from "../support/dotnet/support";
import { EcsDeploy } from "@atomist/sdm-pack-ecs";
import { IsEcsDeployable } from "../support/pushTests";
import { logger } from "@atomist/automation-client";
import { generateKubernetesGoalEventData, getKubernetesGoalEventData } from "@atomist/sdm-pack-k8s/lib/deploy/data";
import { upsertService } from "@atomist/sdm-pack-k8s/lib/kubernetes/service";
import { loadKubeConfig } from "@atomist/sdm-core/lib/pack/k8s/config";
import { makeApiClients } from "@atomist/sdm-pack-k8s/lib/kubernetes/clients";
import { upsertIngress } from "@atomist/sdm-pack-k8s/lib/kubernetes/ingress";

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

export function initiateKubernetesServiceChange(
  k8Deploy: KubernetesDeploy,
  registration: KubernetesDeployRegistration,
): ExecuteGoal {
  return async (goalInvocation: GoalInvocation): Promise<ExecuteGoalResult> => {
    const currentDeploy = await goalInvocation.preferences.get(
      `${goalInvocation.goalEvent.repo.name}`, {scope: `bgdeploy`, defaultValue: undefined});

    const activeDeploy = (currentDeploy !== BlueGreenDeploy.blue || currentDeploy === undefined)
        ? BlueGreenDeploy.green : BlueGreenDeploy.blue;

    defaultDataSources(registration);
    const goalEvent = await generateKubernetesGoalEventData(k8Deploy, registration, goalInvocation);
    const app = getKubernetesGoalEventData(goalEvent);

    app.ns = goalInvocation.goalEvent.environment.includes("prod") ? "production" : "testing";
    app.path = `/${app.ns}/${goalInvocation.goalEvent.repo.name}`;
    app.ingressSpec = {
      spec: {
        rules: [
          {
            http: {
              paths: [
                {
                  path: `${app.path}`,
                  backend: { serviceName: `${app.name}${BlueGreenDeploy[activeDeploy]}`},
                },
              ],
            },
          },
        ],
      },
    };

    let config: any;
    try {
      config = loadKubeConfig();
    } catch (e) {
      e.message = `Failed to load Kubernetes config to deploy ${app.ns}/${app.name}: ${e.message}`;
      logger.error(e.message);
      throw e;
    }
    const clients = makeApiClients(config);
    const req = { ...app, ...{sdmFulfiller: "local"}, clients };

    await upsertIngress(req);

    await goalInvocation.preferences.put(
      `${goalInvocation.goalEvent.push.repo.name}`, activeDeploy, {scope: `bgdeploy`});

    return {
      code: 0,
    };
  };
}

export class KubernetesManageServiceTraffic extends KubernetesDeploy {
  constructor(public readonly details?: FulfillableGoalDetails, ...dependsOn: Goal[]) {
    super(getGoalDefinitionFrom(details, DefaultGoalNameGenerator.generateName("traffic-updater")), ...dependsOn);
  }
  public with(registration: KubernetesDeployRegistration): this {
    const fulfillment = registration.name || this.sdm.configuration.name;
    this.addFulfillment({
      name: fulfillment,
      goalExecutor: initiateKubernetesServiceChange(this, registration),
      pushTest: registration.pushTest,
    });
    return this;
  }
}

export const k8sTrafficUpdate = new KubernetesManageServiceTraffic(
  {
    uniqueName: "k8sTrafficSwitcher",
    preApproval: true,
    environment: "production",
    displayName: "Flip traffic to Blue/Green Deployment",
  },
);

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

const setBgDeploymentDetails = async (
  e: SdmGoalEvent,
  a: KubernetesApplication,
): Promise<KubernetesApplication> => {
  if (e.uniqueName.includes("k8sgreenprod") || e.uniqueName.includes("k8sblueprod")) {
    const re = /(blue|green)/;
    const match = re.exec(e.uniqueName);

    logger.debug(`setBgDeploymentDetails => This deploy is ${match[0]}`);
    const oldName = a.name;
    a.name = `${a.name}${match[0]}`;
    a.path = `/${a.ns}/${a.name}`;
  }

  return a;
};

const k8sCallback: ApplicationDataCallback = async (a, p, g, e) => {
  a.ns = e.environment.includes("prod") ? "production" : "testing";
  a.path = `/${a.ns}/${p.name}`;
  const app = await setBgDeploymentDetails(e, a);

  let annotations: any;
  if (
    app.ingressSpec &&
    app.ingressSpec.metadata &&
    app.ingressSpec.metadata.annotations
  ) {
    annotations = _.merge({
        "kubernetes.io/ingress.class": "nginx",
        "nginx.ingress.kubernetes.io/rewrite-target": "/",
        "nginx.ingress.kubernetes.io/ssl-redirect": "false",
      },
      a.ingressSpec.metadata.annotations,
    );
  } else {
    annotations = {
      "kubernetes.io/ingress.class": "nginx",
      "nginx.ingress.kubernetes.io/rewrite-target": "/",
      "nginx.ingress.kubernetes.io/ssl-redirect": "false",
    };
  }

  a.ingressSpec = _.merge(a.ingressSpec, {
    metadata: {
      annotations,
    },
  });

  return app;
};

export enum BlueGreenDeploy {
  blue = 0,
  green = 1,
}

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

  k8sTrafficUpdate
    .with(k8sRegistration);

  fingerprintComplianceGoal
    .with(
      {
        name: "fingerprint-compliance-waiting",
      },
    );

  return sdm;
}
