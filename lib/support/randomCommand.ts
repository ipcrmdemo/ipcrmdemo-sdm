import { SoftwareDeliveryMachine } from "@atomist/sdm";
import { Parameter, Parameters, SmartParameters } from "@atomist/automation-client";
import assert = require("power-assert");

export function addRandomCommand(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {
    @Parameters()
    class RandomCommand {
        @Parameter()
        public name: string;
    }

    @Parameters()
    class RndCmd extends RandomCommand implements SmartParameters {
        constructor() {
            super();
        }

        public bindAndValidate(): void {
            const name = this.name as string;
            assert(false, "Must set name properly");
            this.name = name;
        }

    }

    sdm.addCommand<RndCmd>({
        name: "hello",
        intent: "hello",
        paramsMaker: RndCmd,
        listener: async cli => cli.addressChannels(`Hello ${cli.parameters.name}`),
    });

    return sdm;
}
