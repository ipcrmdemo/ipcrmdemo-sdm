import { projectUtils, SeedDrivenGeneratorParameters } from "@atomist/automation-client";
import { SpringProjectCreationParameters } from "@atomist/sdm-pack-spring";
import { CodeTransform } from "@atomist/sdm";

export const replaceSeedSlug: CodeTransform<SpringProjectCreationParameters & SeedDrivenGeneratorParameters> =
  async (p, papi) => {
    await projectUtils.doWithFiles(p, "**/*", async file => {
      const content = await file.getContent();
      const newContent = content.replace(
        new RegExp(
          `${papi.parameters.source.repoRef.owner}\/${papi.parameters.source.repoRef.repo}`, "g"),
        `${p.id.owner}/${p.id.repo}`);
      if (content !== newContent) {
        await file.setContent(newContent);
      }
    });
    return p;
  };
