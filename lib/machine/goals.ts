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
  NodeModulesProjectListener,
  NodeProjectVersioner, NpmCompileProjectListener, NpmProgressReporter,
  NpmVersionProjectListener,
} from "@atomist/sdm-pack-node";
import { Version } from "@atomist/sdm-core";
import { Build } from "@atomist/sdm-pack-build";
import { KubernetesDeploy } from "@atomist/sdm-pack-k8s";
import { hasJenkinsfile } from "../support/preChecks";
import * as fs from "fs";
import * as _ from "lodash";
import { ApplicationDataCallback } from "@atomist/sdm-pack-k8s/lib/deploy/goal";

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

// Builds
export const mavenBuild = new Build()
    .with({
        ...MavenDefaultOptions,
        name: "maven-run-build",
        builder: mavenBuilder([{ name: "maven-run-build" }]),
        pushTest: MavenDefaultOptions.pushTest,
    });

// Builds
export const externalBuild = new Build();
export const nodeBuild = new Build();
export const dockerBuild = new DockerBuild();

// Kubernetes Deploys
export const k8sStagingDeploy = new KubernetesDeploy({ environment: "testing", approval: true });
export const k8sProductionDeploy = new KubernetesDeploy({ environment: "production" });

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
  dockerBuild
    .with({
        options: {
          builder: fs.existsSync("/kaniko/executor") ? "kaniko" : "docker",
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
        .withProjectListener(NpmVersionProjectListener);

  cfDeployment
    .with({ environment: "production", strategy: CloudFoundryDeploymentStrategy.API });

  cfDeploymentStaging
    .with({ environment: "staging", strategy: CloudFoundryDeploymentStrategy.API });

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

  fingerprintComplianceGoal
    .with(
      {
        name: "fingerprint-compliance-waiting",
      },
    );

  k8sStagingDeploy
    .with({
      name: "@atomist/k8s-sdm_gke-cluster-1",
      applicationData: k8sCallback,
    });

  k8sProductionDeploy
    .with({
      name: "@atomist/k8s-sdm_gke-cluster-1",
      applicationData: k8sCallback,
    });

  return sdm;
}
