import { SdmGoalEvent } from "@atomist/sdm";
import { KubernetesApplication } from "@atomist/sdm-pack-k8s";
import { ApplicationDataCallback } from "@atomist/sdm-pack-k8s/lib/deploy/goal";
import { logger } from "@atomist/automation-client";
import * as _ from "lodash";

const setBgDeploymentDetails = async (
  e: SdmGoalEvent,
  a: KubernetesApplication,
): Promise<KubernetesApplication> => {
  if (e.uniqueName.includes("k8sgreenprod") || e.uniqueName.includes("k8sblueprod")) {
    const re = /(blue|green)/;
    const match = re.exec(e.uniqueName);

    logger.debug(`setBgDeploymentDetails => This deploy is ${match[0]}`);
    a.name = `${a.name}${match[0]}`;
    a.path = `/${a.ns}/${a.name}`;
  }

  return a;
};

export const k8sCallback: ApplicationDataCallback = async (a, p, g, e) => {
  a.ns = e.environment.includes("prod") ? "production" : "testing";
  a.path = `/${a.ns}/${p.name}`;
  const app = await setBgDeploymentDetails(e, a);

  let annotations: any;
  if (
    app.ingressSpec &&
    app.ingressSpec.metadata &&
    app.ingressSpec.metadata.annotations
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

  a.ingressSpec = _.merge(a.ingressSpec, {
    metadata: {
      annotations,
    },
  });

  return app;
};
