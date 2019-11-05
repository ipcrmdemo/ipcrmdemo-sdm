import { astUtils, projectUtils } from "@atomist/automation-client";
import {AspectWithReportDetails} from "@atomist/sdm-pack-aspect";
import {FP, sha256} from "@atomist/sdm-pack-fingerprint";
import { XmldocFileParser } from "@atomist/sdm-pack-spring/lib/xml/XmldocFileParser";

export interface DotNetPackageProperties {
  name: string;
  version: string;
}

const csProjGlob = ["*.csproj", "**/*.csproj"];
const packageGlob = ["packages.config", "**/packages.config"];
const dotNetPackageName = "DotNetPackage";
export const DotNetPackageAspect: AspectWithReportDetails<DotNetPackageProperties> = {
  displayName: ".NET Packages",
  name: dotNetPackageName,
  toDisplayableFingerprint: fp => fp.data.version,
  toDisplayableFingerprintName: fp => fp,
  extract: async p => {
    const packages: Array<FP<DotNetPackageProperties>> = [];
    await astUtils.doWithAllMatches(
      p,
      new XmldocFileParser(),
      csProjGlob,
      `//ItemGroup/PackageReference`,
      m => {
        const data: DotNetPackageProperties = {name: (m as any).xd.attr.Include, version: (m as any).xd.attr.Version};
        if (!data.version) {
          data.version = `undefined`;
        }
        packages.push({
          type: dotNetPackageName,
          name: (m as any).xd.attr.Include,
          abbreviation: "dotnetp",
          version: "0.0.1",
          data,
          sha: sha256(JSON.stringify({data})),
        });
      },
    );

    await astUtils.doWithAllMatches(
      p,
      new XmldocFileParser(),
      packageGlob,
      `//packages/package`,
      m => {
          const data: DotNetPackageProperties = {name: (m as any).xd.attr.id, version: (m as any).xd.attr.version};
          if (!data.version) {
            data.version = `undefined`;
          }
          packages.push({
            type: dotNetPackageName,
            name: (m as any).xd.attr.id,
            abbreviation: "dotnetp",
            version: "0.0.1",
            data,
            sha: sha256(JSON.stringify({data})),
          });
        },
    );

    return packages;
  },
  apply: async (p, papi) => {
    if (await projectUtils.fileExists(p, ["packages.config", "**/packages.config"])) {
      const pathExp = `//packages/package`;
      await astUtils.doWithAllMatches(
        p,
        new XmldocFileParser(),
        packageGlob,
        pathExp,
        m => {
          if ((m as any).id === papi.parameters.fp.data.name) {
            const t = m.$value.replace(/version=".*"/, `version=\"${papi.parameters.fp.data.version}\"`);
            m.$value = t;
          }
        },
      );
    }
    if (await projectUtils.fileExists(p, ["*.csproj", "**/*.csproj"])) {
      const pathExp = `//ItemGroup/PackageReference`;
      await astUtils.doWithAllMatches(
        p,
        new XmldocFileParser(),
        csProjGlob,
        pathExp,
        m => {
          if ((m as any).xd.attr.Include === papi.parameters.fp.data.name) {
            const t = m.$value.replace(/Version=".*"/, `Version=\"${papi.parameters.fp.data.version}\"`);
            m.$value = t;
          }
        },
      );
    }

    return p;
  },
  details: {
    description: ".NET Package",
    shortName: "dotnet-package",
    unit: "dotnet-package",
    category: ".NET",
    url: `fingerprint/${dotNetPackageName}/*?byOrg=true&trim=false`,
    manage: true,
  },
};
