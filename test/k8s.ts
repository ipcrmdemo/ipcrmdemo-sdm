import * as k8s from "@kubernetes/client-node";
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.Core_v1Api);
const t = async () => {
  return k8sApi.listNamespacedService("production");
};

t().then(f => {
  process.stdout.write(JSON.stringify(f, undefined, 2));
});
