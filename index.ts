/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  configure,
} from "@atomist/sdm-core";
import { configureDashboardNotifications } from "@atomist/automation-client-ext-dashboard";
import {
  MyGoalCreator,
  MyGoals,
} from "./lib/machine/goals";
import { Configuration } from "@atomist/automation-client";
import { MavenGoalConfigurator } from "./lib/machine/configurers/maven";
import { NodeGoalConfigurator } from "./lib/machine/configurers/node";
import { DotNetCoreGoalConfigurator } from "./lib/machine/configurers/dotnet";
import { EcsDeployConfigurator } from "./lib/machine/configurers/ecs";
import { PcfDeployConfigurator } from "./lib/machine/configurers/pcf";
import { K8sDeployConfigurator } from "./lib/machine/configurers/k8s";
import { ExtPacksConfigurator } from "./lib/machine/configurers/extpacks";
import { CommandsConfigurator } from "./lib/machine/configurers/commands";
import { EventConfigurator } from "./lib/machine/configurers/event";
import { GlobalGoalsConfigurator } from "./lib/machine/configurers/globalGoals";
import { ExternalBuildConfigurator } from "./lib/machine/configurers/externalBuilds";
import {
  allSatisfied,
  DoNotSetAnyGoalsAndLock,
  goals,
  onAnyPush,
  or,
  ToDefaultBranch,
  whenPushSatisfies,
} from "@atomist/sdm";
import { IsEcsDeployable, IsK8sDeployable, ZeroCommitPushTest } from "./lib/support/pushTests";
import { IsMaven } from "@atomist/sdm-pack-spring";
import { IsNode } from "@atomist/sdm-pack-node";
import { isDotNetCore } from "./lib/support/dotnet/support";
import { HasDockerfile } from "@atomist/sdm-pack-docker";
import { hasJenkinsfile } from "./lib/support/preChecks";
import { HasCloudFoundryManifest } from "@atomist/sdm-pack-cloudfoundry";
import { IsServerlessDeployable } from "@ipcrm/sdm-pack-serverless";
import { ServerlessConfigurer } from "./lib/machine/configurers/serverless";

export const configuration: Configuration = configure<MyGoals>(async sdm => {
  const setGoals = await sdm.createGoals(MyGoalCreator, [
      GlobalGoalsConfigurator,
      ExtPacksConfigurator,
      CommandsConfigurator,
      EventConfigurator,
      MavenGoalConfigurator,
      NodeGoalConfigurator,
      DotNetCoreGoalConfigurator,
      ExternalBuildConfigurator,
      EcsDeployConfigurator,
      PcfDeployConfigurator,
      K8sDeployConfigurator,
      ServerlessConfigurer,
  ]);

  /**
   * GoalSet Definitions
   */
  const lock = goals("lock").plan(DoNotSetAnyGoalsAndLock);
  const cancel = goals("cancel").plan(setGoals.cancel).after(lock);
  const check = goals("check")
    .plan(setGoals.autofix).after(cancel)
    .plan(setGoals.codeInspection, setGoals.pushImpact).after(setGoals.autofix);

  const build = goals("build")
    .plan(setGoals.version).after(check)
    .plan(setGoals.build).after(setGoals.version);

  const dockerBuild = goals("dockerBuild")
    .plan(setGoals.dockerBuild).after(build);

  const pcfDeploy = goals("pcfDeploy")
    .plan(setGoals.pcfStagingDeploy).after(build)
    .plan(setGoals.pcfProductionDeploy).after(setGoals.pcfStagingDeploy);

  const ecsDeploy = goals("ecsDeploy")
    .plan(setGoals.ecsStagingDeploy).after(dockerBuild)
    .plan(setGoals.ecsProductionDeploy).after(setGoals.ecsStagingDeploy);

  const k8sDeploy = goals("k8sDeploy")
    .plan(setGoals.k8sStagingDeployment).after(dockerBuild)
    .plan(setGoals.k8sProductionDeployment).after(setGoals.k8sStagingDeployment);

  const serverlessDeploy = goals("serverless")
    .plan(setGoals.serverless).after(check);

  /**
   * Push Rules
   */
  sdm.withPushRules(
    whenPushSatisfies(ZeroCommitPushTest)
      .setGoals(lock),

    onAnyPush().setGoals(cancel),
    onAnyPush().setGoals(check),

    // whenPushSatisfies(IsServerlessDeployable)
    //   .setGoals(serverlessDeploy),
    //
    // whenPushSatisfies(or(IsMaven, IsNode, isDotNetCore, hasJenkinsfile))
    //   .setGoals(build),
    //
    // whenPushSatisfies(HasDockerfile)
    //   .setGoals(dockerBuild),
    //
    // whenPushSatisfies(allSatisfied(HasCloudFoundryManifest, ToDefaultBranch))
    //   .setGoals(pcfDeploy),
    //
    // whenPushSatisfies(allSatisfied(IsEcsDeployable, ToDefaultBranch))
    //   .setGoals(ecsDeploy),
    //
    // whenPushSatisfies(allSatisfied(IsK8sDeployable, ToDefaultBranch))
    //   .setGoals(k8sDeploy),
  );

   /**
    *  return {
    *     // GoalSet Definitions
    *    lock: {
    *      test: ZeroCommitPushTest,
    *      goals: [DoNotSetAnyGoalsAndLock],
    *    },
    *    cancel: {
    *      goals: [setGoals.cancel],
    *      dependsOn: ["lock"],
    *    },
    *    check: {
    *      test: or(IsMaven, IsNode, isDotNetCore),
    *      goals: [ setGoals.autofix, [setGoals.codeInspection, setGoals.pushImpact] ],
    *      dependsOn: ["cancel"],
    *    },
    *    build: {
    *      test: or(IsMaven, IsNode, isDotNetCore, hasJenkinsfile),
    *      goals: [ setGoals.version, setGoals.build ],
    *      dependsOn: ["check"],
    *    },
    *    dockerBuild: {
    *      test: HasDockerfile,
    *      goals: [ setGoals.dockerBuild ],
    *      dependsOn: ["build"],
    *    },
    *    pcfDeploy: {
    *      test: allSatisfied(HasCloudFoundryManifest, ToDefaultBranch),
    *      goals: [setGoals.pcfStagingDeploy, setGoals.pcfProductionDeploy],
    *      dependsOn: ["build"],
    *    },
    *    ecsDeploy: {
    *      test: allSatisfied(IsEcsDeployable, ToDefaultBranch),
    *      goals: [setGoals.ecsStagingDeploy, setGoals.ecsProductionDeploy],
    *      dependsOn: ["dockerBuild"],
    *    },
    *    k8sDeploy: {
    *      test: allSatisfied(IsK8sDeployable, ToDefaultBranch),
    *      goals: [setGoals.k8sStagingDeployment, setGoals.k8sProductionDeployment],
    *      dependsOn: ["dockerBuild"],
    *    },
    *  };
    */
}, {
  requiredConfigurationValues: [],
  postProcessors: [
    async c => {
      return c;
    },
    configureDashboardNotifications,
  ],
});
