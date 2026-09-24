import test from "node:test";
import assert from "node:assert/strict";
import { parseRoadmap } from "../src/lib/roadmap.ts";
import { captureProgress, diffProgress } from "../src/lib/progress-diff.ts";

test("detects genuine checklist changes without treating reordered lines as new tasks", () => {
  const before=captureProgress(parseRoadmap("# Phase 3 — Build\n## Main\n- [x] Existing\n- [ ] Implement feature\n- [ ] Test feature"),"2026-01-01");
  const after=captureProgress(parseRoadmap("# Phase 3 — Build\n## Main\nExtra prose before tasks\n- [x] Existing\n- [x] Implement feature\n- [ ] Test feature"),"2026-01-02");
  const diff=diffProgress(before,after);
  assert.equal(diff.length,1);
  assert.equal(diff[0].title,"Implement feature");
  assert.equal(diff[0].kind,"completed");
  assert.equal(diff[0].detectedAt,"2026-01-02");
});
test("detects reopened tasks but does not assume newly added prechecked tasks were completed in-session", () => {
  const first=captureProgress(parseRoadmap("# Phase 1 — QA\n- [x] Audit"),"now");
  const second=captureProgress(parseRoadmap("# Phase 1 — QA\n- [ ] Audit\n- [x] New item"),"later");
  const diff=diffProgress(first,second);
  assert.equal(diff.length,1);
  assert.equal(diff[0].kind,"reopened");
});
test("duplicate task labels are individually traceable with explicit IDs", () => {
  const voyage=parseRoadmap("# Phase 1 — QA\n- [ ] Repeat\n- [x] Repeat\n- [ ] Unique <!-- task:unique -->");
  const state=captureProgress(voyage);
  assert.equal(new Set(state.rows.map(row=>row.key)).size,3);
  assert.match(state.rows[2].key,/id:unique/);
});
