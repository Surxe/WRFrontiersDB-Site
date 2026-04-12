# Creating a pull request

## Prerequisites

Before creating a pull request, ensure that:

1. You have a feature branch that is up to date with the `dev` branch.
2. You have run `npm run format:fix`.
3. You have run `npm run build`, `npm run lint`, and `npm run format:check` and all have passed.
4. You have run `npm run dev` and the dev server starts successfully.
5. You have run `npm run test` and all tests have passed.

## Building context of the feature branch

1. Use `git log dev..HEAD` to get the commits between the feature branch and the `dev` branch.
2. Check the git diff of each commit to understand the changes made.
3. Create a summary of the changes made to form as the pull request description.

## Creating summary of the changes made

- For each commit that describes a change to the dev branch (not a change to a previous change on the feature branch), create a bullet point describing the change.
- If the commit describes a change to a previous commit on the feature branch, use it to elaborate on a previous bullet point. Do not create a new bullet point for it.
- Create a one or two sentence overview to include at the top

### Bad Example

A bad PR example is at `/.agents/skills/create-pull-request/bad_pr_example.md`

This example is bad for a few reasons:

- Excess detail in the overview and each bullet point
- Mentions testing was completed- this is assumed and not necessary

Most importantly, it mentions the changes added by commits that simply build on previous commits. A PR should summarize the over-arching changes added, not list the changes added between each individual commit. In this case, it lists the commit of extracting the stat meta data functionality further from the previously committed implementation.

### Good Example

A good PR example is at `/.agents/skills/create-pull-request/good_pr_example.md`

This example is good because:

- It provides a concise overview of the changes
- It doesn't mention testing, as this is assumed
- It doesn't list changes that simply build on previous commits
- It elaborates on the bulkier changes using information that came directly from the plan
- It elaborates on why the conditional logic for `unit_scalar` is necessary

### Preferences

- Use bullet points to organize information
- Do not use emojis or other decorative elements
- Under 50 lines total

## Creating the pull request

1. Write a temp .md file that contains the body of the PR
2. Use `gh pr create --title "title" --body-file pr-body.md`
3. Clean up temp files

No need to ask for permission to actually create the pull request. Include a link to the pull request in your response, and I will edit it in-post if needed.
