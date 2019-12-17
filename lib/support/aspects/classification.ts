import { projectClassificationAspect } from "@atomist/sdm-pack-aspect";
import { gatherFromFiles } from "@atomist/automation-client/lib/project/util/projectUtils";
import { Aspect, FP, NpmDeps } from "@atomist/sdm-pack-fingerprint";
import { NpmDepData } from "@atomist/sdm-pack-fingerprint/lib/fingerprints/npmDeps";

export const FrameworkName = "framework";
export const FrameworkAspect: Aspect = projectClassificationAspect(
  {
    name: FrameworkName,
    displayName: FrameworkName,
    toDisplayableFingerprintName: () => "Framework",
  },
  {
    tags: "node",
    reason: "has package.json",
    test: async p => (await p.getFiles("**/package.json")).length > 0,
  },
  {
    tags: "spring-boot",
    reason: "POM file references Spring Boot",
    test: async p => {
      const pomContents = await gatherFromFiles(p, "**/pom.xml", async f => f.getContent());
      for (const pomContent of pomContents) {
        if (pomContent.includes("org.springframework.boot")) {
          return true;
        }
      }
      return false;
    },
  },
  {
    tags: "react",
    reason: "package.json references react",
    testFingerprints: async fps => hasNpmDep(fps, fp => fp.name === "react"),
  },
  {
    tags: "angular",
    reason: "package.json references angular",
    testFingerprints: async fps => hasNpmDep(fps, fp => fp.data[0].startsWith("@angular/")),
  },
  {
    tags: "rails",
    reason: "Gemfile references Rails",
    test: async p => {
      const gemMatch = /gem[\s+]['"]rails['"]/;
      const gemfileContents = await gatherFromFiles(p, "**/Gemfile", async f => f.getContent());
      for (const content of gemfileContents) {
        if (gemMatch.test(content)) {
          return true;
        }
      }
      return false;
    },
  },
  {
    tags: "django",
    reason: "requirements.txt references Django",
    test: async p => {
      const djangoMatch = /^Django==/;
      const reqTexts = await gatherFromFiles(p, "**/requirements.txt", async f => f.getContent());
      for (const content of reqTexts) {
        if (djangoMatch.test(content)) {
          return true;
        }
      }
      return false;
    },
  },
);

function hasNpmDep(fps: FP[], test: (fp: FP<NpmDepData>) => boolean): boolean {
  return fps && fps.some(fp => fp.type === NpmDeps.name && test(fp));
}
