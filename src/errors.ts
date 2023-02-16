import { MorphContext, MorphIssue } from ".";

export class MorphError {
    public readonly issues: MorphIssue[] = [];
    
    public static from(context: MorphContext) {
        return new this(...context.getIssues());
    }

    constructor(issues: Iterable<MorphIssue>)
    constructor(...issues: MorphIssue[])
    constructor(issueOrIssueIterable: MorphIssue | Iterable<MorphIssue>, ...issues: MorphIssue[]) {
        if (Symbol.iterator in issueOrIssueIterable) issues = [...issueOrIssueIterable];
        else issues = [issueOrIssueIterable, ...issues];

        this.issues = [...issues];
    }
}