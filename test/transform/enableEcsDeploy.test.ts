import { InMemoryProject } from "@atomist/automation-client";
import * as assert from "assert";
import { enableEcsDeploy } from "../../lib/transform/enableEcsDeploy";

describe("enable ecs deploy for maven project", async () => {
  it("it should add dockerfile and ecs directory and files", async () => {
    const p = InMemoryProject.of({path: "pom.xml", content: "xmlstuff"});
    await enableEcsDeploy(p, {} as any);
    assert(
      await p.hasFile(".atomist/ecs/task-definition.json") &&
      await p.hasFile(".atomist/ecs/service.json"));

  });
  it("it should populate an appropriate dockerfile", async () => {
    const p = InMemoryProject.of({path: "pom.xml", content: "xmlstuff"});
    await enableEcsDeploy(p, {} as any);
    const dF = await p.getFile("Dockerfile");
    const dFC = await dF.getContent();
    assert(dFC.includes("dummyRepo.jar"));
  });
});
