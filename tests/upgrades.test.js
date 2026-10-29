import test from "node:test";
import assert from "node:assert/strict";
import { SLOTS, BODY_WEIGHT_KG, formatItemWeight, computeTuning, normalizeParts, buildLoadout } from "../src/game/upgrades.js";
import { loadSelection, saveSelection } from "../src/game/garage.js";

test("every item declares its weight and equipped weights replace stock parts", () => {
  for (const slot of SLOTS) {
    const stock = slot.items.find((item) => item.id === "standard");
    for (const item of slot.items) {
      assert(Number.isFinite(item.weightKg) && item.weightKg >= 0);
      if (item.weightKg === 0) assert(["weapon", "rocket"].includes(slot.id) && item.id === "standard");
      assert.equal(item.modifiers.mass, undefined, "weight must not be counted twice");
      assert.equal(computeTuning({ [slot.id]: item.id }).mass,
        Math.round((80 - stock.weightKg + item.weightKg) * 1000) / 1000);
      assert(formatItemWeight(slot, item).startsWith(`重量 ${item.weightKg} kg`));
    }
  }
  assert.equal(BODY_WEIGHT_KG, 39);
  assert.equal(computeTuning().mass, 80);
  assert.equal(computeTuning({ head: "aero", beak: "streamlined", tires: "slick", drive: "balanced" }).mass, 78.7);
});

test("weight labels distinguish absolute weight from stock difference", () => {
  const legs = SLOTS.find((slot) => slot.id === "thighs");
  assert.equal(formatItemWeight(legs, legs.items.find((item) => item.id === "standard")), "重量 12 kg");
  assert.equal(formatItemWeight(legs, legs.items.find((item) => item.id === "golden")), "重量 42 kg · 比原装 +30 kg");
  assert.equal(formatItemWeight(legs, legs.items.find((item) => item.id === "agile")), "重量 10 kg · 比原装 −2 kg");
});

test("all 153090 builds have finite physics values and respect 500 km/h", () => {
  let builds = [{}];
  for (const slot of SLOTS)
    builds = builds.flatMap((build) =>
      slot.items.map((item) => ({ ...build, [slot.id]: item.id })),
    );
  assert.equal(builds.length, 153090);
  for (const build of builds) {
    const tuning = computeTuning(build);
    for (const value of Object.values(tuning))
      assert(Number.isFinite(value) && value > 0);
    assert(tuning.maxSpeedKmh <= 500 && tuning.mass >= 60);
    assert.equal(tuning.recoveryTime, 5);
  }
});
test("old garage saves migrate and independent parts persist; unknown IDs fall back", () => {
  const records = new Map([
    [
      "pelican-garage-v1",
      JSON.stringify({ character: "storm", bicycle: "night" }),
    ],
  ]);
  const storage = {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  };
  const selection = loadSelection(storage);
  assert.equal(selection.character.id, "storm");
  assert.equal(selection.parts.head, "standard");
  selection.parts.thighs = "power";
  selection.parts.beak = "cushion";
  saveSelection(storage, selection);
  const restored = loadSelection(storage);
  assert.equal(restored.parts.thighs, "power");
  assert.equal(restored.parts.beak, "cushion");
  assert.equal(
    normalizeParts({ head: "injected", tires: "grip" }).head,
    "standard",
  );
  assert.equal(loadSelection(undefined).parts.drive, "standard");
});

test("golden legs are heaviest and diamond legs rank second for the same other equipment", () => {
  const legs = SLOTS.find((slot) => slot.id === "thighs");
  const masses = legs.items
    .map((item) => ({
      id: item.id,
      mass: computeTuning({ thighs: item.id }).mass,
    }))
    .sort((a, b) => b.mass - a.mass);
  assert.equal(masses[0].id, "golden");
  assert.equal(masses[1].id, "diamond");
  for (const [id, extra] of [
    ["golden", 30],
    ["diamond", 20],
    ["mechanical", 10],
    ["hormone", 2],
  ]) {
    assert.equal(computeTuning({ thighs: id }).mass, 80 + extra);
    assert.equal(normalizeParts({ thighs: id }).thighs, id);
    const data = new Map();
    const storage = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
    };
    const selection = loadSelection(storage);
    selection.parts.thighs = id;
    saveSelection(storage, selection);
    assert.equal(loadSelection(storage).parts.thighs, id);
  }
});


test("rocket raises low-gear cap and drive; handlebars improve steering; new slots persist", () => {
  const base = computeTuning({ drive: "torque" });
  const boosted = computeTuning({ drive: "torque", rocket: "boost", handlebar: "agile" });
  assert.equal(boosted.maxSpeedKmh, 400);
  assert.equal(boosted.driveForce, base.driveForce * 1.6);
  assert.equal(boosted.steering, 1.45);
  assert.equal(computeTuning({ rocket: "boost" }).maxSpeedKmh, 300);
  const data = new Map(), storage = { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v) };
  const selection = loadSelection(storage);
  selection.parts.rocket = "boost"; selection.parts.handlebar = "precision";
  saveSelection(storage, selection);
  assert.equal(loadSelection(storage).parts.rocket, "boost");
  assert.equal(loadSelection(storage).parts.handlebar, "precision");
});


test("ordinary equipment starts at 220 km/h; upgraded gears can reach the global cap", () => {
  assert.equal(computeTuning().maxSpeedKmh, 220);
  assert.equal(computeTuning({ drive: "balanced", rocket: "boost" }).maxSpeedKmh, 500);
});


test("small cannon keeps the saved weapon ID and old saves default to empty", () => {
  assert.equal(SLOTS.find(s => s.id === "weapon").owner, "武器");
  assert.equal(SLOTS.find(s => s.id === "weapon").items.find(i=>i.id==="launcher").name,"小炮");
  assert.equal(normalizeParts({rocket:"boost"}).weapon, "standard");
  assert.equal(normalizeParts({weapon:"launcher"}).rocket, "standard");
});

test("one attack slot migrates old saves, replaces weapons, and counts only the active mass", () => {
  assert.equal(SLOTS.filter(s=>s.owner==="武器").length,1);
  assert.deepEqual(SLOTS.find(s=>s.id==="weapon").items.map(i=>i.id),["standard","launcher","homing-launcher","gatling","attack-beak"]);
  for(const [input,weapon,mass] of [
    [{gatling:"dual"},"gatling",88],
    [{weapon:"standard",gatling:"dual"},"gatling",88],
    [{weapon:"launcher",gatling:"dual"},"launcher",84],
    [{weapon:"gatling",gatling:"dual"},"gatling",88],
    [{weapon:"homing-launcher",gatling:"dual"},"homing-launcher",84],
    [{weapon:"attack-beak",gatling:"dual"},"attack-beak",83],
    [{weapon:"standard"},"standard",80],
  ]) {
    const valid=normalizeParts(input);assert.equal(valid.weapon,weapon);assert(!("gatling" in valid));
    assert.equal(computeTuning(valid).mass,mass);
    const build=buildLoadout({parts:valid});
    assert(!(["launcher","homing-launcher"].includes(build.bicycle.weaponPart)&&build.bicycle.gatlingPart==="dual"));
    assert.equal(build.bicycle.gatlingPart==="dual",weapon==="gatling");
    assert.equal(build.character.attackBeak,weapon==="attack-beak");
  }
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  const selection=loadSelection(storage);selection.parts.weapon="gatling";selection.parts.rocket="boost";
  saveSelection(storage,selection);assert.equal(loadSelection(storage).parts.weapon,"gatling");
  selection.parts.weapon="launcher";saveSelection(storage,selection);
  const saved=loadSelection(storage);assert.equal(saved.parts.weapon,"launcher");assert.equal(saved.parts.rocket,"boost");assert(!("gatling" in saved.parts));
});

 test("homing launcher persists independently of the straight cannon", () => {
  const data=new Map(), storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  const selection=loadSelection(storage);selection.parts.weapon="homing-launcher";
  saveSelection(storage,selection);
  const restored=loadSelection(storage);assert.equal(restored.parts.weapon,"homing-launcher");
  assert.equal(buildLoadout(restored).bicycle.weaponPart,"homing-launcher");
  assert.equal(buildLoadout(restored).bicycle.gatlingPart,"standard");
 });
