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

- For each commit that describes a change to the dev branch, create a bullet point describing the change.
- If the commit describes a change to a previous commit on the feature branch, use it to elaborate on a previous bullet point. Do not create a new bullet point for it.
- Create a one or two sentence overview to include at the top

## Creating the pull request

1. Use the `create_pull_request` tool to create a pull request.

No need to ask for permission to actually create the pull request. Include a link to the pull request in your response, and I will edit it in-post if needed.
