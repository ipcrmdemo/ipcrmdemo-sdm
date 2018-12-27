/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { GitHubRepoRef, GraphQL } from "@atomist/automation-client";
import {
    AutoCodeInspection,
    Autofix,
    goalContributors,
    goals,
    onAnyPush,
    PushImpact,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
} from "@atomist/sdm";
import {
    createSoftwareDeliveryMachine,
    DisableDeploy,
    DisplayDeployEnablement,
    EnableDeploy,
    gitHubGoalStatus,
    goalState,
} from "@atomist/sdm-core";
import {
    NodeProjectCreationParametersDefinition,
    UpdatePackageJsonIdentification,
    UpdateReadmeTitle,
} from "@atomist/sdm-pack-node";
import {
    ReplaceReadmeTitle,
    SetAtomistTeamInApplicationYml,
    SpringProjectCreationParameterDefinitions,
    SpringProjectCreationParameters,
    springSupport,
    TransformSeedToCustomProject,
} from "@atomist/sdm-pack-spring";
import { AddDockerFile } from "../transform/addDockerfile";
import { AddFinalNameToPom } from "../transform/addFinalName";
import { AddJenkinsfileRegistration } from "../transform/addJenkinsfile";
import { AddLicenseFile } from "../transform/addLicense";
import {
    FixSmallMemory,
    ReduceMemorySize,
} from "../transform/smallMemory";
import { UpdateDockerfileMaintainer } from "../transform/updateDockerFileMaintainer";
import { SuggestAddingDockerfile } from "../support/suggestAddDockerfile";
import { presentSetFingerprints } from "../support/showFingerprints";
import { onJiraIssueLifecycleEvent } from "../event/onJiraIssueLifecycleEvent";
import { onJiraIssueChangelogEvent } from "../event/onJiraIssueChangelogEvent";
import { onJiraIssueCommmentEvent } from "../event/onJiraIssueCommentEvent";

export function machine(
    configuration: SoftwareDeliveryMachineConfiguration,
): SoftwareDeliveryMachine {

    const sdm: SoftwareDeliveryMachine = createSoftwareDeliveryMachine(
        { name: "Organization ipcrmdemo sdm", configuration },
    );

    sdm.addIngester(GraphQL.ingester("jiraIssueLifecycleEvent"));
    sdm.addIngester(GraphQL.ingester("jiraIssueChangelogEvent"));
    sdm.addIngester(GraphQL.ingester("jiraIssueCommentEvent"));

    sdm.addEvent(onJiraIssueLifecycleEvent());
    sdm.addEvent(onJiraIssueChangelogEvent());
    sdm.addEvent(onJiraIssueCommmentEvent());

    // Bot Commands
    sdm.addCommand(EnableDeploy)
        .addCommand(DisableDeploy)
        .addCommand(DisplayDeployEnablement)
        .addCommand(presentSetFingerprints)
        .addCodeTransformCommand(AddDockerFile)
        .addCodeTransformCommand(AddJenkinsfileRegistration)
        .addCodeTransformCommand(UpdateDockerfileMaintainer)
        .addCodeTransformCommand(FixSmallMemory);

    // Channel Link Listenrers
    sdm.addChannelLinkListener(SuggestAddingDockerfile);

    // Global
    const pushImpact = new PushImpact();

    // Autofix
    const autofix = new Autofix()
        .with(ReduceMemorySize)
        .with(AddLicenseFile);

    // Code Inspections
    const codeInspection = new AutoCodeInspection();

    // Ext Packs setup
    sdm.addExtensionPacks(
        springSupport({
            review: {
                springStyle: true,
                cloudNative: true,
            },
            autofix: {
                springStyle: true,
            },
            inspectGoal: codeInspection,
            autofixGoal: autofix,
            reviewListeners: [],
        }),
        gitHubGoalStatus(),
        goalState(),
    );

    // Generators
    sdm
        .addGeneratorCommand<SpringProjectCreationParameters>({
            name: "create-spring",
            intent: "create spring",
            description: "Create a new Java Spring Boot REST service",
            parameters: SpringProjectCreationParameterDefinitions,
            startingPoint: GitHubRepoRef.from({ owner: "atomist-seeds", repo: "spring-rest", branch: "master" }),
            transform: [
                ReplaceReadmeTitle,
                SetAtomistTeamInApplicationYml,
                TransformSeedToCustomProject,
                AddFinalNameToPom,
            ],
        })
        .addGeneratorCommand<SpringProjectCreationParameters>({
            name: "create-spring-external-build",
            intent: "create spring jenkins build",
            description: "Create a new Java Spring Boot REST service that builds with Jenkins",
            parameters: SpringProjectCreationParameterDefinitions,
            startingPoint: GitHubRepoRef.from({ owner: "ipcrmdemo", repo: "spring-rest-jenkins", branch: "master" }),
            transform: [
                ReplaceReadmeTitle,
                SetAtomistTeamInApplicationYml,
                TransformSeedToCustomProject,
                AddFinalNameToPom,
            ],
        })
        .addGeneratorCommand({
            name: "typescript-express-generator",
            parameters: NodeProjectCreationParametersDefinition,
            startingPoint: new GitHubRepoRef("ipcrmdemo", "typescript-node-api"),
            intent: "create node",
            transform: [
                UpdatePackageJsonIdentification,
                UpdateReadmeTitle,
            ],
        });

    // global
    const GlobalGoals = goals("global")
        .plan(autofix, codeInspection, pushImpact);

    // Rules
    sdm.addGoalContributions(goalContributors(
        onAnyPush()
            .setGoals(GlobalGoals),
    ));

    return sdm;
}
