import test from "node:test";
import assert from "node:assert/strict";
import { parseRoadmap } from "../src/lib/roadmap.ts";
import { validateProject } from "../src/lib/github.ts";

test("parses phases and preserves task line references", () => {
  const content = [
    "# Trading system",
    "- [ ] Global item",
    "# Phase 0 — Foundation",
    "## Goal",
    "Make a foundation.",
    "## Work",
    "- [x] Set up repo <!-- task:T001 -->",
    "- [ ] Add a test",
    "# Phase 1 — Backtesting",
    "## Work",
    "- [ ] Run experiments"
  ].join("\n");
  const voyage = parseRoadmap(content);
  assert.equal(voyage.islands.length, 2);
  assert.equal(voyage.taskCount, 3);
  assert.equal(voyage.completedCount, 1);
  assert.equal(voyage.islands[0].tasks[0].id, "T001");
  assert.equal(voyage.islands[0].goal, "Make a foundation.");
  assert.equal(voyage.islands[1].name, "Backtesting");
});
test("ignores examples inside fenced code blocks", () => {
  const parsed = parseRoadmap("# Phase 2 — Demo\n```md\n- [x] fake\n```\n- [x] real");
  assert.equal(parsed.taskCount, 1);
  assert.equal(parsed.progress, 100);
});
test("validates public-repo selectors and prevents path traversal", () => {
  assert.equal(validateProject({repo: "jenozu/trade-alerts", path: "phases.md"}).repo, "jenozu/trade-alerts");
  assert.throws(() => validateProject({repo: "jenozu/trade-alerts", path: "../secrets.md"}));
  assert.throws(() => validateProject({repo: "https://example.com/x", path: "a.md"}));
});
