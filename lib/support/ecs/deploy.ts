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
    FulfillmentRegistration,
    SdmGoalEvent,
    RepoContext,
} from "@atomist/sdm";
import { ProjectOperationCredentials, logger, RemoteRepoRef } from "@atomist/automation-client";
import _ = require("lodash");
import { ECS, EC2 } from "aws-sdk";
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

export interface EcsDeployRegistration extends FulfillmentRegistration {
    serviceRequest: Partial<ECS.Types.CreateServiceRequest>;
    taskDefinition?: ECS.Types.RegisterTaskDefinitionRequest;
}

// tslint:disable-next-line:max-line-length
export class EcsDeploy extends FulfillableGoalWithRegistrations<EcsDeployRegistration> {
    // tslint:disable-next-line
    constructor(protected details: FulfillableGoalDetails | string = DefaultGoalNameGenerator.generateName("ecs-deploy-push"), 
                ...dependsOn: Goal[]) {

        super({
            ...EcsGoalDefinition,
            ...getGoalDefinitionFrom(details, DefaultGoalNameGenerator.generateName("ecs-deploy-push")),
        }, ...dependsOn);
    }

    public with(
        registration: EcsDeployRegistration,
        ): this {

        // tslint:disable-next-line:no-object-literal-type-assertion
        this.addFulfillment({
            name: DefaultGoalNameGenerator.generateName("ecs-deployer"),
            goalExecutor: executeEcsDeploy(),
        } as Implementation);

        this.addFulfillmentCallback({
            goal: this,
            callback: ecsDataCallback(this, registration),
        });

        return this;
    }
}

async function createEcsTask(
    ecs: ECS,
    newTaskDef: ECS.Types.RegisterTaskDefinitionRequest): Promise<ECS.Types.TaskDefinition> {

    // // tslint:disable-next-line:no-debugger
    // debugger;
    return ecsRegisterTask(ecs, newTaskDef)
        .then(value => {
            logger.info(`Registered new task definition for ${value.taskDefinition.family}`);
            return value.taskDefinition;
        })
        .catch(reason => {
            logger.error(`Something went south - ${reason.message}`);
            throw new Error(reason.message);
        });
}

// Execute an ECS deploy
//  *IF there is a task partion task definition, inject
export function executeEcsDeploy(): ExecuteGoal {
    return async (goalInvocation: GoalInvocation): Promise<ExecuteGoalResult> => {
        const {sdmGoal, credentials, id, progressLog, configuration} = goalInvocation;

        const goalData = JSON.parse(sdmGoal.data);

        logger.info("Deploying project %s:%s to ECS in %s]", id.owner, id.repo, goalData.serviceRequest.cluster);

        const image: DeployableArtifact = {
            name: sdmGoal.repo.name,
            version: sdmGoal.push.after.sha,
            filename: sdmGoal.push.after.image.imageName,
            id,
        };

        const deployInfo = {
            name: sdmGoal.repo.name,
            description: sdmGoal.name,
            ...goalData.serviceRequest,
        };

        const deployments = await new EcsDeployer(configuration.sdm.projectLoader).deploy(
            image,
            deployInfo,
            progressLog,
            credentials,
        );

        const results = await Promise.all(deployments.map(deployment => {
            // TODO: raise appropriate return code
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
        return [await new Promise<EcsDeployment>(async (resolve, reject) => {

            await ecs.listServices({cluster: params.cluster}, async (err, data) => {
                if (err) {
                    logger.error(err.stack);
                    reject(`Error: ${err.message}`);
                } else {
                    let updateOrCreate = 0;
                    // tslint:disable-next-line:no-console
                    data.serviceArns.forEach(s => {
                        // arn:aws:ecs:us-east-1:247672886355:service/ecs-test-1-production
                        const service = s.split(":").pop().split("/").pop();
                        if (service === params.serviceName) {
                            updateOrCreate += 1;
                        }
                    });
                    if (updateOrCreate !== 0) {
                        // If we are updating, we need to build an UpdateServiceRequest from the data
                        //  we got in params (which is a CreateServiceRequest, not update)
                        const updateService: ECS.Types.UpdateServiceRequest = {
                            service: params.serviceName,                // Required
                            taskDefinition: params.taskDefinition,      // Required
                            forceNewDeployment: true,                   // Required
                            cluster: params.hasOwnProperty("cluster") && params.cluster ? params.cluster : undefined,
                            desiredCount: params.hasOwnProperty("desiredCount")
                                && params.desiredCount ? params.desiredCount : undefined,
                            deploymentConfiguration: params.hasOwnProperty("deploymentConfiguration")
                                && params.deploymentConfiguration ? params.deploymentConfiguration : undefined,
                            networkConfiguration: params.hasOwnProperty("networkConfiguration")
                                && params.networkConfiguration ? params.networkConfiguration : undefined,
                            platformVersion: params.hasOwnProperty("platformVersion")
                                && params.platformVersion ? params.platformVersion : undefined,
                            healthCheckGracePeriodSeconds: params.hasOwnProperty("healthCheckGracePeriodSeconds")
                                && params.healthCheckGracePeriodSeconds
                                    ? params.healthCheckGracePeriodSeconds : undefined,
                        };
                        await ecs.updateService(updateService, async (e, d) => {
                            if (e) {
                                logger.error(e.stack);
                                reject(`Error: ${e.message}`);
                            } else {
                                // Wait for service to come-up/converge
                                await ecs.waitFor("servicesStable",
                                {
                                    services: [updateService.service],
                                    cluster: updateService.cluster,
                                }, (serror, sdata) => {
                                    if (err) {
                                        logger.debug(err.message, err.stack);
                                        reject(err.message);
                                    }
                                });

                                // Collect endpoint data
                                await this.getEndpointData(params, d)
                                    .then( res => {
                                        resolve({
                                            endpoint: res.join(","),
                                            clusterName: d.service.clusterArn,
                                            projectName: esi.name,
                                        });
                                    })
                                    .catch(reason => {
                                        reject(reason);
                                    });
                            }
                        });
                    } else {
                        // New service, just create
                        await ecs.createService(params, async (err1, d1) => {
                            if (err1) {
                                logger.error(err1.stack);
                                reject(`Error: ${err1.message}`);
                            } else {
                                // Wait for service to come-up/converge
                                await ecs.waitFor("servicesStable",
                                {
                                    services: [params.serviceName],
                                    cluster: params.cluster,
                                }, (serror, sdata) => {
                                    if (err) {
                                        logger.debug(err.message, err.stack);
                                        throw new Error(err.message);
                                    }
                                });

                                // Collect endpoint data
                                await this.getEndpointData(params, d1)
                                    .then( res => {
                                        resolve({
                                            endpoint: res.join(","),
                                            clusterName: d1.service.clusterArn,
                                            projectName: esi.name,
                                        });
                                    })
                                    .catch(reason => {
                                        throw new Error(reason);
                                    });
                            }
                        });
                    }
                }
            });
        })];
    }

    public async getEndpointData(
        definition: ECS.Types.UpdateServiceRequest | ECS.Types.CreateServiceRequest,
        data: ECS.Types.UpdateServiceResponse | ECS.Types.CreateServiceResponse,
        ): Promise<string[]> {
            return new Promise<string[]>( async (resolve, reject) => {
                const ecs = new ECS();
                const ec2 = new EC2();
                await ecs.listTasks({
                    serviceName: data.service.serviceName,
                    cluster: definition.cluster,
                }, async (err, arns) => {
                    if (err) {
                        logger.debug(err.message);
                        reject(err.message);
                    }
                    let taskDef: ECS.Types.TaskDefinition;
                    await ecs.describeTaskDefinition({
                        taskDefinition: data.service.taskDefinition,
                    }, (terr, tdata) => {
                        if (terr) {
                            logger.debug(terr.message, terr.stack);
                            throw new Error(terr.message);
                        } else {
                            taskDef = tdata.taskDefinition;
                        }
                    });
                    await ecs.describeTasks({
                        tasks: arns.taskArns,
                        cluster: definition.cluster,
                    }, async (e, d) => {
                        if (e) { reject(e.message); }

                        // For each task - get the containers
                        await d.tasks.forEach( async t => {
                            // Get the EIN for this interface
                            const ein = d.tasks[0].attachments[0].details[1].value;
                            await ec2.describeNetworkInterfaces({
                                NetworkInterfaceIds: [ ein ],
                            }, async (ierr, idata) => {
                                if (ierr) {
                                    logger.debug(err.message, err.stack);
                                    throw new Error(ierr.message);
                                } else {
                                    if (idata.NetworkInterfaces[0].Association.PublicIp) {
                                        const publicIp = idata.NetworkInterfaces[0].Association.PublicIp;
                                        // For each container, push endpoint
                                        resolve(
                                            taskDef.containerDefinitions.map( c => {
                                                const proto = c.portMappings[0].protocol;
                                                const port = c.portMappings[0].hostPort;
                                                return `${proto}://${publicIp}:${port}`;
                                            }),
                                        );
                                    }
                                }
                            });
                        });

                    });
                });
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

function ecsDataCallback(ecsDeploy: EcsDeploy,
                         registration: EcsDeployRegistration)
: (goal: SdmGoalEvent, context: RepoContext) => Promise<SdmGoalEvent> {
    return async (sdmGoal, ctx) => {
        return ecsDeploy.sdm.configuration.sdm.projectLoader.doWithProject({
            credentials: ctx.credentials, id: ctx.id, context: ctx.context, readOnly: true,
        }, async p => {

            // Set image string, example source value:
            //  <registry>/<author>/<image>:<version>"
            const imageString = sdmGoal.push.after.image.imageName.split("/").pop().split(":")[0];

            // Create or Update a task definition
            // Check for passed taskdefinition info, and update the container field
            let newTaskDef: ECS.Types.RegisterTaskDefinitionRequest = {
                family: "",
                containerDefinitions: [],
            };

            // If our registration doesn't include a task definition - generate a generic one
            if (!registration.taskDefinition) {
                // TODO: Check if there is an in-project configuration
                let dockerFile;
                if (p.hasFile("Dockerfile")) {
                            const d = await p.getFile("Dockerfile");
                            dockerFile = await d.getContent();
                } else {
                    throw Error("No task definition present and no dockerfile found!");
                }

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
                    // TODO: Expose the defaults below in client.config.json
                    newTaskDef.requiresCompatibilities = [ "FARGATE"];
                    newTaskDef.networkMode = "awsvpc";
                    newTaskDef.cpu = "256",
                    newTaskDef.memory = "0.5GB",

                    newTaskDef.containerDefinitions = [
                        {
                            name: imageString,
                            healthCheck: {
                                command: [
                                    "CMD-SHELL",
                                    `wget -O /dev/null http://localhost:${exposeCommands[0].args[0]} || exit 1`,
                                ],
                                startPeriod: 30,
                            },
                            image: sdmGoal.push.after.image.imageName,
                            portMappings: [{
                                containerPort: exposeCommands[0].args[0],
                                hostPort: exposeCommands[0].args[0],
                                // TODO: Expose default protocol in settings
                                protocol: "http",
                            }],
                        },
                    ];
                }
            } else {
                newTaskDef = registration.taskDefinition;
                newTaskDef.containerDefinitions.forEach( k => {
                    if (imageString === k.name) {
                        k.image = sdmGoal.push.after.image.imageName;
                    }
                    // TODO: Expose the defaults below in client.config.json
                    k.memory = k.hasOwnProperty("memory") && k.memory ? k.memory : 1024;
                    k.cpu = k.hasOwnProperty("cpu") && k.cpu ? k.cpu : 256;
                });
            }

            // Retrieve existing Task definitions, if we find a matching revision - use that
            //  otherwise create a new task definition
            const ecs = new ECS();

            // Pull latest def info & compare it to the latest
            let goodTaskDefinition: ECS.Types.TaskDefinition;
            const taskDefs = await ecsListTaskDefinitions(ecs, newTaskDef.family);
            let latestRev;
            await ecsGetTaskDefinition(ecs, taskDefs.pop())
                .then(v => {
                    latestRev = v;
                })
                .catch(() => {
                    logger.debug(`No task definitions found for ${newTaskDef.family}`);
                });

            // Compare latest def to new def
            // - if they differ create a new revision
            // - if they don't use the existing rev
            if (latestRev && !cmpSuppliedTaskDefinition(latestRev, newTaskDef)) {
                goodTaskDefinition = await createEcsTask(ecs, newTaskDef);
            } else if (!latestRev) {
                goodTaskDefinition = await createEcsTask(ecs, newTaskDef);
            } else {
                goodTaskDefinition = latestRev;
            }

            // Update Service Request with up to date task definition
            let newServiceRequest: ECS.Types.CreateServiceRequest;
            newServiceRequest = {
                ...registration.serviceRequest,
                serviceName: registration.serviceRequest ? registration.serviceRequest.serviceName : sdmGoal.repo.name,
                taskDefinition: `${goodTaskDefinition.family}:${goodTaskDefinition.revision}`,
            };

            return {
                ...sdmGoal,
                data: JSON.stringify({
                    serviceRequest: newServiceRequest,
                    taskDefinition: goodTaskDefinition,
                }),
            };
        });

    };
}
