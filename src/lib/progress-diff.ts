import type { Voyage } from "./roadmap.ts";

export type ProgressRow = {
  key: string;
  title: string;
  phase: string;
  done: boolean;
  line: number;
};
export type ProgressState = { recordedAt: string; rows: ProgressRow[] };
export type ProgressChange = ProgressRow & {
  kind: "completed" | "reopened";
  detectedAt: string;
};

// Most older roadmaps have no permanent task IDs. Use the phase, heading and
// normalized title, with an occurrence suffix for duplicates, instead of
// unstable source line numbers. Explicit IDs take precedence when available.
export function captureProgress(voyage: Voyage, recordedAt = new Date().toISOString()): ProgressState {
  const rows: ProgressRow[] = [];
  for (const island of voyage.islands) {
    const seen = new Map<string, number>();
    for (const task of island.tasks) {
      const normalizedTitle = task.title.replace(/\s+/g, " ").trim().toLowerCase();
      const normalizedSection = task.section.replace(/\s+/g, " ").trim().toLowerCase();
      const explicit = /-line-\d+$/.test(task.id) ? "" : task.id;
      const base = explicit
        ? island.id + "|id:" + explicit
        : island.id + "|" + normalizedSection + "|" + normalizedTitle;
      const occurrence = (seen.get(base) || 0) + 1;
      seen.set(base, occurrence);
      rows.push({
        key: base + "|" + occurrence,
        title: task.title,
        phase: island.name,
        done: task.done,
        line: task.line
      });
    }
  }
  return { recordedAt, rows };
}

export function diffProgress(before: ProgressState, after: ProgressState): ProgressChange[] {
  const existing = new Map(before.rows.map(row => [row.key, row.done]));
  const changes: ProgressChange[] = [];
  for (const item of after.rows) {
    const prior = existing.get(item.key);
    // A newly added checkbox isn't automatically counted as completed.
    if (prior === undefined || prior === item.done) continue;
    changes.push({
      ...item,
      kind: item.done ? "completed" : "reopened",
      detectedAt: after.recordedAt
    });
  }
  return changes;
}
