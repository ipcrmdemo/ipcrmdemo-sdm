import { SoftwareDeliveryMachine } from "@atomist/sdm";
import { Parameter, Parameters } from "@atomist/automation-client";

export function addRandomCommand(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {
    @Parameters()
    class RandomCommand {
        @Parameter()
        public name: string;
    }

    sdm.addCommand({
        name: "rnd cmd",
        intent: "rnd cmd",
        listener: async cli => {
            const newparam = await cli.promptFor<RandomCommand>({
                name: {
                    displayName: "Name",
                    required: true,
                },
            });
            await cli.addressChannels(`Hello ${newparam.name}`);
        },
    });

    return sdm;
}
