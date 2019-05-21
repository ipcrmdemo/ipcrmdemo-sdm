import * as _ from "lodash";
import { PushAwareParametersInvocation } from "@atomist/sdm";
import { NoParameters, Project } from "@atomist/automation-client";

export async function addDockerfileIfMissing(
  p: Project,
  inv: PushAwareParametersInvocation<NoParameters>): Promise<Project> {
  const name = _.get(inv, "parameters.target.repo") || p.name;
  if (await p.hasFile("pom.xml") && !await p.hasFile("Dockerfile")) {
    await p.addFile("Dockerfile", dockerFile(name, "maven"));
    await p.addFile(".dockerignore", dockerIgnore(name));
  } else if (await p.hasFile("package.json") && !await p.hasFile("Dockerfile")) {
    await p.addFile("Dockerfile", dockerFile(name, "node"));
  }

  return p;
}

export function dockerFile(name: string, type: "maven" | "node"): string {
  // tslint:disable:max-line-length
  const maven = `FROM openjdk:8-alpine

RUN wget -O /usr/local/bin/dumb-init https://github.com/Yelp/dumb-init/releases/download/v1.2.2/dumb-init_1.2.2_amd64 && \\
chmod 755 /usr/local/bin/dumb-init

MAINTAINER Atomist <docker@atomist.com>

RUN mkdir -p /opt/app

WORKDIR /opt/app

EXPOSE 8080

CMD ["-jar", "${name}.jar"]

ENTRYPOINT ["/usr/local/bin/dumb-init", "java", "-XX:+UnlockExperimentalVMOptions", "-XX:+UseCGroupMemoryLimitForHeap", "-Xmx256m", "-Djava.security.egd=file:/dev/urandom"]

COPY target/${name}.jar ${name}.jar
`;

  const node = `FROM node:10

# Create app directory
WORKDIR /usr/src/app

# Install req'd
COPY package*.json ./
RUN npm install --only=production

# Bundle app source
RUN mkdir dist
COPY dist/. dist/.

# Configure
EXPOSE 8080
CMD [ "npm", "start" ]
    `;

  if (type === "maven") {
    return maven;
  } else if (type === "node") {
    return node;
  } else {
    throw new Error("Invalid Dockerfile type requested!");
  }
}

export function dockerIgnore(name: string): string {
  return `*
!target/${name}.jar
`;
}
