import { InMemoryProject } from "@atomist/automation-client";
import * as assert from "assert";
import { enableK8sDeploy } from "../../lib/transform/enableK8sDeploy";

describe("enable k8s deploy for maven project", async () => {
  it("it should add dockerfile and k8s directory and files", async () => {
    const p = InMemoryProject.of({path: "pom.xml", content: "xmlstuff"});
    await enableK8sDeploy(p, {} as any);
    assert(await p.hasFile(".atomist/kubernetes/deployment.json"));

  });
  it("it should populate an appropriate dockerfile", async () => {
    const p = InMemoryProject.of({path: "pom.xml", content: "xmlstuff"});
    await enableK8sDeploy(p, {} as any);
    const dF = await p.getFile("Dockerfile");
    const dFC = await dF.getContent()
    assert(dFC.includes("dummyRepo.jar"));
  });
});
