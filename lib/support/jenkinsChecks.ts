import { PredicatePushTest, predicatePushTest } from "@atomist/sdm";

export const hasJenkinsfile: PredicatePushTest = predicatePushTest(
    "hasJenkinsfile",
    async p => {
        return p.hasFile("Jenkinsfile");
    },
);
