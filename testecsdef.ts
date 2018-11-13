import { ECS } from "aws-sdk";
// import * as stringify from "json-stringify-safe";

// Task def params
const params = {
  containerDefinitions: [
    {
        name: "sleep",
        command: [
        "sleep",
        "360",
        ],
        cpu: 12,
        essential: true,
        image: "busybox",
        memory: 10,
    },
  ],
  family: "sleep360",
  // taskRoleArn: "",
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
export const ecsRegisterTask = async (
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

// Compare two task definitions from left to right
//  ie; iterate keys of obj1 and see if they match in obj2
//  used to determine if a user supplied definition (which contains a subset of available keys)
//  matches an existing task definion revision
const cmpSuppliedTaskDefinition = (obj1, obj2): boolean => {
    let notEqualCount = 0;
    Object.keys(obj1).forEach( k => {
      if ( obj2.hasOwnProperty(k)) {
        if (typeof(obj1[k]) === "object") {
            // If this is an object, iterate keys
            if (!cmpSuppliedTaskDefinition(obj1[k], obj2[k])) {
              notEqualCount += 1;
            }
        } else {
            // If its just a string do a straight comparision
            if (!(obj1[k] === obj2[k])) {
              notEqualCount += 1;
            }
        }
      } else {
          notEqualCount += 1;
      }
    });
    return notEqualCount > 0 ? false : true;
};

// List available task definitions for the given family
ecsListTaskDefinitions(ecs, "sleep360")
  .then( v => {
    ecsGetTaskDefinition(ecs, v.pop())
      .then( v3 => {

        // tslint:disable-next-line:no-console
        // Does the latest task definition match the one supplied?
        //  If not, create a new rev
        if (!cmpSuppliedTaskDefinition(params, v3.taskDefinition)) {
            ecsRegisterTask(ecs, params)
              .then(value => {
                // tslint:disable-next-line:no-console
                console.log(value);
              });

        } else {

                // tslint:disable-next-line:no-console
          console.log(v3.taskDefinition);
        }

      });
  })
  .catch(reason => {
    throw Error(reason.message);
  });

