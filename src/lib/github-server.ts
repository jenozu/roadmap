import { parseRoadmap } from "./roadmap.ts";
import {
  validateProject,
  type CommitActivity,
  type Project,
  type ProjectSnapshot,
  type RepositoryVisibility
} from "./github.ts";

export type GitHubProjectErrorCode =
  | "INVALID_PROJECT"
  | "FILE_NOT_FOUND"
  | "REPOSITORY_UNAVAILABLE"
  | "PRIVATE_REPO_NOT_AUTHORIZED"
  | "PRIVATE_SESSION_REQUIRED"
  | "GITHUB_CREDENTIAL_NOT_CONFIGURED"
  | "GITHUB_CREDENTIAL_INVALID"
  | "PRIVATE_REPO_ACCESS_DENIED"
  | "GITHUB_UNAVAILABLE"
  | "ROADMAP_TOO_LARGE"
  | "INVALID_GITHUB_RESPONSE";

export class GitHubProjectError extends Error {
  constructor(
    public readonly code: GitHubProjectErrorCode,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "GitHubProjectError";
  }
}

type Environment = Record<string, string | undefined>;
type FetchLike = typeof fetch;

export type FetchProjectOptions = {
  includeActivity?: boolean;
  privateAccessAuthorized?: boolean;
  fetchImpl?: FetchLike;
  env?: Environment;
};

const MAX_ROADMAP_BYTES = 750_000;
const API_ROOT = "https://api.github.com";

function canonicalRepo(repo: string): string {
  return repo.trim().toLowerCase();
}

export function privateRepoAllowlist(env: Environment = process.env): Set<string> {
  return new Set(
    (env.GITHUB_PRIVATE_REPO_ALLOWLIST || "")
      .split(",")
      .map(value => canonicalRepo(value))
      .filter(Boolean)
  );
}

function githubHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "voyages-roadmap"
  };
  if (token) headers.Authorization = "Bearer " + token;
  return headers;
}

function repoApiUrl(project: Project): string {
  const [owner, repo] = project.repo.split("/");
  return API_ROOT + "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo);
}

function contentsApiUrl(project: Project): string {
  const encodedPath = project.path.split("/").map(encodeURIComponent).join("/");
  return repoApiUrl(project) + "/contents/" + encodedPath + "?ref=" + encodeURIComponent(project.branch);
}

function commitsApiUrl(project: Project): string {
  return repoApiUrl(project) + "/commits?path=" + encodeURIComponent(project.path) +
    "&sha=" + encodeURIComponent(project.branch) + "&per_page=6";
}

async function safeJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { return undefined; }
}

function decodeRoadmapPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new GitHubProjectError("INVALID_GITHUB_RESPONSE", "GitHub returned an invalid roadmap response.", 502);
  }
  const record = payload as Record<string, unknown>;
  if (record.type !== "file" || record.encoding !== "base64" || typeof record.content !== "string") {
    throw new GitHubProjectError("INVALID_GITHUB_RESPONSE", "GitHub did not return a readable Markdown file.", 502);
  }
  const declaredSize = typeof record.size === "number" ? record.size : 0;
  if (declaredSize > MAX_ROADMAP_BYTES) {
    throw new GitHubProjectError("ROADMAP_TOO_LARGE", "The roadmap exceeds the 750 KB import limit.", 413);
  }
  let markdown: string;
  try {
    markdown = Buffer.from(record.content.replace(/\s/g, ""), "base64").toString("utf8");
  } catch {
    throw new GitHubProjectError("INVALID_GITHUB_RESPONSE", "GitHub returned unreadable roadmap content.", 502);
  }
  if (Buffer.byteLength(markdown, "utf8") > MAX_ROADMAP_BYTES) {
    throw new GitHubProjectError("ROADMAP_TOO_LARGE", "The roadmap exceeds the 750 KB import limit.", 413);
  }
  return markdown;
}

async function request(fetchImpl: FetchLike, url: string, token?: string): Promise<Response> {
  try {
    return await fetchImpl(url, {
      headers: githubHeaders(token),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000)
    });
  } catch {
    throw new GitHubProjectError("GITHUB_UNAVAILABLE", "GitHub could not be reached. Try again shortly.", 502);
  }
}

async function publicRepositoryExists(fetchImpl: FetchLike, project: Project): Promise<boolean> {
  const response = await request(fetchImpl, repoApiUrl(project));
  if (response.ok) return true;
  if (response.status === 404) return false;
  if (response.status === 403 || response.status === 429) {
    throw new GitHubProjectError("GITHUB_UNAVAILABLE", "GitHub public access is temporarily unavailable. Try again shortly.", 503);
  }
  throw new GitHubProjectError("GITHUB_UNAVAILABLE", "GitHub could not verify this repository.", 502);
}

async function authenticatedRepositoryVisibility(
  fetchImpl: FetchLike,
  project: Project,
  token: string
): Promise<RepositoryVisibility> {
  const response = await request(fetchImpl, repoApiUrl(project), token);
  if (response.status === 401) {
    throw new GitHubProjectError("GITHUB_CREDENTIAL_INVALID", "The configured GitHub read credential is invalid or expired.", 503);
  }
  if (response.status === 403) {
    throw new GitHubProjectError("PRIVATE_REPO_ACCESS_DENIED", "GitHub denied read access to this authorized private repository.", 403);
  }
  if (response.status === 404) {
    throw new GitHubProjectError("REPOSITORY_UNAVAILABLE", "The authorized repository is unavailable to the configured GitHub credential.", 404);
  }
  if (!response.ok) {
    throw new GitHubProjectError("GITHUB_UNAVAILABLE", "GitHub could not verify the authorized repository.", 502);
  }
  const payload = await safeJson(response);
  if (!payload || typeof payload !== "object") {
    throw new GitHubProjectError("INVALID_GITHUB_RESPONSE", "GitHub returned an invalid repository response.", 502);
  }
  return (payload as Record<string, unknown>).private === true ? "private" : "public";
}

async function fetchRoadmapContents(
  fetchImpl: FetchLike,
  project: Project,
  token?: string
): Promise<{ response: Response; markdown?: string }> {
  const response = await request(fetchImpl, contentsApiUrl(project), token);
  if (!response.ok) return { response };
  return { response, markdown: decodeRoadmapPayload(await safeJson(response)) };
}

async function fetchCommitActivity(
  fetchImpl: FetchLike,
  project: Project,
  token?: string
): Promise<CommitActivity[]> {
  const response = await request(fetchImpl, commitsApiUrl(project), token);
  if (response.status === 401 && token) {
    throw new GitHubProjectError("GITHUB_CREDENTIAL_INVALID", "The configured GitHub read credential is invalid or expired.", 503);
  }
  if (response.status === 403 && token) {
    throw new GitHubProjectError("PRIVATE_REPO_ACCESS_DENIED", "GitHub denied commit-history access to this authorized private repository.", 403);
  }
  if (!response.ok) return [];
  const payload = await safeJson(response);
  if (!Array.isArray(payload)) return [];
  return payload.slice(0, 6).flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, any>;
    if (typeof record.sha !== "string" || typeof record.html_url !== "string") return [];
    return [{
      id: record.sha,
      message: typeof record.commit?.message === "string" ? record.commit.message.split("\n")[0] : "GitHub update",
      author: typeof record.commit?.author?.name === "string" ? record.commit.author.name : "Contributor",
      date: typeof record.commit?.author?.date === "string" ? record.commit.author.date : "",
      url: record.html_url
    }];
  });
}

export async function fetchProject(
  projectInput: Partial<Project>,
  options: FetchProjectOptions = {}
): Promise<ProjectSnapshot> {
  let project: Project;
  try {
    project = validateProject(projectInput);
  } catch {
    throw new GitHubProjectError("INVALID_PROJECT", "Enter a valid GitHub owner/repo, branch and Markdown file path.", 400);
  }

  const fetchImpl = options.fetchImpl || fetch;
  const env = options.env || process.env;
  const publicContents = await fetchRoadmapContents(fetchImpl, project);

  let markdown: string;
  let visibility: RepositoryVisibility = "public";
  let token: string | undefined;

  if (publicContents.response.ok && publicContents.markdown !== undefined) {
    markdown = publicContents.markdown;
  } else if (publicContents.response.status === 404) {
    const publicRepo = await publicRepositoryExists(fetchImpl, project);
    if (publicRepo) {
      throw new GitHubProjectError(
        "FILE_NOT_FOUND",
        "The roadmap file or branch was not found in this public repository.",
        404
      );
    }

    const allowlist = privateRepoAllowlist(env);
    if (!allowlist.has(canonicalRepo(project.repo))) {
      throw new GitHubProjectError(
        "PRIVATE_REPO_NOT_AUTHORIZED",
        "This repository is unavailable publicly and is not authorized for private access.",
        403
      );
    }
    if (!options.privateAccessAuthorized) {
      throw new GitHubProjectError(
        "PRIVATE_SESSION_REQUIRED",
        "Unlock private Voyages access before loading an authorized private repository.",
        401
      );
    }

    token = env.GITHUB_READ_TOKEN?.trim();
    if (!token) {
      throw new GitHubProjectError(
        "GITHUB_CREDENTIAL_NOT_CONFIGURED",
        "Private GitHub access is authorized but the server read credential is not configured.",
        503
      );
    }

    visibility = await authenticatedRepositoryVisibility(fetchImpl, project, token);
    const privateContents = await fetchRoadmapContents(fetchImpl, project, token);
    if (privateContents.response.status === 401) {
      throw new GitHubProjectError("GITHUB_CREDENTIAL_INVALID", "The configured GitHub read credential is invalid or expired.", 503);
    }
    if (privateContents.response.status === 403) {
      throw new GitHubProjectError("PRIVATE_REPO_ACCESS_DENIED", "GitHub denied access to this authorized roadmap file.", 403);
    }
    if (privateContents.response.status === 404) {
      throw new GitHubProjectError("FILE_NOT_FOUND", "The roadmap file or branch was not found in this authorized repository.", 404);
    }
    if (!privateContents.response.ok || privateContents.markdown === undefined) {
      throw new GitHubProjectError("GITHUB_UNAVAILABLE", "GitHub could not load the authorized roadmap file.", 502);
    }
    markdown = privateContents.markdown;
  } else if (publicContents.response.status === 403 || publicContents.response.status === 429) {
    throw new GitHubProjectError("GITHUB_UNAVAILABLE", "GitHub public access is temporarily unavailable. Try again shortly.", 503);
  } else {
    throw new GitHubProjectError("GITHUB_UNAVAILABLE", "GitHub could not load this roadmap.", 502);
  }

  const voyage = parseRoadmap(markdown);
  let activity: CommitActivity[] = [];
  if (options.includeActivity !== false) {
    activity = await fetchCommitActivity(fetchImpl, project, token);
  }

  return {
    project,
    voyage,
    activity,
    updatedAt: new Date().toISOString(),
    repositoryVisibility: visibility
  };
}
