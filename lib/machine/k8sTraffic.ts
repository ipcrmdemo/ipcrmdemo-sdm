import {
  DefaultGoalNameGenerator, doWithProject,
  ExecuteGoal,
  FulfillableGoalDetails, FulfillableGoalWithRegistrations,
  getGoalDefinitionFrom, Goal,
} from "@atomist/sdm";
import { KubernetesDeploy, KubernetesDeployRegistration } from "@atomist/sdm-pack-k8s";
import { upsertIngress } from "@atomist/sdm-pack-k8s/lib/kubernetes/ingress";
import { generateKubernetesGoalEventData, getKubernetesGoalEventData } from "@atomist/sdm-pack-k8s/lib/deploy/data";
import { defaultDataSources } from "@atomist/sdm-pack-k8s/lib/deploy/goal";
import { makeApiClients } from "@atomist/sdm-pack-k8s/lib/kubernetes/clients";
import { loadKubeConfig } from "@atomist/sdm-pack-k8s/lib/kubernetes/config";
import { logger } from "@atomist/automation-client";
import { k8sCallback } from "../support/k8s/callback";

export enum BlueGreenDeploy {
  blue = 0,
  green = 1,
}

export function initiateKubernetesServiceChange(
  k8Deploy: KubernetesDeploy,
  registration: KubernetesDeployRegistration,
): ExecuteGoal {
  return doWithProject(async pa => {
    const currentDeploy = await pa.preferences.get(
      `${pa.goalEvent.repo.name}`, {scope: `bgdeploy`, defaultValue: undefined});

    const nextDeploy = (currentDeploy !== BlueGreenDeploy.blue || currentDeploy === undefined)
      ? BlueGreenDeploy.blue : BlueGreenDeploy.green;

    defaultDataSources(registration);
    const goalEvent = await generateKubernetesGoalEventData(k8Deploy, registration, pa);
    const app = getKubernetesGoalEventData(goalEvent);

    const updatedApp = await k8sCallback(app, pa.project, k8Deploy, pa.goalEvent, pa.context);
    updatedApp.ingressSpec = {
      spec: {
        rules: [
          {
            http: {
              paths: [
                {
                  path: `${updatedApp.path}`,
                  backend: { serviceName: `${app.name}${BlueGreenDeploy[nextDeploy]}`},
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
      e.message = `Failed to load Kubernetes config to deploy ${updatedApp.ns}/${updatedApp.name}: ${e.message}`;
      logger.error(e.message);
      throw e;
    }
    const clients = makeApiClients(config);
    const req = { ...app, ...{sdmFulfiller: "local"}, clients };

    await upsertIngress(req);

    await pa.preferences.put(
      `${pa.goalEvent.push.repo.name}`, nextDeploy, {scope: `bgdeploy`});

    return {
      code: 0,
      externalUrls: [
        {url: `${updatedApp.protocol ? updatedApp.protocol : "http"}://${updatedApp.host}${updatedApp.path}`},
      ],
    };
  });
}

export class KubernetesManageServiceTraffic extends FulfillableGoalWithRegistrations<KubernetesDeployRegistration> {
  constructor(public readonly details?: FulfillableGoalDetails, ...dependsOn: Goal[]) {
    super(getGoalDefinitionFrom(details, DefaultGoalNameGenerator.generateName("traffic-updater")), ...dependsOn);
  }
  public with(registration: KubernetesDeployRegistration): this {
    this.addFulfillment({
      name: "k8sTrafficUpdate",
      goalExecutor: initiateKubernetesServiceChange(this as any as KubernetesDeploy, registration),
      pushTest: registration.pushTest,
    });
    return this;
  }
}

export const k8sTrafficUpdateBlue = new KubernetesManageServiceTraffic(
  {
    uniqueName: "k8sTrafficSwitcherBlue",
    preApproval: true,
    environment: "production",
    displayName: "Flip traffic to Blue Deployment",
  },
)
  .with({
    applicationData: k8sCallback,
  });

export const k8sTrafficUpdateGreen = new KubernetesManageServiceTraffic(
  {
    uniqueName: "k8sTrafficSwitcherGreen",
    preApproval: true,
    environment: "production",
    displayName: "Flip traffic to Green Deployment",
  },
)
  .with({
    applicationData: k8sCallback,
  });
