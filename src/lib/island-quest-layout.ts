import type { Point } from "./map-layout.ts";

export type Checkpoint = Point & { index: number };

// Deterministic serpentine trail. A compact 4-column route keeps large
// milestones readable without becoming another long vertical checklist.
export function checkpointLayout(count: number): { width: number; height: number; points: Checkpoint[] } {
  if (!Number.isSafeInteger(count) || count < 0 || count > 500) throw new RangeError("Expected 0–500 tasks.");
  const columns = count <= 8 ? 3 : 4;
  const rows = Math.max(1, Math.ceil(Math.max(1, count) / columns));
  const width = 1040;
  const height = Math.max(620, 250 + rows * 150);
  const usableWidth = 760;
  const left = 140;
  const top = 160;
  const points: Checkpoint[] = [];
  for (let index = 0; index < count; index++) {
    const row = Math.floor(index / columns);
    const step = index % columns;
    const column = row % 2 === 0 ? step : columns - 1 - step;
    const x = left + (columns === 1 ? usableWidth / 2 : column * (usableWidth / (columns - 1)));
    const y = top + row * 150 + Math.sin(index * 1.7) * 28;
    points.push({ index, x: Math.round(x), y: Math.round(y) });
  }
  return { width, height, points };
}

export function currentTaskIndex(done: boolean[]): number {
  const open = done.findIndex(value => !value);
  return open === -1 ? Math.max(0, done.length - 1) : open;
}
