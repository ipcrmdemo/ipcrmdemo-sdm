import { PushListenerInvocation } from "@atomist/sdm";
import { createWebhook } from "./createWebhook";

export async function firstPushToBitbucket(pi: PushListenerInvocation): Promise<void> {
  await createWebhook(pi.push.repo.owner, pi.push.repo.name);
}
