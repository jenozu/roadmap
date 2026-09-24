export type Point = { x: number; y: number };
export type Archipelago = { width: number; height: number; points: Point[] };

// Four columns and alternating travel directions turn a linear checklist into
// a two-dimensional island voyage. Jitter is deterministic, preserving the
// same chart across refreshes; manually dragged islands remain user-controlled.
export function layoutForCount(count: number): Archipelago {
  if (!Number.isSafeInteger(count) || count < 0 || count > 500) {
    throw new RangeError("Expected 0–500 project milestones.");
  }
  const columns = Math.min(4, Math.max(1, count));
  const rows = Math.max(1, Math.ceil(count / columns));
  const width = Math.max(950, (columns - 1) * 455 + 590);
  const height = Math.max(760, (rows - 1) * 390 + 600);
  const points: Point[] = [];
  for (let index = 0; index < count; index++) {
    const row = Math.floor(index / columns);
    const step = index % columns;
    // On short final rows, stay near the preceding island instead of
    // teleporting to the other side of the ocean.
    const column = row % 2 === 0 ? step : columns - 1 - step;
    const driftX = Math.round(Math.sin(index * 2.17 + .6) * 43);
    const driftY = Math.round(Math.cos(index * 1.73 + .2) * 69);
    points.push({
      x: 275 + column * 455 + driftX,
      y: 290 + row * 390 + driftY
    });
  }
  return { width, height, points };
}

export function fitMapScale(
  viewportWidth: number, viewportHeight: number, mapWidth: number, mapHeight: number
): number {
  if ([viewportWidth, viewportHeight, mapWidth, mapHeight].some(value => !Number.isFinite(value) || value <= 0)) {
    return .55;
  }
  return Math.max(.24, Math.min(1.1, (viewportWidth - 28) / mapWidth, (viewportHeight - 28) / mapHeight));
}

export function clampIsland(point: Point, width: number, height: number): Point {
  return {
    x: Math.max(120, Math.min(width - 120, point.x)),
    y: Math.max(135, Math.min(height - 145, point.y))
  };
}
