import {
  CodeInspection,
  ReviewListener,
  PushImpactResponse,
  slackInfoMessage,
  ReviewListenerRegistration,
  CodeInspectionRegistration,
} from "@atomist/sdm";
import {
  NoParameters,
  astUtils,
  logger,
  ProjectReview,
  ReviewComment,
} from "@atomist/automation-client";
import { DockerFileParser } from "@atomist/sdm-pack-docker";
import * as yaml from "js-yaml";
import { diff } from "deep-diff";
import _ = require("lodash");

export interface CiDockerMatchResult {
    result: boolean;
    message?: string[];
    repoId: string;
}

export const ciDockerMatch: CodeInspection<ProjectReview, NoParameters> = async p => {
    const imageDetails = [];
    if (await p.hasFile("Dockerfile") && await p.hasFile(".drone.yml")) {
        try {
            // Parse Dockerfile
            const imageName: string[] = await astUtils.findValues(
                p, DockerFileParser, "Dockerfile", "//FROM/image/name");
            const imageVersion: string[] = await astUtils.findValues(
                p, DockerFileParser, "Dockerfile", "//FROM/image/tag");
            imageDetails.push({image: imageName[0], version: imageVersion[0]});

            // Parse Drone file
            const droneFileHandle = await p.getFile(".drone.yml");
            const droneFileYaml = yaml.safeLoad(await droneFileHandle.getContent());
            const droneImageRaw = droneFileYaml.pipeline["install-and-build"].image;
            const droneImage = droneImageRaw.split(":");
            imageDetails.push({image: droneImage[0], version: droneImage[1]});

            const result: ReviewComment[] = [];
            if (JSON.stringify(imageDetails[0]) !== JSON.stringify(imageDetails[1])) {
                const message = [];
                const diffs = diff(imageDetails[0], imageDetails[1]);
                const editDiffs = diffs.filter(d => d.kind === "E");

                // Find unique paths (aka not matching values)
                const diffPaths = _.flatten(editDiffs.map(d => d.path));

                // For each unique path, find the diffs
                diffPaths.forEach(dP => {
                    const newDiffs = editDiffs.filter(d => d.path[0] === dP);

                    newDiffs.forEach(nD => {
                        const dockerFileValue = _.get(nD, "lhs");
                        const droneFileValue = _.get(nD, "rhs");
                        message.push(`\n${dP.charAt(0).toUpperCase() + dP.slice(1)} value doesn't match!` +
                        ` Dockerfile value: ${dockerFileValue} vs Drone config: ${droneFileValue}`);
                    });
                });

                result.push({
                    severity: "error",
                    detail:   message.join("\n"),
                    category: "Docker image use",
                });

                return ({
                    repoId: p.id,
                    comments: result,
                });
            }
        } catch (e) {
            logger.debug(`Error! ${e}`);
            throw new Error(e);
        }

    }

    // Return empty review otherwise
    return ({
        repoId: p.id,
        comments: [],
    });
};

export const optionalFailGoalsIfCiConfigDoesntMatch: ReviewListener = async rli => {
    if (rli.review.comments && rli.review.comments. length > 0) {
        rli.review.comments.forEach(c => {
            rli.addressChannels(slackInfoMessage(
                `Drone CI and Dockerfile Configuration Mismatch`,
                c.detail,
            ));
        });
        return PushImpactResponse.requireApprovalToProceed;
    }
    return PushImpactResponse.proceed;
};

export const ciDockerMatchRegistration: CodeInspectionRegistration<ProjectReview, NoParameters> = {
    name: "CI Docker Match Test",
    description: "Test if CI configuration is correct; does Dockerfile and Drone config use the same image?",
    inspection: ciDockerMatch,
}

export const optionalFailGoalsIfCiConfigDoesntMatchRegistration: ReviewListenerRegistration = {
    name: "Optional fail goals if CI configuration doesn't match",
    listener: optionalFailGoalsIfCiConfigDoesntMatch,
};
