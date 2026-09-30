import test from "node:test";
import assert from "node:assert/strict";
import { checkpointLayout, currentTaskIndex } from "../src/lib/island-quest-layout.ts";

test("checkpoint trail is deterministic and serpentine for larger islands", () => {
  const chart=checkpointLayout(18);
  assert.equal(chart.points.length,18);
  assert.ok(chart.height>700);
  assert.deepEqual(chart,checkpointLayout(18));
  assert.ok(chart.points[0].x < chart.points[3].x);
  assert.ok(chart.points[4].x > chart.points[7].x);
});
test("current task is the first incomplete checkpoint", () => {
  assert.equal(currentTaskIndex([true,true,false,false]),2);
  assert.equal(currentTaskIndex([false,false]),0);
  assert.equal(currentTaskIndex([true,true]),1);
});

test("large task sets keep every checkpoint inside the expandable island bounds", () => {
  for (const count of [12, 24, 40, 80]) {
    const chart=checkpointLayout(count);
    for (const point of chart.points) {
      assert.ok(point.x >= 120 && point.x <= chart.width - 120);
      assert.ok(point.y >= 120 && point.y <= chart.height - 180);
    }
    assert.ok(chart.height >= 620);
  }
});
