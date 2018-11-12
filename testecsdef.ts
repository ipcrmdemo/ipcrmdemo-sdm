import { ECS } from "aws-sdk";

const params = {
  containerDefinitions: [
    {
        name: "sleep",
        command: [
        "sleep",
        "360",
        ],
        cpu: 10,
        essential: true,
        image: "busybox",
        memory: 10,
    },
  ],
  family: "sleep360",
  taskRoleArn: "",
  volumes: [
  ],
 };

const ecs = new ECS();

// Get a listing of active ARNs for the supplied task def family
const ecsListTaskDefinitions = async (
  ecsService: ECS,
  ecsFamily: string,
): Promise<string[]> => {
  return new Promise<string[]>( async (resolve, reject) => {
      await ecsService.listTaskDefinitionFamilies({status: "ACTIVE"}, async (err, data) => {
          if (err) {
            throw Error(err.message);
          } else {
            // tslint:disable-next-line:no-console
            if (data.families.includes(ecsFamily)) {
                await ecsService.listTaskDefinitions({familyPrefix: ecsFamily}, (e, d) => {
                  if (e) {
                    reject(e.message);
                  } else {
                    resolve(d.taskDefinitionArns);
                  }
                });
              }
            }
          });
  });
};

// Supply one of the entries from ecsListTaskDefinitions and get returned the json definition
const ecsGetTaskDefinition = async (
  ecsService: ECS,
  ecsTaskDef: string,
  ): Promise<ECS.Types.DescribeTaskDefinitionResponse> => {
    return new Promise<ECS.Types.DescribeTaskDefinitionResponse>( async (resolve, reject) => {
      // If there was definitions, lets get the last one to compare with
      // tslint:disable-next-line:no-console
      console.log(ecsTaskDef);
      const tdfVersion = ecsTaskDef.split(":")[6];
      const tdfFamily = ecsTaskDef.split(":")[5].split("/")[1];

      await ecsService.describeTaskDefinition(
        { taskDefinition: `${tdfFamily}:${tdfVersion}` },
        (e1, d1) => {
        if (e1) {
          reject(e1.message);
        } else {
          resolve(d1);
        }
      });
    });
};

// Create a new service definition
const ecsRegisterTask = async (
  ecsService: ECS,
  ecsParams: ECS.Types.RegisterTaskDefinitionRequest): Promise<ECS.Types.RegisterTaskDefinitionResponse> => {
    return new Promise<ECS.Types.RegisterTaskDefinitionResponse>((resolve, reject) => {
      ecsService.registerTaskDefinition(params, async (err, data) => {
        if (err) {
          reject(err.message);
        }

        resolve(data);
      });
    });
};

ecsRegisterTask(ecs, params)
  .then(value => {
    ecsListTaskDefinitions(ecs, "sleep360")
      .then( v => {
        ecsGetTaskDefinition(ecs, v.pop())
          .then( v3 => {
            // tslint:disable-next-line:no-console
            console.log(v3);
            // tslint:disable-next-line:no-console
            console.log(value);

            if (JSON.stringify(v3) === JSON.stringify(value)) {
              // tslint:disable-next-line:no-console
              console.log("THEY MATCH!");
            }
          });
      });
  });
