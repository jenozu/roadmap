import { validateProject, type Project } from "./github.ts";

export const fleetStorageKey = "voyages:projects:v1";

export function canonicalRepo(repo: string): string {
  return repo.trim().toLowerCase();
}

export function readFleet(saved: string | null, starter: Project): Project[] {
  if (saved === null) return [starter];
  try {
    const value: unknown = JSON.parse(saved);
    if (!Array.isArray(value)) return [starter];
    const found = new Map<string, Project>();
    for (const candidate of value) {
      if (!candidate || typeof candidate !== "object") continue;
      try {
        const c = candidate as Project;
        const valid = validateProject(c);
        if (typeof c.name === "string" && c.name.trim()) valid.name = c.name.trim().slice(0, 80);
        found.set(canonicalRepo(valid.repo), valid);
      } catch { /* Ignore invalid imported or outdated entries. */ }
    }
    // An explicit empty array represents a user who intentionally removed
    // every voyage; never silently restore the starter project.
    return [...found.values()];
  } catch {
    return [starter];
  }
}

export function saveVoyage(
  projects: Project[],
  input: Partial<Project>,
  editingId: string | null
): { projects: Project[]; activeId: string } {
  const validated = validateProject(input);
  const existing = editingId ? projects.find(p => p.id === editingId) : undefined;
  if (editingId && !existing) throw new Error("The voyage being edited no longer exists.");
  const duplicate = projects.some(p => p.id !== editingId && canonicalRepo(p.repo) === canonicalRepo(validated.repo));
  if (duplicate) throw new Error("This repository is already in your fleet. Edit its existing voyage instead.");
  const next = existing
    ? projects.map(p => p.id === editingId ? validated : p)
    : [...projects, validated];
  return { projects: next, activeId: validated.id };
}

export function removeVoyage(
  projects: Project[], targetId: string, activeId: string
): { projects: Project[]; activeId: string } {
  const next = projects.filter(p => p.id !== targetId);
  return {
    projects: next,
    activeId: targetId === activeId ? (next[0]?.id || "") : activeId
  };
}
