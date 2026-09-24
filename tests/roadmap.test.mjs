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
test("ignores examples inside fenced code blocks while retaining source notes", () => {
  const parsed = parseRoadmap("# Phase 2 — Demo\n## Steps\n~~~md\n- [x] fake\n~~~\n- [x] real");
  assert.equal(parsed.taskCount, 1);
  assert.equal(parsed.progress, 100);
  assert.match(parsed.islands[0].sections[1].notes, /- \[x\] fake/);
});
test("retains section guidance, embedded code, and phase verification without inventing individual steps", () => {
  const parsed = parseRoadmap([
    "# Phase 10 — VPS",
    "## Goal",
    "Run workflow reliably.",
    "## VPS scheduling",
    "Check timezone before enabling timers.",
    "~~~bash",
    "timedatectl",
    "~~~",
    "- [ ] Check timedatectl.",
    "- [ ] Verify jobs survive reboot.",
    "## Done when",
    "- [ ] Services survive restart."
  ].join("\n"));
  const island = parsed.islands[0];
  const guide = island.sections.find(section => section.title === "VPS scheduling");
  assert.ok(guide);
  assert.match(guide.notes, /Check timezone/);
  assert.match(guide.notes, /timedatectl/);
  assert.equal(island.tasks[0].sectionId, guide.id);
  assert.deepEqual(island.tasks[0].instructions, []);
  assert.equal(island.tasks.filter(task => task.section === "Done when").length, 1);
});
test("captures explicit indented steps beneath a single task", () => {
  const parsed = parseRoadmap([
    "# Phase 1 — Build",
    "## Implementation",
    "- [ ] Build webhooks <!-- task:T100 -->",
    "  - Verify HMAC signatures",
    "  - Reject duplicate deliveries",
    "- [ ] Add tests"
  ].join("\n"));
  const first = parsed.islands[0].tasks[0];
  assert.equal(first.id, "T100");
  assert.deepEqual(first.instructions, ["  - Verify HMAC signatures", "  - Reject duplicate deliveries"]);
  assert.equal(parsed.taskCount, 2);
});
test("validates public-repo selectors and prevents path traversal", () => {
  assert.equal(validateProject({repo: "jenozu/trade-alerts", path: "phases.md"}).repo, "jenozu/trade-alerts");
  assert.throws(() => validateProject({repo: "jenozu/trade-alerts", path: "../secrets.md"}));
  assert.throws(() => validateProject({repo: "https://example.com/x", path: "a.md"}));
});
