import { ChannelLinkListener  } from "@atomist/sdm";
import { buttonForCommand, logger } from "@atomist/automation-client";
import { Attachment, SlackMessage } from "@atomist/slack-messages";
import { enableK8sDeployRegistration } from "../transform/enableK8sDeploy";

export const SuggestEnableK8sDeploy: ChannelLinkListener = async inv => {
    if (!inv.project.fileExistsSync("pom.xml") && !inv.project.fileExistsSync("package.json")) {
        logger.debug(`Not suggesting K8s Deploy for ${inv.id}, not a supported project type`);
        return;
    }

    const attachment: Attachment = {
        text: "Enable K8s Deployments for your new repo?",
        fallback: "Enable K8s Deployments for your new repo?",
        actions: [buttonForCommand({ text: "Enable K8s Deployment" },
            enableK8sDeployRegistration.name,
            { "targets.owner": inv.id.owner, "targets.repo": inv.id.repo },
        ),
        ],
    };
    const message: SlackMessage = {
        attachments: [attachment],
    };
    return inv.addressNewlyLinkedChannel(message);
};
