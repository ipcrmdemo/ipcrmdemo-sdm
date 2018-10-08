import { PredicatePushTest, predicatePushTest } from "@atomist/sdm";

export const isMaster: PredicatePushTest = predicatePushTest(
    "isMaster",
    async p => {
        return p.id.branch === "master";
    },
);
