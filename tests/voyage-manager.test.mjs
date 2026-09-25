import test from "node:test";
import assert from "node:assert/strict";
import { firstProject } from "../src/lib/github.ts";
import { readFleet, removeVoyage, saveVoyage } from "../src/lib/voyage-manager.ts";

const twin={repo:"jenozu/twin-disc",branch:"main",path:"master_plan.md",name:"Twin Disc"};
test("first visit has a starter voyage but deliberately emptied storage stays empty",() => {
  assert.deepEqual(readFleet(null,firstProject),[firstProject]);
  assert.deepEqual(readFleet("[]",firstProject),[]);
  assert.deepEqual(readFleet("not-json",firstProject),[firstProject]);
});
test("save adds and edits voyage without creating duplicates",() => {
  const initial=saveVoyage([firstProject],twin,null);
  assert.equal(initial.projects.length,2);
  const edited=saveVoyage(initial.projects,{...twin,path:"roadmap.md",name:"Updated Twin Disc"},initial.activeId);
  assert.equal(edited.projects.length,2);
  assert.equal(edited.projects[1].path,"roadmap.md");
  assert.equal(edited.projects[1].name,"Updated Twin Disc");
  assert.throws(()=>saveVoyage(edited.projects,{...twin,repo:"JENOZU/TRADE-ALERTS"},null),/already in your fleet/);
  assert.throws(()=>saveVoyage(initial.projects,{...twin,path:"../secret.md"},initial.activeId));
});
test("repository corrections change the active ID and never overwrite another voyage",() => {
  const initial=saveVoyage([firstProject],twin,null);
  const fixed=saveVoyage(initial.projects,{...twin,repo:"jenozu/twindisc"},initial.activeId);
  assert.equal(fixed.projects.length,2);
  assert.equal(fixed.activeId,"jenozu-twindisc");
  assert.ok(fixed.projects.some(p=>p.repo==="jenozu/twindisc"));
});
test("removal chooses surviving voyage, including the starter; all can be removed",() => {
  const initial=saveVoyage([firstProject],twin,null);
  const after=removeVoyage(initial.projects,initial.activeId,initial.activeId);
  assert.equal(after.activeId,firstProject.id);
  const empty=removeVoyage(after.projects,firstProject.id,firstProject.id);
  assert.deepEqual(empty,{projects:[],activeId:""});
  assert.deepEqual(readFleet(JSON.stringify(empty.projects),firstProject),[]);
});
