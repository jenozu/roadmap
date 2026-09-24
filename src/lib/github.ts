import { parseRoadmap, type Voyage } from "./roadmap";

export type Project = { id: string; name: string; repo: string; branch: string; path: string };
export type CommitActivity = { id: string; message: string; author: string; date: string; url: string };
export type ProjectSnapshot = { project: Project; voyage: Voyage; activity: CommitActivity[]; updatedAt: string };

export const firstProject: Project = {
  id: "trade-alerts",
  name: "Trade Alerts",
  repo: "jenozu/trade-alerts",
  branch: "main",
  path: "phases.md"
};

// User-supplied values are never treated as arbitrary URLs.
export function validateProject(input: Partial<Project>): Project {
  const repo = (input.repo ?? "").trim();
  const branch = (input.branch ?? "main").trim();
  const path = (input.path ?? "master_list.md").trim();
  if (!/^[a-z\d_.-]+\/[a-z\d_.-]+$/i.test(repo) ||
      !/^[a-z\d_./-]+$/i.test(branch) ||
      !/^[a-z\d_./-]+\.md$/i.test(path) ||
      branch.includes("..") || path.includes("..") ||
      branch.startsWith("/") || path.startsWith("/")) {
    throw new Error("Enter a valid GitHub owner/repo, branch and Markdown file path.");
  }
  return {
    id: repo.toLowerCase().replace(/[^a-z\d-]+/g, "-"),
    name: (input.name || repo.split("/")[1]).slice(0, 80),
    repo, branch, path
  };
}

export async function fetchProject(projectInput: Partial<Project>): Promise<ProjectSnapshot> {
  const project = validateProject(projectInput);
  // Public repositories only. Future private access will require authentication
  // and an explicit repository allowlist before any read token is introduced.
  const parts = project.repo.split("/");
  const rawUrl = "https://raw.githubusercontent.com/" +
    parts.map(encodeURIComponent).join("/") + "/" +
    project.branch.split("/").map(encodeURIComponent).join("/") + "/" +
    project.path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(rawUrl, {
    headers: { "Accept": "text/plain" },
    cache: "no-store",
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error("GitHub roadmap could not be loaded (HTTP " + response.status + ").");
  const markdown = await response.text();
  if (markdown.length > 750000) throw new Error("The roadmap exceeds the 750 KB import limit.");
  const voyage = parseRoadmap(markdown);

  const commitsUrl = "https://api.github.com/repos/" +
    parts.map(encodeURIComponent).join("/") + "/commits?path=" +
    encodeURIComponent(project.path) + "&per_page=6";
  let activity: CommitActivity[] = [];
  try {
    const commitsResponse = await fetch(commitsUrl, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (commitsResponse.ok) {
      const json = await commitsResponse.json() as Array<{
        sha: string;
        html_url: string;
        commit: { message: string; author: { name: string; date: string } | null };
      }>;
      activity = json.map(item => ({
        id: item.sha,
        message: item.commit.message.split("\n")[0],
        author: item.commit.author?.name || "Contributor",
        date: item.commit.author?.date || "",
        url: item.html_url
      }));
    }
  } catch {
    // The roadmap remains usable if GitHub's commits API is rate-limited.
  }
  return { project, voyage, activity, updatedAt: new Date().toISOString() };
}
