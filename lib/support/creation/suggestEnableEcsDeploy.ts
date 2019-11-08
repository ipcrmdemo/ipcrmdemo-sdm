import { ChannelLinkListener  } from "@atomist/sdm";
import { buttonForCommand, logger } from "@atomist/automation-client";
import { Attachment, SlackMessage } from "@atomist/slack-messages";
import { enableEcsDeployRegistration } from "../../transform/enableEcsDeploy";

export const SuggestEnableEcsDeploy: ChannelLinkListener = async inv => {
    if (!inv.project.fileExistsSync("pom.xml") && !inv.project.fileExistsSync("package.json")) {
        logger.debug(`Not suggesting ECS Deploy for ${inv.id}, not a supported project type`);
        return;
    }

    const attachment: Attachment = {
        text: "Enable ECS Deployments for your new repo?",
        fallback: "Enable ECS Deployments for your new repo?",
        actions: [buttonForCommand({ text: "Enable ECS Deployment" },
            enableEcsDeployRegistration.name,
            { "targets.owner": inv.id.owner, "targets.repo": inv.id.repo },
        ),
        ],
    };
    const message: SlackMessage = {
        attachments: [attachment],
    };
    return inv.addressNewlyLinkedChannel(message);
};
