import test from "node:test";
import assert from "node:assert/strict";
import { clampIsland, fitMapScale, layoutForCount } from "../src/lib/map-layout.ts";

test("thirteen project milestones use a multi-row archipelago", () => {
  const chart = layoutForCount(13);
  assert.equal(chart.points.length, 13);
  assert.ok(chart.height > 1300, "the chart should have vertical space");
  assert.ok(chart.width > 1700, "the chart should have horizontal space");
  const xs = chart.points.map(point => point.x);
  const ys = chart.points.map(point => point.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 1000);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 1250);
  assert.ok(chart.points[4].x > chart.points[5].x, "the route reverses across its second row");
  for (const point of chart.points) {
    assert.ok(point.x >= 120 && point.x <= chart.width - 120);
    assert.ok(point.y >= 135 && point.y <= chart.height - 145);
  }
});
test("archipelago positions are deterministic, spaced apart and extensible", () => {
  for (const count of [1,2,4,7,13,21,40,100]) {
    const chart = layoutForCount(count);
    assert.deepEqual(chart, layoutForCount(count));
    for (let i=0;i<chart.points.length;i++) {
      for (let j=i+1;j<chart.points.length;j++) {
        const dx=chart.points[i].x-chart.points[j].x;
        const dy=chart.points[i].y-chart.points[j].y;
        assert.ok(Math.hypot(dx,dy) > 240, "islands must not overlap");
      }
    }
  }
  assert.throws(() => layoutForCount(-1));
});
test("fit-to-chart and island drag boundaries are safe", () => {
  const chart=layoutForCount(13);
  const fit=fitMapScale(900,620,chart.width,chart.height);
  assert.ok(fit > .25 && fit < .5);
  assert.deepEqual(clampIsland({x:-9,y:99999},chart.width,chart.height),{x:120,y:chart.height-145});
  assert.equal(fitMapScale(0,0,0,0),.55);
});
