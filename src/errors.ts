import { RemapContext, RemapIssue } from ".";

export class RemapError {
    public readonly issues: RemapIssue[] = [];
    
    public static from(context: RemapContext) {
        return new this(...context.getIssues());
    }

    constructor(issues: Iterable<RemapIssue>)
    constructor(...issues: RemapIssue[])
    constructor(issueOrIssueIterable: RemapIssue | Iterable<RemapIssue>, ...issues: RemapIssue[]) {
        if (Symbol.iterator in issueOrIssueIterable) issues = [...issueOrIssueIterable];
        else issues = [issueOrIssueIterable, ...issues];

        this.issues = [...issues];
    }
}