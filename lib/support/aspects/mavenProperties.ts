import {astUtils} from "@atomist/automation-client";
import {AspectWithReportDetails} from "@atomist/sdm-pack-aspect";
import {FP, sha256} from "@atomist/sdm-pack-fingerprint";
import {XmldocFileParser} from "@atomist/sdm-pack-spring/lib/xml/XmldocFileParser";

interface MavenProperties {
  name: string;
  value: string;
}
const mavenPropertiesName = "MavenProperties";
export const MavenPropertiesAspect: AspectWithReportDetails<MavenProperties> = {
  displayName: "Maven Properties",
  name: mavenPropertiesName,
  toDisplayableFingerprint: fp => fp.data.value,
  toDisplayableFingerprintName: fp => fp,
  extract: async p => {
    return astUtils.gatherFromMatches<FP<MavenProperties>>(
      p,
      new XmldocFileParser(),
      "pom.xml",
      "//project/properties/*",
      m => {
        const data = {
          name: (m as any).xd.name,
          value: (m as any).xd.val,
        };
        return {
          type: mavenPropertiesName,
          name: (m as any).xd.name,
          abbreviation: "mvnp",
          version: "0.0.1",
          data,
          sha: sha256(JSON.stringify({ data })),
        };
      },
    );
  },
  details: {
    description: "Maven Properties",
    shortName: "maven-properties",
    unit: "mvn-property",
    category: "Maven",
    url: `fingerprint/${mavenPropertiesName}/*?byOrg=true&trim=false`,
    manage: false,
  },
};
