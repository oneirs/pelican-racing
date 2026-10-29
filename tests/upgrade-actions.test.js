import test from "node:test";
import assert from "node:assert/strict";
import { requiresSurgery, hasBodyChanges } from "../src/game/upgrade-actions.js";

test("only legs, beak and wings require surgery; helmet and bicycle swap directly", () => {
  for (const slot of ["thighs", "beak", "wings"]) assert(requiresSurgery(slot));
  for (const slot of ["head", "frame", "tires", "drive", "rocket", "handlebar", "weapon"]) assert(!requiresSurgery(slot));
  const original = { thighs: "agile", head: "aero", frame: "light" };
  assert(!hasBodyChanges(original, { ...original, head: "standard", frame: "standard" }));
  assert(hasBodyChanges(original, { ...original, thighs: "standard" }));
  assert(!hasBodyChanges(original, original));
});
