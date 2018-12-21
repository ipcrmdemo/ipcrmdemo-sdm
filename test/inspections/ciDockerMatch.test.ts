import { InMemoryProject } from "@atomist/automation-client";
import assert = require("power-assert");
import { ciDockerMatch } from "../../lib/inspections/ciDockerMatch"; 

const dockerFile = `
FROM openjdk:8-alpine
chmod 755 /usr/local/bin/dumb-init
MAINTAINER Atomist <docker@atomist.com>
RUN mkdir -p /opt/app
WORKDIR /opt/app
EXPOSE 8080
CMD ["-jar", "fake.jar"]
`;

const goodDroneCIFile = `
pipeline:
  install-and-build:
    image: openjdk:8-alpine
    pull: true
    commands:
      - npm install
      - npm run build
      - npm run test
`;

const nonMatchDroneCIFile = `
pipeline:
  install-and-build:
    image: node:10
    pull: true
    commands:
      - npm install
      - npm run build
      - npm run test
`;

describe("ciDockerMatch", () => {
    it("should not detect a difference", async () => {
        const p = InMemoryProject.of(
            {path: "Dockerfile", content: dockerFile },
            {path: ".drone.yaml", content: goodDroneCIFile},
        );
        const res = await ciDockerMatch(p, undefined);
        assert.equal(res, true);
    });

    it("should detect a difference", async () => {
        const p = InMemoryProject.of(
            {path: "Dockerfile", content: dockerFile },
            {path: ".drone.yaml", content: nonMatchDroneCIFile},
        );
        const res = await ciDockerMatch(p, undefined);
        assert.equal(res.result, false);
    });
});
