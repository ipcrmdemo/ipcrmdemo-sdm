import { CodeInspection } from "@atomist/sdm";
import { NoParameters, astUtils } from "@atomist/automation-client";
import { DockerFileParser } from "@atomist/sdm-pack-docker";
import * as yaml from "js-yaml";
import * as fs from "fs";
import { diff } from "deep-diff";
import _ = require("lodash");

export interface CiDockerMatchResult {
    result: boolean;
    message?: string;
}

export const ciDockerMatch: CodeInspection<CiDockerMatchResult, NoParameters> = async p => {
    return new Promise<CiDockerMatchResult>(async (res, rej) => {
        const imageDetails = [];
        if (p.hasFile("Dockerfile") && p.hasFile(".drone.yaml")) {

            process.stdout.write("FOO");

            // Parse Dockerfile
            const imageName: string[] = await astUtils.findValues(
                p, DockerFileParser, "Dockerfile", "//FROM/image/name");
            const imageVersion: string[] = await astUtils.findValues(
                p, DockerFileParser, "Dockerfile", "//FROM/image/tag");
            imageDetails.push({image: imageName[0], version: imageVersion[0]});

            // Parse Drone file
            const droneFileYaml = yaml.safeLoad(fs.readFileSync(".drone.yml", "utf8"));
            const droneImageRaw = droneFileYaml.pipeline["install-and-build"].image;
            const droneImage = droneImageRaw.split(":");
            imageDetails.push({image: droneImage[0], version: droneImage[1]});

            if (JSON.stringify(imageDetails[0]) === JSON.stringify(imageDetails[1])) {
                res({
                    result: true,
                });
            } else {
                let message: string;
                const diffs = diff(imageDetails[0], imageDetails[1]);
                const editDiffs = diffs.filter(d => d.kind === "E");

                // Find unique paths
                const diffPaths = _.flatten(editDiffs.map(d => d.path));

                // For each unique path, find the diffs
                diffPaths.forEach(dP => {
                    const newDiffs = editDiffs.filter(d => d.path === dP);

                    newDiffs.forEach(nD => {
                        const dockerFileValue = _.get(nD, "path.lhs");
                        const droneFileValue = _.get(nD, "path.rhs");
                        message += `\n${dP} value doesn't match! \
                            Dockerfile value: ${dockerFileValue} vs Drone config: ${droneFileValue}`;
                        process.stdout.write(message);
                    });
                });

                res({
                    result: false,
                    message,
                });
            }

        } else {
            res({
                result: true,
            });
        }
    });
};
