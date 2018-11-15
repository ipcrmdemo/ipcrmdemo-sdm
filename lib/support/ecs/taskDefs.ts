import { ECS } from "aws-sdk";
import { logger } from "@atomist/automation-client";

// Get a listing of active ARNs for the supplied task def family
export function ecsListTaskDefinitions(
  ecsService: ECS,
  ecsFamily: string,
): string[] {
    logger.info("Entering ecsListTaskDefinition");
    ecsService.listTaskDefinitionFamilies({status: "ACTIVE"}, (err, data) => {
        if (err) {
          throw Error(err.message);
        }
        logger.info("Entering ecsListTaskDefinition - else");
        // tslint:disable-next-line:no-console
        if (data.families.includes(ecsFamily)) {
            logger.info("Entering ecsListTaskDefinition - data.families");
            ecsService.listTaskDefinitions({familyPrefix: ecsFamily}, (e, d) => {
              if (e) {
                logger.info("Entering ecsListTaskDefinition - reject");
                throw new Error(e.message);
              } else {
                logger.info("Entering ecsListTaskDefinition - resolve");
                return (d.taskDefinitionArns);
              }
            });
          }
        });
    // Failed to find values, return an empty array
    return [];
}

// Supply one of the entries from ecsListTaskDefinitions and get returned the json definition
export async function ecsGetTaskDefinition(
  ecsService: ECS,
  ecsTaskDef: string,
  ): Promise<ECS.Types.DescribeTaskDefinitionResponse> {
    return new Promise<ECS.Types.DescribeTaskDefinitionResponse>(async (resolve, reject) => {

      if (ecsTaskDef) {
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
      } else {
        reject(false);
      }
    });
}

// Create a new service definition
export async function ecsRegisterTask(
  ecsService: ECS,
  ecsParams: ECS.Types.RegisterTaskDefinitionRequest): Promise<ECS.Types.RegisterTaskDefinitionResponse> {
    return new Promise<ECS.Types.RegisterTaskDefinitionResponse>((resolve, reject) => {
      ecsService.registerTaskDefinition(ecsParams, async (err, data) => {
        if (err) {
          logger.debug(err.message);
          reject(err.message);
        }

        resolve(data);
      });
    });
}

// Compare two task definitions from left to right
//  ie; iterate keys of obj1 and see if they match in obj2
//  used to determine if a user supplied definition (which contains a subset of available keys)
//  matches an existing task definion revision
export function cmpSuppliedTaskDefinition(obj1: any, obj2: any): boolean {
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
}
