import { GoalConfigurer } from "@atomist/sdm-core";
import { MyGoals } from "../goals";
import { ApplicationDataCallback } from "@atomist/sdm-pack-k8s/lib/deploy/goal";
import * as _ from "lodash";

export const K8sDeployConfigurator: GoalConfigurer<MyGoals> = async (sdm, goals) => {
  goals.k8sStagingDeployment.with({
    name: "@atomist/k8s-sdm_kubernetes",
    applicationData: k8sCallback,
  });

  goals.k8sProductionDeployment.with({
    name: "@atomist/k8s-sdm_kubernetes",
    applicationData: k8sCallback,
  });
};

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
