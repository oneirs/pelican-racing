import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorkshopSequence,
  WORKSHOP_PHASES,
} from "../src/animation/workshop-sequence.js";

test("workshop keeps equipment unchanged until the curtain opens and commits exactly once", () => {
  const phases = [];
  let commits = 0,
    finishes = 0;
  const sequence = createWorkshopSequence({
    onPhase: (p) => phases.push(p),
    onCommit: () => commits++,
    onFinish: () => finishes++,
  });
  assert(sequence.start());
  assert(!sequence.start(), "must reject repeated equip while busy");
  const openAt = WORKSHOP_PHASES.slice(
    0,
    WORKSHOP_PHASES.findIndex((p) => p[0] === "open"),
  ).reduce((sum, p) => sum + p[1], 0);
  sequence.update(openAt - 0.1);
  assert.equal(commits, 0);
  assert.equal(sequence.state.phase, "work");
  const frozen = sequence.state;
  sequence.update(0);
  assert.deepEqual(sequence.state, frozen);
  sequence.update(0.11);
  assert.equal(commits, 1);
  assert.equal(sequence.state.phase, "open");
  sequence.update(3);
  assert.equal(sequence.state.busy, false);
  assert.equal(commits, 1);
  assert.equal(finishes, 1);
  assert.deepEqual(
    phases,
    WORKSHOP_PHASES.map((p) => p[0]),
  );
});
test("skip from every stage commits the pending equipment once and unlocks the menu", () => {
  for (let phase = 0; phase < WORKSHOP_PHASES.length; phase++) {
    let commits = 0,
      finishes = 0;
    const s = createWorkshopSequence({
      onCommit: () => commits++,
      onFinish: () => finishes++,
    });
    s.start();
    s.update(
      WORKSHOP_PHASES.slice(0, phase).reduce((a, p) => a + p[1], 0) + 0.05,
    );
    s.skip();
    s.skip();
    s.update(10);
    assert.equal(commits, 1);
    assert.equal(finishes, 1);
    assert(!s.state.busy);
    assert(s.start());
    s.skip();
    assert.equal(commits, 2);
    assert.equal(finishes, 2);
  }
});


test("the complete operation runs in 5.6 seconds at double the original speed", () => {
  const duration = WORKSHOP_PHASES.reduce((sum, phase) => sum + phase[1], 0);
  assert(Math.abs(duration - 5.6) < 1e-9);
  const s = createWorkshopSequence();
  s.start();
  s.update(5.59);
  assert(s.state.busy);
  s.update(0.02);
  assert(!s.state.busy);
});
