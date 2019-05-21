import {InMemoryProject} from "@atomist/automation-client";
import * as assert from "assert";
import { IsEcsDeployable, IsK8sDeployable, IsSdmProject } from "../lib/support/pushTests";

describe("pushTests", () => {
  describe("IsEcsDeployable", () => {
    it("should return false for missing service and/or task def", async () => {
      const project = InMemoryProject.of();
      const result = await IsEcsDeployable.predicate(project);
      assert(!result);
    });
    it("should return true for an empty service and/or task def", async () => {
      const project = InMemoryProject.of({path: ".atomist/ecs/task-definition.json", content: "{}"});
      const result = await IsEcsDeployable.predicate(project);
      assert(result);
    });
    it("should return true for any content in a service and/or task def", async () => {
      const project = InMemoryProject.of({path: ".atomist/ecs/service.json", content: "{notvalid: true}"});
      const result = await IsEcsDeployable.predicate(project);
      assert(result);
    });
  });
  describe("IsK8sDeployable", () => {
    it("should return true if a deployment json spec is present", async () => {
      const project = InMemoryProject.of({path: ".atomist/kubernetes/deployment.json", content: "{}"});
      const result = await IsK8sDeployable.predicate(project);
      assert(result);
    });
    it("should return true if a deployment yaml spec is present", async () => {
      const project = InMemoryProject.of({path: ".atomist/kubernetes/deployment.yaml", content: "---"});
      const result = await IsK8sDeployable.predicate(project);
      assert(result);
    });
    it("should return false if a deployment spec is not present", async () => {
      const project = InMemoryProject.of();
      const result = await IsK8sDeployable.predicate(project);
      assert(!result);
    });
  });

  describe("IsSdmProject", () => {
    it("should return false for an empty project", async () => {
      const project = InMemoryProject.of();
      const result = await IsSdmProject.predicate(project);
      assert(!result);
    });

    it("should return false for missing sdm deps", async () => {
      const project = InMemoryProject.of({path: "package.json", content: "{}"});
      const result = await IsSdmProject.predicate(project);
      assert(!result);
    });

    it("should return true when sdm-local is present", async () => {
      const project = InMemoryProject.of({path: "package.json", content: packageJsonSdmLocal});
      const result = await IsSdmProject.predicate(project);
      assert(result);
    });

    it("should return true when sdm is present", async () => {
      const project = InMemoryProject.of({path: "package.json", content: packageJsonSdm});
      const result = await IsSdmProject.predicate(project);
      assert(result);
    });

    it("should return true when sdm and sdm-local is present", async () => {
      const project = InMemoryProject.of({path: "package.json", content: packageJsonSdmBoth});
      const result = await IsSdmProject.predicate(project);
      assert(result);
    });
  });
});

const packageJsonSdm = `
    {
        "dependencies": {
            "@atomist/automation-client": "^1.2.0",
            "@atomist/sdm": "^1.2.0",
            "@atomist/sdm-core": "^1.2.0"
        }
    }`;

const packageJsonSdmLocal = `
    {
        "devDependencies": {
            "@atomist/sdm-local": "^1.0.4"
        }
    }`;

const packageJsonSdmBoth = `
    {
        "dependencies": {
            "@atomist/automation-client": "^1.2.0",
            "@atomist/sdm": "^1.2.0",
            "@atomist/sdm-core": "^1.2.0"
        },
        "devDependencies": {
            "@atomist/sdm-local": "^1.0.4"
        }
    }`;
