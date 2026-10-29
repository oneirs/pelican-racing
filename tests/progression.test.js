import test from "node:test";
import assert from "node:assert/strict";
import { createProgression, itemPrice } from "../src/game/progression.js";

const memory = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

test("completion grants points once; buying requires enough points and persists", () => {
  const storage = memory(), profile = createProgression(storage);
  assert.equal(profile.points, 0);
  assert.equal(profile.unlock("weapon", "launcher"), false);
  assert.equal(profile.completeRace("race-1", 1), 120);
  assert.equal(profile.completeRace("race-1", 1), 0);
  assert.equal(profile.unlock("weapon", "launcher"), true);
  assert.equal(profile.points, 20);
  assert.equal(profile.unlock("weapon", "launcher"), true);
  assert.equal(profile.points, 20);
  const restored = createProgression(storage);
  assert.equal(restored.points, 20);
  assert(restored.owns("weapon", "launcher"));
  assert(!restored.owns("weapon", "gatling"));
});

test("existing equipped purchases remain available and default items remain free", () => {
  const storage = memory(), profile = createProgression(storage, { rocket: "boost", weapon: "gatling" });
  assert(profile.owns("rocket", "boost"));
  assert(profile.owns("weapon", "gatling"));
  assert(profile.owns("frame", "reinforced"));
  assert(profile.owns("weapon", "standard"));
  assert.equal(profile.unlock("weapon", "fake"), false);
  assert.equal(itemPrice("weapon", "fake"), null);
  assert(createProgression(storage).owns("rocket", "boost"));
});

test("competition rewards only on finishing 5 km, and never awards training or duplicate results", async () => {
  const { finishRaceIfNeeded } = await import("../src/game/race-progress.js");
  const profile = createProgression(memory());
  const state = { running: true, training: false, distance: 4999, raceId: "one", progression: profile, rival: { distance: 4500 } };
  assert.equal(finishRaceIfNeeded(state), false);
  assert.equal(profile.points, 0);
  state.distance = 5000;
  assert.equal(finishRaceIfNeeded(state), true);
  assert.equal(state.running, false);
  assert.equal(state.raceResult, "比赛完成 · 第 1 名 · +120 积分");
  assert.equal(finishRaceIfNeeded(state), false);
  assert.equal(profile.points, 120);
  Object.assign(state, { running: true, raceFinished: false, raceId: "two", rival: { distance: 5200 } });
  assert.equal(finishRaceIfNeeded(state), true);
  assert.equal(profile.points, 200);
  Object.assign(state, { running: true, training: true, raceFinished: false, raceId: "training" });
  assert.equal(finishRaceIfNeeded(state), false);
  assert(state.running);
  assert.equal(profile.points, 200);
});
