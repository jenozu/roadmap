export type SourceLinkProject = { repo: string; branch: string; path: string };

// Relative Markdown references belong to the source GitHub repository,
// not the Vercel dashboard's origin. Never turn active / data: links into
// navigable URLs supplied by imported Markdown.
export function resolveRoadmapHref(project: SourceLinkProject, href?: string): string | undefined {
  const raw = href?.trim();
  if (!raw || /[\u0000-\u001f]/.test(raw)) return undefined;
  if (/^(https?:\/\/|mailto:)/i.test(raw)) return raw;
  if (/^[a-z][a-z\d+.-]*:/i.test(raw) || raw.startsWith("//") || raw.includes("\\")) return undefined;

  const hashIndex = raw.indexOf("#");
  const pathPart = (hashIndex < 0 ? raw : raw.slice(0, hashIndex)).split("?")[0];
  const fragment = hashIndex < 0 ? "" : raw.slice(hashIndex);
  const prefix = ["https://github.com", project.repo, "blob", encodeURIComponent(project.branch)].join("/");
  if (!pathPart) {
    return prefix + "/" + project.path.split("/").map(encodeURIComponent).join("/") + fragment;
  }
  const parts = pathPart.startsWith("/") ? [] : project.path.split("/").slice(0, -1);
  for (const rawPiece of pathPart.split("/")) {
    let piece: string;
    try { piece = decodeURIComponent(rawPiece); } catch { return undefined; }
    if (!piece || piece === ".") continue;
    if (piece === "..") {
      if (!parts.length) return undefined;
      parts.pop();
      continue;
    }
    if (piece.includes("/") || piece.includes("\\") || piece === ".git") return undefined;
    parts.push(piece);
  }
  if (!parts.length) return undefined;
  return prefix + "/" + parts.map(encodeURIComponent).join("/") + fragment;
}
