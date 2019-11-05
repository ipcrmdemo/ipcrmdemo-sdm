import { GoalConfigurer } from "@atomist/sdm-core";
import { IsK8sDeployable } from "../../support/pushTests";
import { FindK8Deploy } from "../../typings/types";
import { MyGoals } from "../goals";
import { GoalProjectListenerEvent, SdmGoalState } from "@atomist/sdm";
import { Success } from "@atomist/automation-client";

export const OWaspGoalConfigurator: GoalConfigurer<MyGoals> = async (sdm, goals) => {
  goals.owasp
    .with({
      name: "owasp-full-scan",
      pushTest: IsK8sDeployable,
      containers: [{
        name: "owasp-zap2docker-full-scan",
        image: "owasp/zap2docker-stable:latest",
        args: [
          "zap-full-scan.py",
          "-J",
          "report.json",
          "-r",
          "report.html",
          "-t",
          "placeholder",
          "|| exit 0",
        ],
      }],
      output: [{
        classifier: "owasp-zap-reports",
        pattern: {globPattern: ["/zap/wrk/report.json", "/zap/wrk/report.html"]},
      }],
      callback: async (r, p, e, g, c) => {
        // This callback swaps out the URL for the just deployed K8s deployment
        r.volumes = [{
          hostPath: {
            path: "/private/" + p.baseDir,
          },
          name: "zapwrk",
        }];
        const result = await c.graphClient.query<FindK8Deploy.Query, FindK8Deploy.Variables>({
          name: "FindK8Deploy",
          variables: {
            uniqueName: "k8s-staging",
            sha: g.push.after.sha,
          },
        });
        const placeholder = r.containers[0].args.indexOf("placeholder");
        r.containers[0].args[placeholder] = result.SdmGoal[0].externalUrls[0].url;
        r.containers[0].args = [
          "/bin/bash",
          "-c",
          r.containers[0].args.join(" "),
        ];
        r.containers[0].volumeMounts = [{
          mountPath: "/zap/wrk",
          name: "zapwrk",
        }];
        return r;
      },
    })
    .withProjectListener({
      name: "processReport",
      events: [GoalProjectListenerEvent.after],
      listener: async (p, r) => {
        const rawReport = await (await p.getFile("zap/report.json")).getContent();
        const report: ZapReport = JSON.parse(rawReport);
        const alerts = report.site[0].alerts.filter(a => parseInt(a.riskcode, undefined) > 1);
        if (alerts.length > 0) {
          r.progressLog.write(`OWasp Scan found alerts that exceed severity threshold (see goal log)`);
          return {
            state: SdmGoalState.failure,
          };
        }

        return Success;
      },
    });
};

export interface ZapReport {
  site: ZapSite[];
}
export interface ZapAlert {
  alert: string;
  name: string;
  riskcode: string;
  riskdesc: string;
}
export interface ZapSite {
  "@name": string;
  "@host": string;
  "@port": string;
  "alerts": ZapAlert[];
}
