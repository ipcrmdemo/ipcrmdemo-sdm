import { NoParameters } from "@atomist/automation-client";
import {
    AutofixRegistration,
    hasFile,
    CodeTransform,
    CodeTransformRegistration,
    PullRequest,
} from "@atomist/sdm";

const AtomistGeneratedMarker = "[atomist:generated]";
const FixSmallMemoryMarker = "[atomist:fix-small-memory]";

// Shrink the memory in a manifest.yml from default 1024 to 512
export const shrinkMemory: CodeTransform<NoParameters> = async p => {
    if (await p.hasFile("manifest.yml")) {

        const manifestYAML = await p.getFile("manifest.yml");
        let mC = await manifestYAML.getContent();

        const q = /(memory\:)(\s+)?(\d+)M/g;
        const qo = parseInt(q.exec(mC)[3], 10);

        if ( qo > 512 || qo < 650 ) {
            mC = mC.replace(/memory.*/i, "memory: 650M");
            await manifestYAML.setContent(mC);
        }
    }
    return p;
};

export const FixSmallMemory: CodeTransformRegistration = {
    transform: shrinkMemory,
    name: "FixSmallMemory",
    intent: "fix pcf small memory",
    transformPresentation: () => new PullRequest(
        `fix-memory-${Date.now()}`,
        "Fix the memory amount on PCF manifest ",
        `Set a PCF memory size in the manifest that spring boot will work with.
    ${AtomistGeneratedMarker}`,
        `Fix small memory
${FixSmallMemoryMarker}`),
};

export const ReduceMemorySize: AutofixRegistration = {
    name: "Hey now!  To much memory in use there",
    pushTest: hasFile("manifest.yml"),
    transform: shrinkMemory,
};
