import { ChannelLinkListener  } from "@atomist/sdm";
import { buttonForCommand, logger } from "@atomist/automation-client";
import { Attachment, SlackMessage } from "@atomist/slack-messages";
import { AddDockerFile } from "../transform/addDockerfile";

export const SuggestAddingDockerfile: ChannelLinkListener = async inv => {
    if (!inv.project.fileExistsSync("pom.xml") && !inv.project.fileExistsSync("package.json")) {
        logger.debug(`Not suggesting Dockerfile for ${inv.id}, not a supported project type`);
        return;
    }
    if (inv.project.fileExistsSync("Dockerfile")) {
        logger.debug(`Not suggesting Dockerfile for ${inv.id}, it already has one`);
        return;
    }

    const attachment: Attachment = {
        text: "Add a Dockerfile to your new repo?",
        fallback: "Add a Dockerfile to your new repo?",
        actions: [buttonForCommand({ text: "Add Dockerfile" },
            AddDockerFile.name,
            { "targets.owner": inv.id.owner, "targets.repo": inv.id.repo },
        ),
        ],
    };
    const message: SlackMessage = {
        attachments: [attachment],
    };
    return inv.addressNewlyLinkedChannel(message);
};
