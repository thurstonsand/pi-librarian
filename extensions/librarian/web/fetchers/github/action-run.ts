import { type Static, Type } from "typebox";
import type { FetchedDocument } from "../../contract.ts";
import { writeDocumentBody } from "../../shared.ts";
import { listWithCap } from "./pagination.ts";
import { escapeTableCell, GITHUB_USER_SCHEMA, type GitHubFetchContext } from "./shared.ts";
import type { ActionRunTarget, GitHubRepo } from "./urls.ts";

const ACTION_RUN_LIMIT = 100;
const JOB_LIMIT = 200;
const ARTIFACT_LIMIT = 100;

const NULLABLE_STRING = Type.Union([Type.String(), Type.Null()]);

const WORKFLOW_RUN_LIST_ITEM_SCHEMA = Type.Object({
  run_number: Type.Number(),
  display_title: Type.String(),
  name: Type.Optional(NULLABLE_STRING),
  status: NULLABLE_STRING,
  conclusion: NULLABLE_STRING,
  event: Type.String(),
  head_branch: NULLABLE_STRING,
  actor: Type.Optional(GITHUB_USER_SCHEMA),
  run_started_at: Type.Optional(Type.String()),
  created_at: Type.String(),
  html_url: Type.String(),
});

const WORKFLOW_RUNS_SCHEMA = Type.Object({
  total_count: Type.Number(),
  workflow_runs: Type.Array(WORKFLOW_RUN_LIST_ITEM_SCHEMA),
});

const WORKFLOW_RUN_SCHEMA = Type.Object({
  id: Type.Number(),
  run_number: Type.Number(),
  run_attempt: Type.Optional(Type.Number()),
  display_title: Type.String(),
  name: Type.Optional(NULLABLE_STRING),
  status: NULLABLE_STRING,
  conclusion: NULLABLE_STRING,
  event: Type.String(),
  head_branch: NULLABLE_STRING,
  head_sha: Type.String(),
  head_commit: Type.Union([Type.Object({ message: Type.String() }), Type.Null()]),
  actor: Type.Optional(GITHUB_USER_SCHEMA),
  run_started_at: Type.Optional(Type.String()),
  created_at: Type.String(),
  updated_at: Type.String(),
  html_url: Type.String(),
});

const WORKFLOW_JOB_SCHEMA = Type.Object({
  name: Type.String(),
  status: Type.String(),
  conclusion: NULLABLE_STRING,
  runner_name: NULLABLE_STRING,
  started_at: Type.String(),
  completed_at: NULLABLE_STRING,
  html_url: NULLABLE_STRING,
  steps: Type.Optional(
    Type.Array(
      Type.Object({
        name: Type.String(),
        status: Type.String(),
        conclusion: NULLABLE_STRING,
        started_at: Type.Optional(NULLABLE_STRING),
        completed_at: Type.Optional(NULLABLE_STRING),
      }),
    ),
  ),
});

const WORKFLOW_ARTIFACT_SCHEMA = Type.Object({
  name: Type.String(),
  size_in_bytes: Type.Number(),
  expired: Type.Boolean(),
  created_at: NULLABLE_STRING,
  expires_at: NULLABLE_STRING,
  archive_download_url: Type.String(),
});

type WorkflowRun = Static<typeof WORKFLOW_RUN_SCHEMA>;
type WorkflowRunListItem = Static<typeof WORKFLOW_RUN_LIST_ITEM_SCHEMA>;
type WorkflowJob = Static<typeof WORKFLOW_JOB_SCHEMA>;
type WorkflowArtifact = Static<typeof WORKFLOW_ARTIFACT_SCHEMA>;

export async function fetchActionRunList(
  context: GitHubFetchContext,
  target: GitHubRepo & { url: string },
): Promise<FetchedDocument> {
  const response = await context.client.get(
    {
      route: "GET /repos/{owner}/{repo}/actions/runs",
      params: { owner: target.owner, repo: target.repo, per_page: ACTION_RUN_LIMIT },
      operation: `Actions runs of ${target.owner}/${target.repo}`,
      signal: context.signal,
    },
    WORKFLOW_RUNS_SCHEMA,
  );
  const runs = response.workflow_runs;
  const total = response.total_count;
  const truncated = total > runs.length;
  return {
    kind: "github.action_run_list",
    source: context.source,
    url: target.url,
    title: `${target.owner}/${target.repo} Actions runs`,
    facts: [truncated ? `${total} runs, showing first ${runs.length}` : `${total} runs`],
    excerpt:
      runs.map((run) => `#${run.run_number} ${run.display_title || run.name}`).join("\n") ||
      undefined,
    bodies: [
      await writeDocumentBody(
        context.artifactDir,
        target.url,
        "listing.md",
        renderActionRunList(target, runs, truncated),
      ),
    ],
  };
}

export async function fetchActionRun(
  context: GitHubFetchContext,
  target: ActionRunTarget,
): Promise<FetchedDocument> {
  const runParams = { owner: target.owner, repo: target.repo, run_id: target.runId };
  const runName = `Actions run ${target.runId} of ${target.owner}/${target.repo}`;
  const [run, jobs, artifacts] = await Promise.all([
    context.client.get(
      {
        route: "GET /repos/{owner}/{repo}/actions/runs/{run_id}",
        params: runParams,
        operation: runName,
        signal: context.signal,
      },
      WORKFLOW_RUN_SCHEMA,
    ),
    listWithCap(JOB_LIMIT, async (page, perPage) => {
      const response = await context.client.get(
        {
          route: "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs",
          params: { ...runParams, page, per_page: perPage },
          operation: `jobs of ${runName}`,
          signal: context.signal,
        },
        Type.Object({ jobs: Type.Array(WORKFLOW_JOB_SCHEMA) }),
      );
      return response.jobs;
    }),
    listWithCap(ARTIFACT_LIMIT, async (page, perPage) => {
      const response = await context.client.get(
        {
          route: "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts",
          params: { ...runParams, page, per_page: perPage },
          operation: `artifacts of ${runName}`,
          signal: context.signal,
        },
        Type.Object({ artifacts: Type.Array(WORKFLOW_ARTIFACT_SCHEMA) }),
      );
      return response.artifacts;
    }),
  ]);
  const title = run.display_title || run.name || `Actions run ${run.id}`;

  return {
    kind: "github.action_run",
    source: context.source,
    url: target.url,
    link: run.html_url,
    title: `${target.owner}/${target.repo} run #${run.run_number}: ${title}`,
    facts: [
      `${run.status}${run.conclusion ? ` (${run.conclusion})` : ""}`,
      ...(run.name ? [`workflow ${run.name}`] : []),
      `event ${run.event}`,
      ...(run.head_branch ? [`branch ${run.head_branch}`] : []),
      `${jobs.items.length} job${jobs.items.length === 1 ? "" : "s"}`,
      `${artifacts.items.length} artifact${artifacts.items.length === 1 ? "" : "s"}`,
      ...(jobs.truncated || artifacts.truncated ? ["some lists capped; see run.md"] : []),
    ],
    excerpt: run.head_commit?.message ?? run.display_title,
    bodies: [
      await writeDocumentBody(
        context.artifactDir,
        target.url,
        "run.md",
        renderActionRunMarkdown(
          run,
          jobs.items,
          jobs.truncated,
          artifacts.items,
          artifacts.truncated,
        ),
      ),
    ],
  };
}

function renderActionRunList(
  target: GitHubRepo,
  runs: WorkflowRunListItem[],
  truncated: boolean,
): string {
  const lines = [
    `# ${target.owner}/${target.repo} Actions runs`,
    "",
    "| Run | Title | Workflow | Status | Event | Branch | Actor | Started | URL |",
    "| ---: | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const run of runs) {
    lines.push(
      `| ${run.run_number} | ${escapeTableCell(run.display_title || "")} | ${escapeTableCell(run.name ?? "")} | ${run.status}${run.conclusion ? ` (${run.conclusion})` : ""} | ${run.event} | ${escapeTableCell(run.head_branch ?? "")} | ${escapeTableCell(run.actor?.login ?? "")} | ${run.run_started_at ?? run.created_at} | ${escapeTableCell(run.html_url)} |`,
    );
  }
  if (truncated) lines.push("", `[listing capped at ${ACTION_RUN_LIMIT} runs]`);
  return `${lines.join("\n")}\n`;
}

function renderActionRunMarkdown(
  run: WorkflowRun,
  jobs: WorkflowJob[],
  jobsTruncated: boolean,
  artifacts: WorkflowArtifact[],
  artifactsTruncated: boolean,
): string {
  const lines = [
    `# ${run.display_title || run.name || `Actions run ${run.id}`}`,
    "",
    `- Workflow: ${run.name ?? "unknown"}`,
    `- Run: #${run.run_number}, attempt ${run.run_attempt ?? 1}`,
    `- Status: ${run.status}${run.conclusion ? ` (${run.conclusion})` : ""}`,
    `- Event: ${run.event}`,
    `- Actor: ${run.actor?.login ?? "unknown"}`,
    `- Branch: ${run.head_branch ?? "unknown"}`,
    `- Commit: ${run.head_sha}`,
    `- Started: ${run.run_started_at ?? run.created_at}`,
    `- Updated: ${run.updated_at}`,
    `- URL: ${run.html_url}`,
    "",
    "## Jobs",
  ];

  if (jobs.length === 0) lines.push("", "(none)");
  for (const job of jobs) {
    lines.push(
      "",
      `### ${job.name}`,
      "",
      `- Status: ${job.status}${job.conclusion ? ` (${job.conclusion})` : ""}`,
      `- Runner: ${job.runner_name ?? "unknown"}`,
      `- Started: ${job.started_at}`,
      `- Completed: ${job.completed_at ?? "not completed"}`,
      `- URL: ${job.html_url ?? "unavailable"}`,
    );
    if (job.steps && job.steps.length > 0) {
      lines.push(
        "",
        "| Step | Status | Conclusion | Started | Completed |",
        "| --- | --- | --- | --- | --- |",
      );
      for (const step of job.steps) {
        lines.push(
          `| ${escapeTableCell(step.name)} | ${step.status} | ${step.conclusion ?? ""} | ${step.started_at ?? ""} | ${step.completed_at ?? ""} |`,
        );
      }
    }
  }
  if (jobsTruncated) lines.push("", `[jobs capped at ${JOB_LIMIT}]`);

  lines.push("", "## Artifacts", "");
  if (artifacts.length === 0) {
    lines.push("(none)");
  } else {
    lines.push(
      "| Name | Size | Expired | Created | Expires | Archive API URL |",
      "| --- | ---: | --- | --- | --- | --- |",
    );
    for (const artifact of artifacts) {
      lines.push(
        `| ${escapeTableCell(artifact.name)} | ${artifact.size_in_bytes} | ${artifact.expired ? "yes" : "no"} | ${artifact.created_at ?? ""} | ${artifact.expires_at ?? ""} | ${escapeTableCell(artifact.archive_download_url)} |`,
      );
    }
  }
  if (artifactsTruncated) lines.push("", `[artifacts capped at ${ARTIFACT_LIMIT}]`);
  return `${lines.join("\n")}\n`;
}
