import { CodeTransform, predicatePushTest, PredicatePushTest } from "@atomist/sdm";
import { projectUtils } from "@atomist/automation-client";
import { microgrammar } from "@atomist/microgrammar";
import * as k8s from "@kubernetes/client-node";
import { DeepPartial } from "ts-essentials";

/**
 * Microgrammar to extract TargetFramework from a .csproj file
 */
export const dotnetCoreGrammar = microgrammar<{ target: string }>({
  // tslint:disable-next-line:no-invalid-template-strings
  phrase: "<TargetFramework>${target}</TargetFramework>",
  terms: {
    target: /[a-zA-Z_\.0-9\-]+/,
  },
});

export const DotnetCoreProjectFileGlob = "*.csproj";
export const isDotNet: PredicatePushTest = predicatePushTest(
  "isDotNetCore",
  async p => {
    return projectUtils.fileExists(p, "**/*.csproj");
  });
export const isDotNetCore: PredicatePushTest = predicatePushTest(
  "isDotNetCore",
  async p => {
    const csprojFiles = await projectUtils.gatherFromFiles(p, [DotnetCoreProjectFileGlob, "**/*.csproj"], async f => f);
    if (!csprojFiles || csprojFiles.length === 0) {
      return false;
    }
    const csproj = await csprojFiles[0].getContent();
    const targetMatch = dotnetCoreGrammar.firstMatch(csproj);
    if (!targetMatch) {
      return false;
    }
    if (!!targetMatch.target && targetMatch.target.startsWith("netcoreapp")) {
      return true;
    }

    return false;
  },
);

/**
 * 'Simple .NET Core Web Application' transform to add:
 * - deployment.json to run as non root user
 *
 * @param p project created from spring rest project seed.
 * @return the updated project
 */
export const SimpleDotNetCoreWebApplication: CodeTransform = async p => {
  const deployment: DeepPartial<k8s.V1Deployment> = {
    spec: {
      template: {
        spec: {
          containers: [
            {
              securityContext: {
                allowPrivilegeEscalation: false,
                privileged: false,
                readOnlyRootFilesystem: true,
              },
              volumeMounts: [
                {
                  mountPath: "/tmp",
                  name: "tmp",
                },
              ],
            },
          ],
          securityContext: {
            fsGroup: 1001,
            runAsGroup: 1001,
            runAsNonRoot: true,
            runAsUser: 1001,
            supplementalGroups: [],
            sysctls: [],
          },
          volumes: [
            {
              emptyDir: {},
              name: "tmp",
            },
          ],
        },
      },
    },
  };
  await p.addFile(".atomist/kubernetes/deployment.json", JSON.stringify(deployment, undefined, 2));

  return p;
};
