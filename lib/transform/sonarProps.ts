import { CodeTransform } from "@atomist/sdm";
import { SeedDrivenGeneratorParameters } from "@atomist/automation-client";

export const addSonarProp: CodeTransform<SeedDrivenGeneratorParameters> = async (p, papi) => {
  if (!await p.hasFile("sonar-project.properties")) {
    await p.addFile(
      "sonar-project.properties",
      example.replace(/PROJECTNAME/g, papi.parameters.target.repoRef.repo),
    );
  }
  return p;
};
const example = `
sonar.projectKey=PROJECTNAME
sonar.projectName=PROJECTNAME
sonar.projectVersion=1.0
sonar.sources=./src
sonar.sourceEncoding=UTF-8
`;
