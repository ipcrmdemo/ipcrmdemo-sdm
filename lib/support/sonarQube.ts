import {
    AutoInspectRegistration,
    CodeInspection,
    ParametersInvocation,
    PushReactionResponse,
    StringCapturingProgressLog,
} from "@atomist/sdm";
import {
    isLocalProject,
    spawnAndWatch,
    asSpawnCommand,
    NoParameters,
    configurationValue,
} from "@atomist/automation-client";

interface SonarCubeOptions {
    enabled: boolean;
    url: string;
    org: string;
    token: string;
}

const runScan = async (project): Promise<string> => {
    if (!isLocalProject(project)) {
        throw new Error(`Can only perform review on local project: had ${project.id.url}`);
    }
    const command = ["mvn clean org.jacoco:jacoco-maven-plugin:prepare-agent package sonar:sonar"];

    const options: SonarCubeOptions = configurationValue("sdm.sonar");
    if (options.url) {
        command.push(`-Dsonar.host.url=${options.url}`);
    }
    if (options.org) {
        command.push(`-Dsonar.organization=${options.org}`);
    }
    if (options.token) {
        command.push(`-Dsonar.login=${options.token}`);
    }

    const log = new StringCapturingProgressLog();
    await spawnAndWatch(
        asSpawnCommand(command.join(" ")),
        {
            cwd: project.baseDir,
        },
        log,
    );
    return log.log;

};

type SonarResults = string;
export const SonarCubeScan: CodeInspection<SonarResults> =
    async p => {
        const output =  runScan(p);
        return output;
    };

export async function failIfSonarScanFails(
    result: SonarResults,
    inv: ParametersInvocation<NoParameters>): Promise<PushReactionResponse> {
        const Pattern = /ANALYSIS SUCCESSFUL, you can browse ([^\s^[]*)/;
        const parsed = Pattern.exec(result);
        if (parsed) {
            await inv.addressChannels(`SonarQube Ran successfully! - <${parsed[1]}|Results>`);
            return PushReactionResponse.proceed;
        }
        await inv.addressChannels(parsed[0]);
        return PushReactionResponse.failGoals;
}

export const AutoCheckSonarScan: AutoInspectRegistration<SonarResults> = {
    name: "AutoCheckSonarScan",
    inspection: SonarCubeScan,
    onInspectionResult: failIfSonarScanFails,
};
