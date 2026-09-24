import test from "node:test";
import assert from "node:assert/strict";
import { resolveRoadmapHref } from "../src/lib/roadmap-links.ts";
const project={repo:"jenozu/trade-alerts",branch:"main",path:"docs/master_list.md"};

test("links referenced documents back to the source repository", () => {
  assert.equal(
    resolveRoadmapHref(project,"../phases.md#L50"),
    "https://github.com/jenozu/trade-alerts/blob/main/phases.md#L50"
  );
  assert.equal(
    resolveRoadmapHref(project,"details/test.md"),
    "https://github.com/jenozu/trade-alerts/blob/main/docs/details/test.md"
  );
  assert.equal(
    resolveRoadmapHref(project,"#local-heading"),
    "https://github.com/jenozu/trade-alerts/blob/main/docs/master_list.md#local-heading"
  );
  assert.equal(resolveRoadmapHref(project,"https://example.com/help"),"https://example.com/help");
});
test("rejects active content and paths escaping the repository", () => {
  assert.equal(resolveRoadmapHref(project,"javascript:alert(1)"),undefined);
  assert.equal(resolveRoadmapHref(project,"data:text/html,hi"),undefined);
  assert.equal(resolveRoadmapHref(project,"//attacker.example"),undefined);
  assert.equal(resolveRoadmapHref(project,"../../../../etc/secrets.md"),undefined);
  assert.equal(resolveRoadmapHref(project,"%2f%2fevil.md"),undefined);
});
