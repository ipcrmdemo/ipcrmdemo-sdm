import { astUtils } from "@atomist/automation-client";
import {AspectWithReportDetails} from "@atomist/sdm-pack-aspect";
import {sha256} from "@atomist/sdm-pack-fingerprint";
import { XmldocFileParser } from "@atomist/sdm-pack-spring/lib/xml/XmldocFileParser";

export interface DotNetTargetFrameworkProperties {
  target: string;
}

const csProjGlob = ["*.csproj", "**/*.csproj"];
const dotNetTargetFrameworkName = "DotNetTargetFramework";
export const DotNetTargetFrameworkAspect: AspectWithReportDetails<DotNetTargetFrameworkProperties> = {
  displayName: ".NET Target Framework",
  name: dotNetTargetFrameworkName,
  toDisplayableFingerprint: fp => fp.data.target,
  toDisplayableFingerprintName: fp => fp,
  extract: async p => {
    let data: DotNetTargetFrameworkProperties;
    await astUtils.doWithAllMatches(
      p,
      new XmldocFileParser(),
      csProjGlob,
      `//PropertyGroup/TargetFramework`,
      m => {
        data = {target: (m as any).xd.val};
      },
    );

    if (data) {
      return {
        type: dotNetTargetFrameworkName,
        name: dotNetTargetFrameworkName,
        abbreviation: "dotnet-target-framework",
        version: "0.0.1",
        data,
        sha: sha256(JSON.stringify({data})),
      };
    }

    return [];
  },
  details: {
    description: ".NET Target Framework",
    shortName: "dotnet-target-framework",
    unit: "dotnet-target-framework",
    category: ".NET",
    url: `fingerprint/${dotNetTargetFrameworkName}/*?byOrg=true&trim=false`,
    manage: false,
  },
};
