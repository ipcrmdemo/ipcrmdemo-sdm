import { SoftwareDeliveryMachine } from "@atomist/sdm";

export function addRandomCommand(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {
    sdm.addCommand({
        name: "rnd cmd",
        intent: "rnd cmd",
        listener: async cli => {
            const newparam = await cli.promptFor<{ color: string[] }>({
                color: {
                    type: {
                        kind: "multiple",
                        options: [
                            { value: "red", description: "Red" },
                            { value: "blue", description: "Blue" },
                        ],
                    },
                },
            });
            await cli.addressChannels(`Hello ${JSON.stringify(newparam.color)}`);
        },
    });

    return sdm;
}
