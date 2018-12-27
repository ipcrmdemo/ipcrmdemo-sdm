export interface JiraIssueWebhook {
    timestamp: number;
    webhookEvent: string;
    issue_event_type_name: string;
    user: User;
    issue: Issue;
    comment: Comment;
    changelog: JiraChangelog;
}

interface AvatarUrls {
    "48x48": string;
    "24x24": string;
    "16x16": string;
    "32x32": string;
}

interface User {
    self: string;
    name: string;
    key: string;
    emailAddress: string;
    avatarUrls: AvatarUrls;
    displayName: string;
    active: boolean;
    timeZone: string;
}

interface Issuetype {
    self: string;
    id: string;
    description: string;
    iconUrl: string;
    name: string;
    subtask: boolean;
}

interface Project {
    self: string;
    id: string;
    key: string;
    name: string;
    projectTypeKey: string;
    avatarUrls: AvatarUrls;
}

interface FixVersion {
    self: string;
    id: string;
    name: string;
    archived: boolean;
    released: boolean;
    releaseDate: string;
}

// TODO - Fix TimeTracking
// tslint:disable-next-line:no-empty-interface
interface Timetracking {
}

interface Watches {
    self: string;
    watchCount: number;
    isWatching: boolean;
}

interface Creator {
    self: string;
    name: string;
    key: string;
    emailAddress: string;
    avatarUrls: AvatarUrls;
    displayName: string;
    active: boolean;
    timeZone: string;
}

interface StatusCategory {
    self: string;
    id: number;
    key: string;
    colorName: string;
    name: string;
}

interface Status {
    self: string;
    description: string;
    iconUrl: string;
    name: string;
    id: string;
    statusCategory: StatusCategory;
}

interface Priority {
    self: string;
    iconUrl: string;
    name: string;
    id: string;
}

interface SubTaskFields {
    summary: string;
    status: Status;
    priority: Priority;
    issuetype: Issuetype;
}

interface Subtask {
    id: string;
    key: string;
    self: string;
    fields: SubTaskFields;
}

interface Reporter {
    self: string;
    name: string;
    key: string;
    emailAddress: string;
    avatarUrls: AvatarUrls;
    displayName: string;
    active: boolean;
    timeZone: string;
}

interface Aggregateprogress {
    progress: number;
    total: number;
}

interface Progress {
    progress: number;
    total: number;
}

interface Author {
    self: string;
    name: string;
    key: string;
    emailAddress: string;
    avatarUrls: AvatarUrls;
    displayName: string;
    active: boolean;
    timeZone: string;
}

interface Comment {
    self: string;
    id: string;
    author: Author;
    body: string;
    updateAuthor: Author;
    created: Date;
    updated: Date;
}

interface Comments {
    comments: Comment[];
    maxResults: number;
    total: number;
    startAt: number;
}

interface Votes {
    self: string;
    votes: number;
    hasVoted: boolean;
}

interface Worklog {
    startAt: number;
    maxResults: number;
    total: number;
    worklogs: any[];
}

interface Assignee {
    self: string;
    name: string;
    key: string;
    emailAddress: string;
    avatarUrls: AvatarUrls;
    displayName: string;
    active: boolean;
    timeZone: string;
}

interface Fields {
    issuetype: Issuetype;
    components: any[];
    timespent?: any;
    timeoriginalestimate?: any;
    description?: any;
    project: Project;
    fixVersions: FixVersion[];
    aggregatetimespent?: any;
    resolution?: any;
    timetracking: Timetracking;
    customfield_10005: string;
    customfield_10006: number;
    attachment: any[];
    aggregatetimeestimate?: any;
    resolutiondate?: any;
    workratio: number;
    summary: string;
    lastViewed: Date;
    watches: Watches;
    creator: Creator;
    subtasks: Subtask[];
    created: Date;
    reporter: Reporter;
    customfield_10000?: any;
    aggregateprogress: Aggregateprogress;
    priority: Priority;
    customfield_10100: string;
    labels: any[];
    customfield_10004: string[];
    environment?: any;
    timeestimate?: any;
    aggregatetimeoriginalestimate?: any;
    versions: any[];
    duedate?: any;
    progress: Progress;
    comment: Comments;
    issuelinks: any[];
    votes: Votes;
    worklog: Worklog;
    assignee: Assignee;
    updated: Date;
    status: Status;
}

interface Issue {
    id: string;
    self: string;
    key: string;
    fields: Fields;
}

export interface ChangelogItem {
    field: string;
    fieldtype: string;
    from: string;
    fromString: string;
    to: string;
    toString: string;
}

export interface JiraChangelog {
    id: string;
    items: ChangelogItem[];
}
