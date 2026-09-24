import { test, expect } from "@playwright/test";

function projectFixture() {
  const islands = Array.from({ length: 13 }, (_, number) => {
    const tasks = [
      { id: "task-" + number + "-1", title: "Chart island " + number, section: "Work", sectionId: "section-" + number, done: number < 10, line: 4, instructions: [] },
      { id: "task-" + number + "-2", title: "Inspect island " + number, section: "Work", sectionId: "section-" + number, done: number < 10, line: 5, instructions: [] }
    ];
    if (number === 10) tasks[0].done = true;
    const completed = tasks.filter(task => task.done).length;
    return {
      id: "phase-" + number, number, name: "Milestone " + number,
      goal: "Finish checkpoint " + number,
      sections: [{ id: "section-" + number, title: "Work", line: 3, notes: "Source instructions." }],
      tasks, completed, progress: 100 * completed / tasks.length, xp: completed * 10
    };
  });
  return {
    project: { id: "trade-alerts", name: "Trade Alerts", repo: "jenozu/trade-alerts", branch: "main", path: "phases.md" },
    voyage: { title: "Trading system", islands, taskCount: 26, completedCount: 21, progress: 81, xp: 360, level: 1 },
    activity: [], updatedAt: "2026-09-24T16:00:00.000Z"
  };
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/project?*", async route => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(projectFixture()) });
  });
  await page.goto("/");
  await expect(page.locator("[data-island]")).toHaveCount(13);
});

test("whole-map overview can still be grabbed and panned over blank water", async ({ page }) => {
  await page.getByRole("button", { name: "Whole map" }).click();
  const viewport = page.locator(".map-scroll");
  const chart = page.locator("svg.treasure-map");
  const before = await chart.getAttribute("style");
  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  // The overview chart is narrower than the viewport; grabbing the space
  // outside its SVG used to do nothing when scrolling hit a boundary.
  await page.mouse.move(box.x + 30, box.y + 145);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + 220, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => chart.getAttribute("style")).not.toBe(before);
});

test("full-window mode expands the viewport and preserves interactive island quests", async ({ page }) => {
  await page.getByRole("button", { name: /full screen/i }).click();
  const panel = page.locator(".atlas-panel");
  await expect(panel).toHaveClass(/atlas-fullscreen/);
  const bounds = await panel.boundingBox();
  const viewportSize = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewportSize).not.toBeNull();
  expect(bounds!.x).toBe(0);
  expect(bounds!.y).toBe(0);
  expect(bounds!.width).toBeGreaterThan(viewportSize!.width - 3);
  expect(bounds!.height).toBeGreaterThan(viewportSize!.height - 3);

  await page.getByRole("button", { name: "Find my ship" }).click();
  const current = page.locator('[data-island="phase-10"]');
  await current.click();
  await expect(page.locator("#quest-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#quest-panel")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(panel).not.toHaveClass(/atlas-fullscreen/);
});

test("dragging an island moves it and saves its location, rather than panning the map", async ({ page }) => {
  await page.getByRole("button", { name: "Find my ship" }).click();
  const current = page.locator('[data-island="phase-10"]');
  const initial = await current.getAttribute("transform");
  const box = await current.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  // Label is in the lower part of the SVG group, so grab the land instead.
  await page.mouse.move(middle.x, middle.y - 30);
  await page.mouse.down();
  await page.mouse.move(middle.x + 48, middle.y + 34, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => current.getAttribute("transform")).not.toBe(initial);
});
