import { CommandHandlerRegistration } from "@atomist/sdm";
import { queryPreferences } from "@atomist/sdm-pack-fingerprints/lib/adhoc/preferences";
import { ListFingerprintParameters } from "@atomist/sdm-pack-fingerprints/lib/fingerprints/list";
import { GetAllFingerprintsOnSha } from "@atomist/sdm-pack-fingerprints/lib/typings/types";
import { queryFingerprintsByBranchRef } from "@atomist/sdm-pack-fingerprints/lib/adhoc/fingerprints";
import { logger } from "@atomist/automation-client";
import _ = require("lodash");
import { FP } from "@atomist/sdm-pack-fingerprints";

export const presentSetFingerprints: CommandHandlerRegistration<ListFingerprintParameters> = {
    name: "ShowSetFingerprints",
    description: "Displays set fingerprints for the current project",
    intent: "show set fingerprints",
    paramsMaker: ListFingerprintParameters,
    listener: async cli => {
        const query = queryPreferences(cli.context.graphClient);
        try {
            interface FpPref {
                name: string;
                value: string;
            }
            const rawPrefs = await query();
            const prefs = _.get(rawPrefs, "ChatTeam[0].preferences") as FpPref[];

            const branch: string = cli.parameters.branch || "master";

            // tslint:disable-next-line:max-line-length
            logger.debug(`Show Set Fingerprints Params - Owner: ${cli.parameters.owner}, Repo: ${cli.parameters.repo}, Branch: ${branch}`);
            const fpQuery: GetAllFingerprintsOnSha.Query = await queryFingerprintsByBranchRef(cli.context.graphClient)(
                cli.parameters.repo,
                cli.parameters.owner,
                branch);
            const fps: GetAllFingerprintsOnSha.Fingerprints[] = fpQuery.Repo[0].branches[0].commit.fingerprints;

            const setFps: FpPref[] = [];
            fps.forEach(newFp => {
                // Fingerprints are unique so only one match should be here
                logger.debug(`FP Name: ${newFp.name}`);
                setFps.push(prefs.filter(n => {
                    logger.debug(`Pref Name: ${n.name}`);
                    return n.name === newFp.name;
                })[0]);
            });

            logger.debug(`All prefs: ${JSON.stringify(setFps)}`);
            logger.debug(`All Fps: ${JSON.stringify(fps)}`);

            setFps.forEach(sFp => {
                const fP = JSON.parse(sFp.value) as FP;
                const msg = `${JSON.stringify(sFp.name + ":" + JSON.stringify(fP.data, undefined, 2), undefined, 2)}`;
                logger.debug(msg);
                return cli.addressChannels(msg);
            });

        } catch (error) {
            return cli.addressChannels(`unable to fetch preferences ${error}`);

        }
    },
};
