// Screen-space camera for the SVG nautical chart. Unlike scrollLeft/scrollTop,
// translation works even when the entire chart is smaller than its viewport.
export type Point = { x: number; y: number };
export type Camera = Point;
export type Viewport = { width: number; height: number };

export function centerAt(world: Point, viewport: Viewport, scale: number): Camera {
  return {
    x: viewport.width / 2 - world.x * scale,
    y: viewport.height / 2 - world.y * scale
  };
}

export function visibleCenter(camera: Camera, viewport: Viewport, scale: number): Point {
  return {
    x: (viewport.width / 2 - camera.x) / scale,
    y: (viewport.height / 2 - camera.y) / scale
  };
}

export function fitCamera(
  viewport: Viewport,
  world: Viewport,
  minScale = .24,
  maxScale = 1.1
): { camera: Camera; scale: number } {
  const scale = Math.min(
    maxScale,
    Math.max(minScale, Math.min((viewport.width - 36) / world.width, (viewport.height - 36) / world.height))
  );
  return {
    scale,
    camera: centerAt({ x: world.width / 2, y: world.height / 2 }, viewport, scale)
  };
}

// Keep the point below the cursor (or viewport center) fixed when zooming.
export function zoomAround(
  camera: Camera,
  oldScale: number,
  newScale: number,
  anchor: Point
): Camera {
  const worldPoint = {
    x: (anchor.x - camera.x) / oldScale,
    y: (anchor.y - camera.y) / oldScale
  };
  return {
    x: anchor.x - worldPoint.x * newScale,
    y: anchor.y - worldPoint.y * newScale
  };
}

export function panCamera(camera: Camera, dx: number, dy: number): Camera {
  return { x: camera.x + dx, y: camera.y + dy };
}

// The initial view is intentionally closer than Whole Map: the player should
// see an island at legible size, then freely explore or press Whole Map.
export function openingScale(viewport: Viewport, world: Viewport): number {
  return Math.max(.62, Math.min(.92, (viewport.width - 54) / world.width));
}
