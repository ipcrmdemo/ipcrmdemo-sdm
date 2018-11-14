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
import { ecsListTaskDefinitions, ecsGetTaskDefinition, cmpSuppliedTaskDefinition, ecsRegisterTask } from "./taskDefs";

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

// tslint:disable-next-line:max-line-length
export class EcsDeploy extends FulfillableGoalWithRegistrations<ECS.Types.CreateServiceRequest> {
    // tslint:disable-next-line
    constructor(protected details: FulfillableGoalDetails | string = DefaultGoalNameGenerator.generateName("ecs-deploy-push"), 
                ...dependsOn: Goal[]) {

        super({
            ...EcsGoalDefinition,
            ...getGoalDefinitionFrom(details, DefaultGoalNameGenerator.generateName("ecs-deploy-push")),
        }, ...dependsOn);
    }

    public with(
        registration: Partial<ECS.Types.CreateServiceRequest>,
        taskRegistration?: ECS.Types.RegisterTaskDefinitionRequest,
        ): this {

        // tslint:disable-next-line:no-object-literal-type-assertion
        this.addFulfillment({
            name: DefaultGoalNameGenerator.generateName("ecs-deployer"),
            goalExecutor: executeEcsDeploy(registration, taskRegistration),
            ...registration,
        } as Implementation);
        return this;
    }
}

// Execute an ECS deploy
//  *IF there is a task partion task definition, inject
export function executeEcsDeploy(
    serviceRequest: Partial<ECS.Types.CreateServiceRequest>,
    taskRegistration?: ECS.Types.RegisterTaskDefinitionRequest,

    ): ExecuteGoal {
    return async (goalInvocation: GoalInvocation): Promise<ExecuteGoalResult> => {
        const {sdmGoal, credentials, id, progressLog, configuration} = goalInvocation;

        logger.info("Deploying project %s:%s to ECS in %s]", id.owner, id.repo, serviceRequest.cluster);

        const image: DeployableArtifact = {
            name: sdmGoal.repo.name,
            version: sdmGoal.push.after.sha,
            filename: sdmGoal.push.after.image.imageName,
            id,
        };

        // Set image string, example source value:
        //  <registry>/<author>/<image>:<version>"
        const imageString = sdmGoal.push.after.image.imageName.split("/").pop().split(":")[0];

        // Create or Update a task definition
        // Check for passed taskdefinition info, and update the container field
        // tslint:disable-next-line:no-var-keyword
        let newTaskDef: ECS.Types.RegisterTaskDefinitionRequest = {
            family: "",
            containerDefinitions: [],
        };

        if (!taskRegistration) {

            // Check if there is an in-project configuration
            const dockerFile = await configuration.sdm.projectLoader.doWithProject(
                {credentials, id, readOnly: !image.cwd}, async p => {
                    if (p.hasFile("Dockerfile")) {
                        const d = await p.getFile("Dockerfile");
                        return d.getContent();
                    } else {
                        throw Error("No task definition present and no dockerfile found!");
                    }
            });

            // Get Docker commands out
            const parser = require("docker-file-parser");
            const options = { includeComments: false };
            const commands = parser.parse(dockerFile, options);
            const exposeCommands = commands.filter((c: any) => c.name === "EXPOSE");

            if (exposeCommands.length > 1) {
                throw new Error(`Unable to determine port for default ingress. Dockerfile in project ` +
                    `'${sdmGoal.repo.owner}/${sdmGoal.repo.name}' has more then one EXPOSE instruction: ` +
                    exposeCommands.map((c: any) => c.args).join(", "));
            } else if (exposeCommands.length === 1) {
                newTaskDef.family = imageString;
                newTaskDef.containerDefinitions = [
                    {
                        name: imageString,
                        image: sdmGoal.push.after.image.imageName,
                        portMappings: [{
                            containerPort: exposeCommands[0].args[0],
                            hostPort: exposeCommands[0].args[0],
                        }],

                    },
                ];
            }
        } else {
            newTaskDef = taskRegistration;
            newTaskDef.containerDefinitions.forEach( k => {
                if (imageString === k.name) {
                    k.image = sdmGoal.push.after.image.imageName;
                }
            });
        }

        // tslint:disable-next-line:no-console
        console.log(`NEWTASKDEF:\n${JSON.stringify(newTaskDef)}`);

        // Retrieve existing Task definitions, if we find a matching revision - use that
        //  otherwise create a new task definition
        const ecs = new ECS();

        const finalTaskDefinition = await ecsListTaskDefinitions(ecs, newTaskDef.family)
            .then( v => {
                let goodTaskDefinition: ECS.Types.TaskDefinition;

                // tslint:disable-next-line:no-console
                console.log("TEST 1");
                ecsGetTaskDefinition(ecs, v.pop())
                    .then( v3 => {
                        // tslint:disable-next-line:no-console
                        console.log("TEST 1 - 2");
                        // Does the latest task definition match the one supplied?
                        //  If not, create a new rev
                        if (!cmpSuppliedTaskDefinition(newTaskDef, v3.taskDefinition)) {
                            ecsRegisterTask(ecs, newTaskDef)
                                .then(value => {
                                    logger.info(`Registered new task definition for ${value.taskDefinition.family}`);
                                    goodTaskDefinition = value.taskDefinition;
                                });
                        } else {
                            logger.info(`Re-using existing matching task definition for ${v3.taskDefinition.family}`);
                            goodTaskDefinition = v3.taskDefinition;
                        }
                        throw new Error("Shouldn't reach this point");
                    });

                return goodTaskDefinition;
            })
            .catch(reason => {
                // tslint:disable-next-line:no-console
                console.log("TEST 1 - 3");
                logger.error(`Something went south - ${reason.message}`);
                throw new Error(reason.message);
            });

        // tslint:disable-next-line:no-console
        console.log("TEST 2");

        // Update Service Request with up to date task definition
        let newServiceRequest: ECS.Types.CreateServiceRequest;
        newServiceRequest = {
            ...serviceRequest,
            serviceName: serviceRequest.serviceName ? serviceRequest.serviceName : sdmGoal.repo.name,
            taskDefinition: `${finalTaskDefinition.family}:${finalTaskDefinition.revision}`,
        };

        const deployInfo = {
            name: sdmGoal.repo.name,
            description: sdmGoal.name,
            ...newServiceRequest,
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

        // Cleanup extra target info
        const params = esi;
        delete params.name;
        delete params.description;

        // Run Deployment
        const ecs = new ECS();
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
