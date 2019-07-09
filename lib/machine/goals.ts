// Fingerprint Compliance
import {
  allSatisfied,
  GoalWithFulfillment,
  LogSuppressor,
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
  NodeProjectVersioner,
  NpmCompileProjectListener, NpmInstallProjectListener,
  NpmProgressReporter,
  NpmVersionProjectListener,
} from "@atomist/sdm-pack-node";
import { cachePut, cacheRemove, cacheRestore, GoalCacheOptions, Version } from "@atomist/sdm-core";
import { Build } from "@atomist/sdm-pack-build";
import { KubernetesDeploy } from "@atomist/sdm-pack-k8s";
import { hasJenkinsfile } from "../support/preChecks";
import * as _ from "lodash";
import { ApplicationDataCallback } from "@atomist/sdm-pack-k8s/lib/deploy/goal";
import {
  dotnetCoreBuilder,
  DotnetCoreProjectVersioner,
  DotnetCoreVersionProjectListener,
} from "@atomist/sdm-pack-analysis-dotnet";
import { isDotNetCore } from "../support/dotnet/support";
import { EcsDeploy } from "@atomist/sdm-pack-ecs";
import { IsEcsDeployable } from "../support/pushTests";

/**
 * Cache Definitions
 */
const mavenJarCache: GoalCacheOptions = {
  entries: [{classifier: "jars", pattern: {globPattern: "**/target/*.jar"}}],
  onCacheMiss: [MvnVersion, MvnPackage],
};

const NodeModulesCacheOptions: GoalCacheOptions = {
  entries: [
    { classifier: "nodeModules", pattern: { directory: "node_modules" } },
  ],
  onCacheMiss: [NpmInstallProjectListener],
};

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
    })
   .withProjectListener(cachePut(mavenJarCache));

export const externalBuild = new Build();
export const nodeBuild = new Build();
export const dockerBuild = new DockerBuild();
export const dotNetBuild = new Build({ displayName: "dotnet build" });

// Kubernetes Deploys
export const k8sStagingDeploy = new KubernetesDeploy({ environment: "testing", approval: true });
export const k8sProductionDeploy = new KubernetesDeploy({ environment: "production" });

// ECS Deployment
export const ecsDeployStaging = new EcsDeploy({
  displayName: "ECS Deploy Staging",
  approval: true,
  retry: true,
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
  retry: true,
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

const k8sCallback: ApplicationDataCallback = async (a, p, g, e) => {
  a.ns = e.environment.includes("prod") ? "production" : "testing";
  a.path = `/${a.ns}/${p.name}`;

  let annotations: any;
  if (
    a.ingressSpec &&
    a.ingressSpec.metadata &&
    a.ingressSpec.metadata.annotations
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
  a.ingressSpec = {
    metadata: {
      annotations,
    },
  };
  return a;
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
    })
    .withProjectListener(cachePut(NodeModulesCacheOptions));

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
        push: true,
        registry:  {
          ...sdm.configuration.sdm.dockerinfo,
        },
        pushTest: allSatisfied(IsMaven, HasDockerfile),
      })
      .withProjectListener(cacheRestore(mavenJarCache))
      .withProjectListener(cacheRemove(mavenJarCache))

    .with({
        push: true,
        registry:  {
          ...sdm.configuration.sdm.dockerinfo,
        },
        pushTest: allSatisfied(IsNode, HasDockerfile),
      })
        .withProjectListener(cacheRestore(NodeModulesCacheOptions))
        .withProjectListener(NpmCompileProjectListener)
        .withProjectListener(NpmVersionProjectListener)
        .withProjectListener(cacheRemove(NodeModulesCacheOptions))

    .with({
        push: true,
        registry:  {
          ...sdm.configuration.sdm.dockerinfo,
        },
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
        cluster: "prod", // EC2 Cluster
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
        cluster: "nonProd", // FARGATE Cluster
      },
      roleDetail: {
        RoleArn: "arn:aws:iam::247672886355:role/test_ecs_role",
        RoleSessionName: "ecs_example",
      },
    });

  k8sStagingDeploy
    .with({
      name: "@atomist/k8s-sdm_kubernetes",
      applicationData: k8sCallback,
    });

  k8sProductionDeploy
    .with({
      name: "@atomist/k8s-sdm_kubernetes",
      applicationData: k8sCallback,
    });

  fingerprintComplianceGoal
    .with(
      {
        name: "fingerprint-compliance-waiting",
      },
    );

  return sdm;
}
