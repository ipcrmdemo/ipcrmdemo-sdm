// Fingerprint Compliance
import {
  allSatisfied, GoalProjectListener,
  GoalProjectListenerEvent,
  GoalWithFulfillment,
  LogSuppressor,
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
import { KubernetesDeploy } from "@atomist/sdm-pack-k8";
import { hasJenkinsfile } from "../support/preChecks";
import * as fs from "fs";
import { buttonForCommand, logger, QueryNoCacheOptions } from "@atomist/automation-client";
import { GetPrByOwnerNameSourceBranch } from "../typings/types";

export const openPrListener: GoalProjectListener = async (p, r, event1) => {
  logger.debug(`openPrButton => Listener fired`);
  const pr = await r.context.graphClient
    .query<GetPrByOwnerNameSourceBranch.Query, GetPrByOwnerNameSourceBranch.Variables>({
      name: "GetPrByOwnerNameSourceBranch",
      variables: {
        name: r.goalEvent.repo.name,
        owner: r.goalEvent.repo.owner,
        sourceBranch: r.goalEvent.branch,
      },
      options: QueryNoCacheOptions,
    });

  if (event1 === GoalProjectListenerEvent.after && p.branch !== "master" && pr.PullRequest.length === 0) {
    logger.debug(`openPrButton => Branch wasn't master and after build`);
    if (r.goalEvent.state !== SdmGoalState.failure) {
      logger.debug(`openPrButton => Running raise PR logic`);
      // Create a raise PR button
      await r.addressChannels({
        attachments: [
          {
            pretext: `Open new PR for branch ${p.branch}?`,
            fallback: `Open new PR for branch ${p.branch}?`,
            actions: [
              buttonForCommand({text: "Raise PR"}, "RaisePrForBranch",
                {
                  name: r.goalEvent.repo.name,
                  owner: r.goalEvent.repo.owner,
                  branch: p.branch,
                  sha: r.goalEvent.push.after.sha }),
            ],
          },
        ],
      }, {
        id:
          `openPR/${r.goalEvent.repo.owner}/${r.goalEvent.repo.name}/` +
          `${p.branch}/master/${r.goalEvent.push.after.sha }`,
      });
    }
  }
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

// Builds
export const mavenBuild = new Build()
    .with({
        ...MavenDefaultOptions,
        name: "maven-run-build",
        builder: mavenBuilder([{ name: "maven-run-build" }]),
        pushTest: MavenDefaultOptions.pushTest,
    })
  .withProjectListener({
    name: "openPrButton",
    listener: openPrListener,
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
    })
    .withProjectListener({
      name: "openPrButton",
      listener: openPrListener,
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

  return sdm;
}

