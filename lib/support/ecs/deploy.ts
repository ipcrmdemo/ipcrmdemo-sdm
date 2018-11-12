import {
    FulfillableGoalDetails,
    Goal,
    getGoalDefinitionFrom,
    DefaultGoalNameGenerator,
    GoalInvocation,
    ExecuteGoalResult,
    ExecuteGoal,
    ProjectLoader,
    DeployableArtifact,
    ProgressLog,
    Deployer,
    TargetInfo,
    FulfillableGoalWithRegistrations,
    IndependentOfEnvironment,
    GoalDefinition,
    Implementation,
    Deployment,
} from "@atomist/sdm";
import { ProjectOperationCredentials, logger, RemoteRepoRef } from "@atomist/automation-client";
import _ = require("lodash");
import { ECS } from "aws-sdk";

const EcsGoalDefinition: GoalDefinition = {
    displayName: "deploying to ECS",
    uniqueName: "cloudfoundry-deploy",
    environment: IndependentOfEnvironment,
    workingDescription: "Deploying to ECS",
    completedDescription: "Deployed to ECS",
    failedDescription: "Deployment to ECS failed",
    waitingForApprovalDescription: "Waiting for ECS deployment approval",
    waitingForPreApprovalDescription: "Waiting to start ECS deployment",
    stoppedDescription: "Deployment to ECS stopped",
    canceledDescription: "Deployment to ECS cancelled",
};

export class EcsDeploy extends FulfillableGoalWithRegistrations<ECS.Types.CreateServiceRequest> {
    // tslint:disable-next-line
    constructor(protected details: FulfillableGoalDetails | string = DefaultGoalNameGenerator.generateName("ecs-deploy-push"), 
                ...dependsOn: Goal[]) {

        super({
            ...EcsGoalDefinition,
            ...getGoalDefinitionFrom(details, DefaultGoalNameGenerator.generateName("ecs-deploy-push")),
        }, ...dependsOn);
    }

    public with(registration: ECS.Types.CreateServiceRequest): this {
        // tslint:disable-next-line:no-object-literal-type-assertion
        this.addFulfillment({
            name: DefaultGoalNameGenerator.generateName("ecs-deployer"),
            goalExecutor: executeEcsDeploy(registration),
            ...registration,
        } as Implementation);
        return this;
    }
}
export function executeEcsDeploy(registration: ECS.Types.CreateServiceRequest): ExecuteGoal {
    return async (goalInvocation: GoalInvocation): Promise<ExecuteGoalResult> => {
        const {sdmGoal, credentials, id, progressLog, configuration} = goalInvocation;

        logger.info("Deploying project %s:%s to CloudFoundry in %s]", id.owner, id.repo, registration.cluster);

        const image: DeployableArtifact = {
            name: sdmGoal.repo.name,
            version: sdmGoal.push.after.sha,
            filename: sdmGoal.push.after.image.imageName,
            id,
        };

        const deployInfo = {
            name: sdmGoal.repo.name,
            description: sdmGoal.name,
            ...registration,
        };

        const deployments = await new EcsDeployer(configuration.sdm.projectLoader).deploy(
            image,
            deployInfo,
            progressLog,
            credentials,
        );

        const results = await Promise.all(deployments.map(deployment => {
            // tslint:disable-next-line:no-object-literal-type-assertion
            return {
                code: 0,
                targetUrl: deployment.endpoint,
            } as ExecuteGoalResult;
        }));

        return _.head(results);

    };
}

export interface EcsDeploymentInfo extends TargetInfo, ECS.Types.CreateServiceRequest {}

export interface EcsDeployment extends Deployment {
    clusterName: string;
    projectName: string;
}

// tslint:disable-next-line:max-classes-per-file
export class EcsDeployer implements Deployer<EcsDeploymentInfo, EcsDeployment> {
    constructor(private readonly projectLoader: ProjectLoader) {
    }

    public async deploy(da: DeployableArtifact,
                        esi: EcsDeploymentInfo,
                        log: ProgressLog,
                        credentials: ProjectOperationCredentials): Promise<EcsDeployment[]> {
        logger.info("Deploying app [%j] to ECS [%s]", da, esi.description);

        logger.info(JSON.stringify(esi));

        return this.projectLoader.doWithProject({credentials, id: da.id, readOnly: !da.cwd}, async project => {
            const ecs = new ECS();

            // Cleanup extra target info
            const params = esi;
            delete params.name;
            delete params.description;

            // Task description setup/update

            // Run Deployment
            return [await new Promise<EcsDeployment>((resolve, reject) => {
                        ecs.createService(params, (err, data) => {
                            if (err) {
                                // tslint:disable-next-line:no-console
                                logger.error(err.stack);
                                reject(`Error: ${err.message}`);
                            } else {
                                // tslint:disable-next-line:no-console
                                console.log(data); // successful response

                                // TODO: Pull out endpoint
                                resolve({
                                    endpoint: "test",
                                    clusterName: esi.cluster,
                                    projectName: esi.name,
                                });
                            }
                        });
                    })];
        });
    }

    public async undeploy(): Promise<void> {
        return;
    }

    public findDeployments(id: RemoteRepoRef,
                           ti: EcsDeploymentInfo,
                           credentials: ProjectOperationCredentials): Promise<EcsDeployment[]> {

        return this.projectLoader.doWithProject({credentials, id, readOnly: true}, async project => {
            logger.warn("Find Deployments is not implemented in ecsDeployer");
            return [];
        });
    }

    // tslint:disable-next-line:typedef
    public logInterpreter(log: string) {
        return {
            relevantPart: "",
            message: "Deploy failed",
        };
    }

}
