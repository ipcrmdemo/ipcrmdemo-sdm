import {
  DefaultGoalNameGenerator,
  ExecuteGoal,
  ExecuteGoalResult,
  FulfillableGoalDetails,
  FulfillableGoalWithRegistrations,
  getGoalDefinitionFrom,
  Goal,
  GoalDefinition,
  GoalInvocation,
  GoalProjectListener,
  GoalProjectListenerEvent,
  IndependentOfEnvironment,
  ProgressLog,
  pushTest,
  PushTest,
  SdmGoalState,
  spawnLog,
  SpawnLogResult,
  testProgressReporter,
} from "@atomist/sdm";
import { GitProject, HandlerResult, logger } from "@atomist/automation-client";
import * as _ from "lodash";

export interface TerraformRegistration {
  /**
   * Set the base location for the terraform code in this project.  Relative to project root.
   * Defaults to root
   */
  tfBaseLocation?: string;

  /**
   * Environment variables (key/value) you want to inject into the environment
   */
  tfEnvVars?: {[key: string]: string};

  /**
   * Command line arguments you want to pass to Terraform
   */
  tfArgs?: Array<{tfArg: string, value?: string }>;

  /**
   * Command line vars you want to pass to Terraform, ie -var <thing>=<value>
   */
  tfVars?: Array<{tfVar: string, value?: string }>;

  /**
   * A list of var files you want to pass to Terraform, ie -var-file=<file>
   * Defaults to not present
   */
  tfVarsFiles?: string[];

  /**
   * Execute terraform init prior to goal execution?  If you are handling retrieving the .terraform contents via another
   * vehicle (like a GoalProjectListener), you may not want init to run
   * Defaults to true
   */
  tfInit?: boolean;

  /**
   * Path to the terraform command.  If not supplied relative is used and terraform must be in your path
   */
  tfPath?: string;

  /**
   * Provide a workspace to use and the goal will switch to this workspace prior to executing
   * Note:  The workspace must already exist!
   */
  tfWorkspace?: string;

  /**
   * Enable auto-approve?  This will prevent a plan with approval to be run prior to the apply.  The default setting
   * always runs a plan and waits for an approval prior to running an apply
   */
  tfAutoApprove?: boolean;

}

const TerraformGoalDefinition: GoalDefinition = {
  displayName: "Terraform",
  uniqueName: "execute-terraform",
  environment: IndependentOfEnvironment,
  workingDescription: "Terraform: Executing",
  completedDescription: "Terraform: Execution Successful",
  failedDescription: "Terraform: Execution Failed",
  waitingForApprovalDescription: "Terraform: Awaiting Approval of Execution Result",
  waitingForPreApprovalDescription: "Terraform: Awaiting Plan Approval",
  stoppedDescription: "Terraform: Execution stopped",
  canceledDescription: "Terraform: Execution cancelled",
  retryFeasible: true,
};

export function shouldRunTfInit(reg: TerraformRegistration): PushTest {
  return pushTest(`runTfInit`, async () => {
    return reg.tfInit ? reg.tfInit : true;
  });
}

export function shouldRunSelectTfWorkspace(reg: TerraformRegistration): PushTest {
  return pushTest(`shouldRunSelectTfWorkspace`, async () => {
    return !!reg.tfWorkspace;
  });
}

export class Terraform extends FulfillableGoalWithRegistrations<TerraformRegistration> {
  constructor(
    protected details: FulfillableGoalDetails | string = DefaultGoalNameGenerator.generateName("terraform-execution"),
    ...dependsOn: Goal[]) {

    super({
      ...TerraformGoalDefinition,
      ...getGoalDefinitionFrom(details, DefaultGoalNameGenerator.generateName("terraform-execution")),
    }, ...dependsOn);
  }

  public with(
    registration: TerraformRegistration,
  ): this {
    this.addFulfillment({
      name: DefaultGoalNameGenerator.generateName("terraform-execution"),
      goalExecutor: executeTerraform(registration),
      progressReporter:  testProgressReporter({
          test: /phase:tfinit/i,
          phase: "Initializing Terraform",
        }, {
          test: /phase:tfworkspaceselect/i,
          phase: "Selecting Terraform Workspace",
        }, {
          test: /phase:tfplan/i,
          phase: "Running Terraform Plan",
        }, {
          test: /phase:tfapply/i,
          phase: "Running Terraform Apply",
        },
      ),
    });

    this.withProjectListener({
      name: "runTfInit",
      pushTest: shouldRunTfInit(registration),
      listener: runTfInit(registration),
    });

    this.withProjectListener({
      name: "selectTfWorkspace",
      pushTest: shouldRunSelectTfWorkspace(registration),
      listener: selectTfWorkspace(registration),
    });

    return this;
  }
}

export function selectTfWorkspace(registration: TerraformRegistration): GoalProjectListener {
  return async (p, gi, e) => {
    if (e !== GoalProjectListenerEvent.before ) {
      return {
        code: 0,
      };
    }
    gi.progressLog.write(`phase:tfworkspaceselect`);

    let result: SpawnLogResult;
    result = await spawnLog(
      registration.tfPath ? registration.tfPath : "terraform",
      ["workspace", "select", registration.tfWorkspace],
      {
        cwd: registration.tfBaseLocation ? `${p.baseDir}/${registration.tfBaseLocation}` : p.baseDir,
        log: gi.progressLog,
        logCommand: false,
        env: {...process.env, ...registration.tfEnvVars},
      },
    );
    if (result.code === 0) {
      return {
        code: 0,
      };
    } else {
      logger.error(`Terraform workspace select failed => ${result.stderr}`);
      return {
        code: 1,
        message:
          `Failed to run terraform workspace select!  Output redacted due to secrets.  Please view SDM log`,
      };
    }
  };
}

export function runTfInit(registration: TerraformRegistration): GoalProjectListener {
  return async (p, gi, e) => {
    if (e !== GoalProjectListenerEvent.before ) {
      return {
        code: 0,
      };
    }
    gi.progressLog.write(`phase:tfinit`);

    let result: SpawnLogResult;
    const vars = await buildTfVars(registration);
    result = await spawnLog(
      registration.tfPath ? registration.tfPath : "terraform",
      ["init", ...vars],
      {
        cwd: registration.tfBaseLocation ? `${p.baseDir}/${registration.tfBaseLocation}` : p.baseDir,
        log: gi.progressLog,
        logCommand: false,
        env: {...process.env, ...registration.tfEnvVars},
      },
    );
    if (result.code === 0) {
      return {
        code: 0,
      };
    } else {
      logger.error(`Terraform initialize failed => ${result.stderr}`);
      return {
        code: 1,
        message:
          `Failed to run terraform init!  Output redacted due to secrets.  Please view SDM log`,
      };
    }
  };
}

export async function executeTfAction(
  action: "apply" | "destroy" | "plan",
  registration: TerraformRegistration,
  p: GitProject,
  log: ProgressLog,
  ): Promise<HandlerResult> {
  const args = await buildTfArgs(action, registration);
  const vars = await buildTfVars(registration);
  const result = await spawnLog(
    registration.tfPath ? registration.tfPath : "terraform",
    [action, ...args, ...vars],
    {
      cwd: registration.tfBaseLocation ? `${p.baseDir}/${registration.tfBaseLocation}` : p.baseDir,
      log,
      logCommand: false,
      env: {...process.env, ...registration.tfEnvVars},
    },
  );
  if (!result || result.code !== 0) {
    logger.error(`executeTfAction: Terraform ${action} failed => ${result.stderr}`);
    return {
      code: result.code,
      message:
        `Failed to run terraform ${action}!  Output redacted due to secrets.  Please view SDM log`,
    };
  } else if (result && result.code === 0) {
    return { code: 0 };
  } else {
    return {
      code: 1,
      message: `Unexpected failure running Terraform, please review SDM log`,
    };
  }
}

async function buildExternalUrls(gi: GoalInvocation): Promise<Array<{label?: string, url: string}>> {
  const urls: Array<{label?: string, url: string}> = [];
  if (gi.goalEvent.data) {
    urls.push({label: `Plan Log`, url: _.get(JSON.parse(gi.goalEvent.data), "log", undefined)});
  }
  urls.push({label: `Apply Log`, url: gi.progressLog.url});
  return urls;
}

export function executeTerraform(registration: TerraformRegistration): ExecuteGoal {
  return async (gi: GoalInvocation): Promise<ExecuteGoalResult> => {
    return gi.configuration.sdm.projectLoader.doWithProject({
      credentials: gi.credentials,
      id: gi.id,
      readOnly: true,
    }, async p => {
      let result: ExecuteGoalResult;

      logger.debug(`executeTerraform: Evaluating goal state`);
      if (
        registration.tfAutoApprove ||
        (gi.goalEvent.data && _.get(JSON.parse(gi.goalEvent.data), "state", undefined)  === "planned")
      ) {
        /**
         * We've planned this, someone approved it (or the goal has auto-approved set), now apply
         */
        logger.debug(`executeTerraform: Running terraform apply...`);
        gi.progressLog.write(`phase:tfapply`);
        gi.progressLog.write(`Starting Terraform Apply...`);
        result = await executeTfAction("apply", registration, p, gi.progressLog);
        result = {
          ...result,
          externalUrls: await buildExternalUrls(gi),
        };
      } else {
        /**
         * We've not previously executed a plan (since goal data is unset, or not set to planned).  Execute a plan
         */
        logger.debug(`executeTerraform: Running terraform plan...`);
        gi.progressLog.write(`phase:tfplan`);
        gi.progressLog.write(`Starting Terraform Plan...`);
        const execResult = await executeTfAction("plan", registration, p, gi.progressLog);
        if (execResult.code !== 0) {
          return execResult;
        }
        logger.debug(`executeTerraform: Setting terraform goal state (pre-approval required)...`);
        gi.progressLog.write(`Terraform Plan Completed, awaiting approval.`);
        result = {
          state: SdmGoalState.waiting_for_pre_approval,
          description: gi.goal.waitingForPreApprovalDescription,
          data: JSON.stringify({state: "planned", log: gi.progressLog.url}),
        };
      }

      logger.debug(`executeTerraform: Completed, returning result (${JSON.stringify(result, undefined, 2)}...`);
      return result;
    });

  };
}

export async function buildTfVars(registration: TerraformRegistration): Promise<string[]> {
  const args: string[] = [];
  if (registration.tfVars) {
    args.push(..._.flatten(registration.tfVars.map(a => [`-var`, `${a.tfVar}=${a.value}`])));
  }
  if (registration.tfVarsFiles) {
    args.push(...(registration.tfVarsFiles.map(f => `-var-file=${f}`)));
  }
  return args;
}

export async function buildTfArgs(
  action: "apply" | "plan" | "destroy",
  registration: TerraformRegistration,
): Promise<string[]> {
  const args: string[] = [];
  switch (action) {
    case "apply": {
      args.push("-auto-approve");
      break;
    }
    case "destroy": {
      args.push("-force");
    }
  }
  if (registration.tfArgs) {
    args.push(
      ...registration.tfArgs.map(
        a => `${a.tfArg}${a.value ? `=${a.value}` : ""}`,
      ),
    );
  }
  return args;
}
