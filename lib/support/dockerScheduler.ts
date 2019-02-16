/*
 * Copyright © 2019 Atomist, Inc.
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

import { AutomationContextAware } from "@atomist/automation-client";
import {
  ExecuteGoalResult,
  GoalInvocation,
  GoalScheduler,
  mergeOptions,
  spawnLog,
} from "@atomist/sdm";
import { isConfiguredInEnv } from "@atomist/sdm-core";
import * as _ from "lodash";

export interface DockerGoalSchedulerOptions {
  isolateAll?: boolean;
  image?: string;
  args?: string[];
}

export class DockerGoalScheduler implements GoalScheduler {

  constructor(private readonly options: DockerGoalSchedulerOptions = { isolateAll: false }) {
  }

  public async supports(gi: GoalInvocation): Promise<boolean> {
    return !process.env.ATOMIST_ISOLATED_GOAL &&
      (
        // Goal is marked as isolated and SDM is configured to use docker containers
        (gi.goal.definition.isolated && isConfiguredInEnv("docker")) ||
        // Force all goals to run isolated via env var
        isConfiguredInEnv("docker-all") ||
        // Force all goals to run isolated via explicit option
        (this.options.isolateAll && isConfiguredInEnv("docker")) ||
        // Force all goals to run isolated via explicit configuration
        _.get(gi.configuration, "sdm.docker.job.isolateAll", false) === true
      );
  }

  public async schedule(gi: GoalInvocation): Promise<ExecuteGoalResult> {

    const { goalEvent, context, configuration, progressLog } = gi;

    const optsToUse = mergeOptions<DockerGoalSchedulerOptions>(
      {
        isolateAll: false,
        image: `${configuration.name.replace("@", "")}:${configuration.version}`,
        args: [] },
      this.options,
      "docker.job");

    const goalName = goalEvent.uniqueName.split("#")[0].toLowerCase();

    const containerName = `${configuration.name.split("/")[1]}-job-${goalEvent.goalSetId.slice(0, 7)}-${goalName}`;
    const dockerArgs = [];

    dockerArgs.push("run", "-d");
    dockerArgs.push("--name", containerName);
    dockerArgs.push("-e", `ATOMIST_JOB_NAME=${containerName}`);
    dockerArgs.push("-e", `ATOMIST_REGISTRATION_NAME=${configuration.name}-job-${goalEvent.goalSetId.slice(0, 7)}-${goalName}`);
    dockerArgs.push("-e", `ATOMIST_GOAL_TEAM=${context.workspaceId}`);
    dockerArgs.push("-e", `ATOMIST_GOAL_TEAM_NAME=${(context as any as AutomationContextAware).context.workspaceName}`);
    dockerArgs.push("-e", `ATOMIST_GOAL_ID=${(goalEvent as any).id}`);
    dockerArgs.push("-e", `ATOMIST_GOAL_SET_ID=${goalEvent.goalSetId}`);
    dockerArgs.push("-e", `ATOMIST_GOAL_UNIQUE_NAME=${goalEvent.uniqueName}`);
    dockerArgs.push("-e", `ATOMIST_CORRELATION_ID=${context.correlationId}`);
    dockerArgs.push("-e", `ATOMIST_ISOLATED_GOAL=true`);
    dockerArgs.push(...(optsToUse.args || []));
    dockerArgs.push(optsToUse.image);

    progressLog.write(`/--`);
    progressLog.write(
      `Scheduling docker container '${containerName}' for goal '${goalEvent.name} (${goalEvent.uniqueName})'`);
    progressLog.write("\\--");

    const result = await spawnLog(
      "docker",
      dockerArgs,
      {
        logCommand: true,
        log: progressLog,
      });

    return result;
  }

}
