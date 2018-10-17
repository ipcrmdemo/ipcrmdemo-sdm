import { PredicatePushTest, predicatePushTest } from "@atomist/sdm";

export const isMaster: PredicatePushTest = predicatePushTest(
    "isMaster",
    async p => {
        return p.id.branch === "master";
    },
);

export const hasJenkinsfile: PredicatePushTest = predicatePushTest(
    "hasJenkinsfile",
    async p => {
        return p.hasFile("Jenkinsfile");
    },
);

export const npmHasBuildScript: PredicatePushTest = predicatePushTest(
    "npmHasBuildScript",
    async p => {
        if (await p.hasFile("package.json")) {
            const npmFile = await p.getFile("package.json");
            const packageFile = JSON.parse(await npmFile.getContent());
            const hasBuild = packageFile.scripts.hasOwnProperty("build");
            return hasBuild;
        } else {
            return false;
        }
    });
