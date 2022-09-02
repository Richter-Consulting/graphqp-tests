import * as core from '@actions/core'
import * as github from '@actions/github'
import {GraphqlResponseError} from '@octokit/graphql'

type PullRequest = {
  id: string
  number: number
  isDraft: boolean
  title: string
}

type PullRequestQuery = {
  repository: {
    id: string
    name: string
    pullRequest: PullRequest
  }
}

type PullRequestChange = {
  pullRequest: PullRequest
}

export async function run(): Promise<void> {
  try {
    const token = core.getInput('repo-token')
    // const triggerLabel = core.getInput('trigger-label')
    const owner = github.context.repo.owner
    const repo = github.context.repo.repo
    const prNumber = github.context.payload.pull_request?.number || -1

    // get the PR
    const queryPR = `{
      repository(owner: "${owner}", name: "${repo}"){
        id
        name
        pullRequest(number: ${prNumber}){
          id
          number
          isDraft
          title
        }
      }
    }`

    const octokit = github.getOctokit(token)

    const prResult = await octokit.graphql<PullRequestQuery>(queryPR)
    core.info(JSON.stringify(prResult))

    const id = prResult.repository.pullRequest.id

    const toDraft = `mutation {
      convertPullRequestToDraft(input: {pullRequestId: "${id}"}) {
        pullRequest{
          id
          number
          isDraft
          title
        }
      }
    }`

    const draftResult = await octokit.graphql<PullRequestChange>(toDraft)
    core.info(JSON.stringify(draftResult))

    const fromDraft = `mutation {
      markPullRequestReadyForReview(input: {pullRequestId: "$id"}) {
        pullRequest {
          id
          number
          isDraft
          title
        }
      }
    }`

    const reviewResult = await octokit.graphql<PullRequestChange>(fromDraft)
    core.info(JSON.stringify(reviewResult))
  } catch (error) {
    if (error instanceof GraphqlResponseError)
      core.setFailed(JSON.stringify(error))
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
