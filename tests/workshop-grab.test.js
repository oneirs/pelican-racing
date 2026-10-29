import test from "node:test";
import assert from "node:assert/strict";
import { workshopGrab } from "../src/animation/workshop-grab.js";

test("grip precedes lift, with a continuous transfer and a gentle landing", () => {
  assert.deepEqual(workshopGrab(0), { grip: 0, lift: 0, turn: 0, transfer: 0 });
  assert.equal(workshopGrab(0.2).lift, 0);
  assert.equal(workshopGrab(0.25).grip, 1);
  assert.equal(workshopGrab(0.25).turn, 0);
  assert(workshopGrab(0.55).lift > 0.6);
  const end = workshopGrab(1);
  assert.equal(end.grip, 1);
  assert.equal(end.turn, 1);
  assert.equal(end.transfer, 1);
  assert.equal(end.lift, 0);
  let previous = workshopGrab(0);
  for (let i = 1; i <= 1000; i++) {
    const next = workshopGrab(i / 1000);
    for (const key of Object.keys(next)) {
      assert(Number.isFinite(next[key]));
      assert(Math.abs(next[key] - previous[key]) < 0.007, `${key} snapped`);
    }
    previous = next;
  }
});
