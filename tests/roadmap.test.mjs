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

test("supports standardized milestone and nested M1.1 headings", () => {
  const parsed = parseRoadmap([
    "# Voyages",
    "## M1: Project foundation",
    "## Goal",
    "Create working import.",
    "- [x] Initial docs",
    "## M1.1: Source improvements",
    "- [ ] Test importer",
    "## M2 — Deployment",
    "- [ ] Deploy",
  ].join("\n"));
  assert.equal(parsed.islands.length, 3);
  assert.deepEqual(parsed.islands.map(island => island.number), [1, 1.1, 2]);
  assert.equal(parsed.taskCount, 3);
  assert.equal(parsed.islands[0].goal, "Create working import.");
});

test("explicit Progress statuses complete no-checklist phases and make ACTIVE the current semantic phase", () => {
  const parsed = parseRoadmap([
    "# Hybrid project",
    "## Phase 0 — Setup",
    "- [ ] Confirm terms",
    "## Phase 1 — Data",
    "- [x] Extract",
    "- [x] Validate",
    "## Phase 2 — Research",
    "Progress: COMPLETE for the initial batch.",
    "Deliverable: research database.",
    "## Phase 3 — Relationships",
    "Status: DONE.",
    "## Phase 4 — Product database",
    "Progress: ACTIVE.",
    "Drafting remains.",
    "## Phase 5 — Website",
    "Required: storefront.",
  ].join("\n"));
  assert.equal(parsed.islands.length, 6);
  assert.equal(parsed.islands[2].declaredStatus, "complete");
  assert.equal(parsed.islands[2].progress, 100);
  assert.equal(parsed.islands[3].progress, 100);
  assert.equal(parsed.islands[4].declaredStatus, "active");
  assert.equal(parsed.islands[4].progress, 0);
  assert.equal(parsed.taskCount, 3);
  assert.equal(parsed.completedCount, 2);
  assert.equal(parsed.progress, 42);
});

test("same-level global completion sections do not leak checkboxes into the final milestone", () => {
  const parsed = parseRoadmap([
    "# Product plan",
    "## M1: Foundation",
    "### Implementation",
    "- [x] Build foundation",
    "## M2: Launch",
    "### Implementation",
    "- [ ] Launch site",
    "## Completion standard",
    "- [x] Foundation exists",
    "- [x] Documentation exists",
  ].join("\n"));
  assert.equal(parsed.islands.length, 2);
  assert.equal(parsed.taskCount, 4);
  assert.equal(parsed.completedCount, 3);
  assert.equal(parsed.islands[1].tasks.length, 1);
  assert.equal(parsed.islands[1].tasks[0].title, "Launch site");
  assert.equal(parsed.globalTasks.length, 2);
  assert.deepEqual(parsed.globalTasks.map(task => task.title), ["Foundation exists", "Documentation exists"]);
});

test("top-level checklist roadmaps retain task-weighted overall progress", () => {
  const parsed = parseRoadmap([
    "# Checklist project",
    "# Phase 0 — Large phase",
    "- [x] A",
    "- [x] B",
    "- [x] C",
    "# Phase 1 — Small phase",
    "- [ ] D",
  ].join("\n"));
  assert.equal(parsed.progress, 75);
});

test("project-wide post-milestone checklists preserve aggregate progress without becoming an island", () => {
  const parsed = parseRoadmap([
    "# Trading plan",
    "# Phase 0 — Build",
    "- [x] Core",
    "- [ ] Validation",
    "# Production readiness checklist",
    "- [x] Logging",
    "- [ ] Monitoring",
    "# Current next action",
    "Finish validation."
  ].join("\n"));
  assert.equal(parsed.islands.length, 1);
  assert.equal(parsed.islands[0].tasks.length, 2);
  assert.equal(parsed.globalTasks.length, 2);
  assert.equal(parsed.taskCount, 4);
  assert.equal(parsed.completedCount, 2);
  assert.equal(parsed.progress, 50);
});
