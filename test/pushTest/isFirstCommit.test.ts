import { InMemoryProject } from "@atomist/automation-client";
import * as sinon from "sinon";
import * as sdm from "@atomist/sdm";
import assert = require("power-assert");
import { isFirstCommit } from "../../lib/support/preChecks";

describe("isFirstCommit", () => {
  let a: any;
  before(() => {
      a = sinon.stub(sdm, "spawnLog");
  });

  after(() => {
    a.restore();
  })

  it("should be first commit", async () => {
    const project = InMemoryProject.of();
    const output = {
      code: 0,
    } as any;

    a.returns(Promise.resolve(output));
    const r = await isFirstCommit.predicate(project);
    assert(!r);
  });
  it("should not be first commit", async () => {
    const project = InMemoryProject.of();
    const output = {
      code: 1,
    } as any;

    a.returns(Promise.resolve(output));
    const r = await isFirstCommit.predicate(project);
    assert(r);
    a.restore();
  });
});
