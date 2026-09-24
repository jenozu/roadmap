import test from "node:test";
import assert from "node:assert/strict";
import { centerAt, fitCamera, visibleCenter, zoomAround, panCamera, openingScale } from "../src/lib/map-camera.ts";

const viewport={width:1280,height:620}, world={width:1955,height:1770};

test("pan works even in overview when the chart fits completely", () => {
  const overview=fitCamera(viewport,world);
  const panned=panCamera(overview.camera,125,-91);
  assert.deepEqual(panned,{x:overview.camera.x+125,y:overview.camera.y-91});
  assert.notDeepEqual(visibleCenter(panned,viewport,overview.scale),visibleCenter(overview.camera,viewport,overview.scale));
});
test("overview centers the entire chart at its calculated scale", () => {
  const overview=fitCamera(viewport,world);
  assert.ok(overview.scale<.5);
  const visible=visibleCenter(overview.camera,viewport,overview.scale);
  assert.ok(Math.abs(visible.x-world.width/2)<.00001);
  assert.ok(Math.abs(visible.y-world.height/2)<.00001);
});
test("zoom keeps the screen point beneath the pointer unchanged", () => {
  const camera={x:-200,y:-105},anchor={x:450,y:330};
  const before={x:(anchor.x-camera.x)/.65,y:(anchor.y-camera.y)/.65};
  const after=zoomAround(camera,.65,1.2,anchor);
  assert.ok(Math.abs((anchor.x-after.x)/1.2-before.x)<1e-6);
  assert.ok(Math.abs((anchor.y-after.y)/1.2-before.y)<1e-6);
});
test("fullscreen viewport resizing preserves the world center", () => {
  const point={x:500,y:940};
  const camera=centerAt(point,viewport,.85);
  const fullViewport={width:1920,height:1080};
  const fullCamera=centerAt(visibleCenter(camera,viewport,.85),fullViewport,.85);
  assert.deepEqual(visibleCenter(fullCamera,fullViewport,.85),point);
});
test("opening scale has a readable lower bound even with large maps", () => {
  assert.ok(openingScale(viewport,world)>=.62);
  assert.ok(openingScale({width:2000,height:900},world)<=.92);
});
