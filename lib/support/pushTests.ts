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

import { logger } from "@atomist/automation-client";
import {
  predicatePushTest,
  PredicatePushTest,
  pushTest,
  PushTest,
} from "@atomist/sdm";
import { BlueGreenDeploy } from "../machine/k8sTraffic";

export const IsEcsDeployable: PredicatePushTest = predicatePushTest(
  "IsEcsDeployable",
  async p => {
    const td = await p.hasFile(".atomist/ecs/task-definition.json") ?
      (await p.getFile(".atomist/ecs/task-definition.json")).getContent() :
      undefined;

    const sd = await p.hasFile(".atomist/ecs/service.json") ?
      (await p.getFile(".atomist/ecs/service.json")).getContent() :
      undefined;

    return !!(td || sd);
  },
);

export const IsK8sDeployable: PredicatePushTest = predicatePushTest(
  "IsK8sDeployable",
  async p => {
    return !!(
      await p.hasFile(".atomist/kubernetes/deployment.json") ||
      await p.hasFile(".atomist/kubernetes/deployment.yaml")
    );
  },
);

export const isGreenDeploy = pushTest("bg-check", async pi => {
  const currentDeploy = await pi.preferences.get(
    `${pi.push.repo.name}`, {scope: `bgdeploy`, defaultValue: undefined});
  return currentDeploy !== BlueGreenDeploy.green && currentDeploy !== undefined;
});

export const isBlueDeploy = pushTest("bg-check", async pi => {
  const currentDeploy = await pi.preferences.get(
    `${pi.push.repo.name}`, {scope: `bgdeploy`, defaultValue: undefined});
  return currentDeploy !== BlueGreenDeploy.blue || currentDeploy === undefined;
});

export const ZeroCommitPushTest = pushTest("zero-commits", async pi => pi.push.commits.length === 0);
export const IsSdmProject: PredicatePushTest = predicatePushTest(
  "IsSdmProject",
  async p => {

      const hasPackageJson = await p.hasFile("package.json");
      if (!hasPackageJson) {
          return false;
      }
      const packageJson = await p.getFile("package.json");
      const packageDetails = await packageJson.getContent();
      const parsed = JSON.parse(packageDetails);
      const deps = {
          ...parsed.dependencies,
          ...parsed.devDependencies,
      };
      const sdm = deps.hasOwnProperty("@atomist/sdm");
      const sdmLocal = deps.hasOwnProperty("@atomist/sdm-local");

      return !!(sdm || sdmLocal);
  },
);

export function isNamed(...names: string[]): PushTest {
    return pushTest(`Project name is one of these '${names.join(", ")}'`, async pci => {
        if (names.includes(pci.project.name)) {
            logger.info(
                "True: Project %s (in repo %s) in my list of names, which is %s",
                pci.project.name, pci.id.repo, names);
            return true;
        } else {
            logger.info(
                "False: Project %s (in repo %s) is not in my list of names, which is %s",
                pci.project.name, pci.id.repo, names);
            return false;
        }
    });
}

export function isTeam(...teams: string[]): PushTest {
    return pushTest(`Atomist team is one of these '${teams.join(", ")}'`, async pci => {
        return teams.includes(pci.context.workspaceId);
    });
}
