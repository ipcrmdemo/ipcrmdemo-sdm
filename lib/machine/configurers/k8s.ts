import { GoalConfigurer } from "@atomist/sdm-core";
import { MyGoals } from "../goals";
import * as _ from "lodash";
import { KubernetesApplicationDataCallback } from "@atomist/sdm-pack-k8s";
import { GoalExecutionListener, GoalExecutionListenerInvocation, GoalProjectListenerEvent } from "@atomist/sdm";
import { addressEvent } from "@atomist/automation-client";
import { AppDeployment } from "../../typings/types";
import { updateAppDeployment } from "../../support/goals/updateAppDeployment";

export const K8sDeployConfigurator: GoalConfigurer<MyGoals> = async (sdm, goals) => {
  goals.k8sStagingDeployment.with({
    name: "@atomist/k8s-sdm_kubernetes",
    applicationData: k8sCallback,
  })
    .withExecutionListener(updateAppDeployment("kubernetes/testing"));

  goals.k8sProductionDeployment.with({
    name: "@atomist/k8s-sdm_kubernetes",
    applicationData: k8sCallback,
  })
    .withExecutionListener(updateAppDeployment("kubernetes/production"));
};

const k8sCallback: KubernetesApplicationDataCallback = async (a, p, g, e) => {
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
