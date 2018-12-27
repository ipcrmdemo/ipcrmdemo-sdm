import * as fs from "fs";
interface IngesterWebhook {
    url: string;
    team_id: string;
}

interface Ingester {
    root_type: string;
    webhooks: IngesterWebhook[];
}
interface Registration {
    name: string;
    ingesters: Ingester[];
}

const reg = JSON.parse(fs.readFileSync("/tmp/testreg", "utf8")) as Registration[];

// Get my registration
const mySdm = reg.filter(r => r.name === "ipcrmdemo-sdm");

let ingesterUrl: string;
mySdm.forEach(r => {
    const jiraIng = r.ingesters.filter(i => i.root_type === "JiraIssueLifecycleEvent");
    if (jiraIng.length > 0) {
        ingesterUrl = jiraIng[0].webhooks[0].url;
    }
});

process.stdout.write(JSON.stringify(ingesterUrl));
