export type Project = { id: string; name: string; repo: string; branch: string; path: string };
export type CommitActivity = { id: string; message: string; author: string; date: string; url: string };
export type RepositoryVisibility = "public" | "private";
export type ProjectSnapshot = {
  project: Project;
  voyage: import("./roadmap.ts").Voyage;
  activity: CommitActivity[];
  updatedAt: string;
  repositoryVisibility: RepositoryVisibility;
};

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
      branch.startsWith("/") || path.startsWith("/") ||
      repo.includes("..") || repo.startsWith("/") ||
      /\/\//.test(branch) || /\/\//.test(path)) {
    throw new Error("Enter a valid GitHub owner/repo, branch and Markdown file path.");
  }
  return {
    id: repo.toLowerCase().replace(/[^a-z\d-]+/g, "-"),
    name: (input.name || repo.split("/")[1]).slice(0, 80),
    repo, branch, path
  };
}
