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
import { IsMaven } from "@atomist/sdm-pack-spring";
import { DoNotSetAnyGoalsAndLock, or } from "@atomist/sdm";
import { IsNode } from "@atomist/sdm-pack-node";
import { isDotNetCore } from "./lib/support/dotnet/support";
import { hasJenkinsfile } from "./lib/support/preChecks";
import { HasDockerfile } from "@atomist/sdm-pack-docker";
import { IsEcsDeployable, IsK8sDeployable, ZeroCommitPushTest } from "./lib/support/pushTests";
import { HasCloudFoundryManifest } from "@atomist/sdm-pack-cloudfoundry";
import { ExternalBuildConfigurator } from "./lib/machine/configurers/externalBuilds";

export const configuration: Configuration = configure<MyGoals>(async sdm => {
  const goals = await sdm.createGoals(MyGoalCreator, [
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
  ]);
  return {
    /**
     * GoalSet Definitions
     */
    lock: {
      test: ZeroCommitPushTest,
      goals: [DoNotSetAnyGoalsAndLock],
    },
    cancel: {
      goals: [goals.cancel],
      dependsOn: ["lock"],
    },
    check: {
      test: or(IsMaven, IsNode, isDotNetCore),
      goals: [ goals.autofix, [goals.codeInspection, goals.pushImpact] ],
      dependsOn: ["cancel"],
    },
    build: {
      test: or(IsMaven, IsNode, isDotNetCore, hasJenkinsfile),
      goals: [ goals.version, goals.build ],
      dependsOn: ["check"],
    },
    dockerBuild: {
      test: HasDockerfile,
      goals: [ goals.dockerBuild ],
      dependsOn: ["build"],
    },
    pcfDeploy: {
      test: HasCloudFoundryManifest,
      goals: [goals.pcfStagingDeploy, goals.pcfProductionDeploy],
      dependsOn: ["build"],
    },
    ecsDeploy: {
      test: IsEcsDeployable,
      goals: [goals.ecsStagingDeploy, goals.ecsProductionDeploy],
      dependsOn: ["dockerBuild"],
    },
    k8sDeploy: {
      test: IsK8sDeployable,
      goals: [goals.k8sStagingDeployment, goals.k8sProductionDeployment],
      dependsOn: ["dockerBuild"],
    },
  };
}, {
  requiredConfigurationValues: [],
  postProcessors: [
    configureDashboardNotifications,
  ],
});
