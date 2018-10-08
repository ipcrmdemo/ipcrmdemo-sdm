
import {
    ArtifactGoal,
    GoalWithPrecondition,
} from "@atomist/sdm";

export const StagingDeploymentGoalWApproval = new GoalWithPrecondition({
    uniqueName: "deploy-to-test",
    environment: "1-staging/",
    displayName: "deploy to Test",
    completedDescription: "Deployed to Test",
    failedDescription: "Test deployment failure",
    approvalRequired: true,
}, ArtifactGoal);

export const ProductionDeploymentGoalWPreApproval = new GoalWithPrecondition({
    uniqueName: "deploy-to-prod",
    environment: "2-prod/",
    displayName: "deploy to prod",
    completedDescription: "Deployed to Prod",
    failedDescription: "Prod deployment failure",
    preApprovalRequired: true,
}, ArtifactGoal);
