import test from "node:test";
import assert from "node:assert/strict";
import { bindControls } from "../src/ui/controls.js";

test("race shortcuts restart, change route, brake and bound speed without bottom buttons", () => {
  const oldDoc = globalThis.document, oldAdd = globalThis.addEventListener;
  const elements = new Map(), resets = [];
  let keydown;
  globalThis.document = { getElementById: id => {
    if (!elements.has(id)) elements.set(id, { textContent: "" });
    return elements.get(id);
  }};
  globalThis.addEventListener = (name, handler) => { if (name === "keydown") keydown = handler; };
  const state = { screen: "race", running: true, targetKmh: 220, tuning: { maxSpeedKmh: 220 }, brakeLatched: false };
  const press = (code, extra = {}) => keydown({ code, target: { tagName: "CANVAS" }, preventDefault() {}, ...extra });
  try {
    const controls = bindControls(state, newRoute => resets.push(newRoute));
    press("KeyE"); assert(state.fireRequested); state.fireRequested = false;
    state.beakEquipped = true;
    press("KeyE"); assert.equal(state.beakAttackRequested, 1); assert(!state.fireRequested);
    state.beakAttackRequested = 0;
    press("KeyQ", { repeat: true }); assert.equal(state.beakAttackRequested, 0);
    press("KeyQ"); assert.equal(state.beakAttackRequested, -1);
    state.beakAttackRequested = 0;
    state.running = false; press("KeyE"); press("KeyQ"); assert.equal(state.beakAttackRequested, 0);
    state.running = true; state.crashed = true;
    press("KeyE"); press("KeyQ"); assert.equal(state.beakAttackRequested, 0);
    state.crashed = false; state.beakEquipped = false;
    press("KeyQ"); assert.equal(state.beakAttackRequested, 0);
    state.running = false; press("KeyE"); assert(!state.fireRequested); state.running = true;
    press("KeyF"); assert(state.brakeLatched);
    press("KeyF", { repeat: true }); assert(state.brakeLatched);
    press("KeyF"); assert(!state.brakeLatched);
    press("KeyR"); press("KeyN"); assert.deepEqual(resets, [false, true]);
    press("KeyR", { ctrlKey: true }); press("KeyR", { target: { tagName: "INPUT" } });
    assert.equal(resets.length, 2);
    press("Equal"); assert.equal(state.targetKmh, 220);
    press("Minus"); assert.equal(state.targetKmh, 210);
    for (let i = 0; i < 30; i++) press("Minus");
    assert.equal(state.targetKmh, 20);
    controls.pause(); assert(!state.running);
    assert(elements.get("ride-status").textContent.includes("暂停"));
    state.screen = "menu"; press("KeyR"); assert.equal(resets.length, 2);
  } finally { globalThis.document = oldDoc; globalThis.addEventListener = oldAdd; }
});
