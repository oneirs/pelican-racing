import test from "node:test";
import assert from "node:assert/strict";
import { createDurability, DURABILITY_PARTS, formatItemDurability, selectImpactPart } from "../src/game/durability.js";

test("ordinary local impacts damage a part without breaking the pelican or bicycle", () => {
  const durability = createDurability();
  const initial = durability.read();
  const hit = durability.damage("body", 85);
  assert.deepEqual(hit, { partId: "body", applied: 85, newlyBroken: false });
  const damaged = durability.read();
  assert.equal(damaged.parts.body.current, 235);
  assert.equal(damaged.parts.body.broken, false);
  for (const id of Object.keys(initial.parts)) {
    if (id !== "body") assert.deepEqual(damaged.parts[id], initial.parts[id]);
  }
  assert.equal(damaged.totalCurrent, initial.totalCurrent - 85);
  assert(damaged.version > initial.version);
});

test("left and right limbs, front and rear wheels have independent durability", () => {
  const durability = createDurability();
  durability.damage("leg-left", 30);
  durability.damage("wing-right", 40);
  durability.damage("wheel-front", 50);
  const { parts } = durability.read();
  assert.equal(parts["leg-left"].current, 190);
  assert.equal(parts["leg-right"].current, 220);
  assert.equal(parts["wing-right"].current, 120);
  assert.equal(parts["wing-left"].current, 160);
  assert.equal(parts["wheel-front"].current, 110);
  assert.equal(parts["wheel-rear"].current, 160);
});

test("reinforcements protect their own anatomy rather than multiplying all durability", () => {
  const ordinary = createDurability().read().parts;
  const reinforced = createDurability({ head: "guard", beak: "cushion", frame: "reinforced", thighs: "golden" }).read().parts;
  for (const id of ["head", "beak", "frame", "leg-left", "leg-right"])
    assert(reinforced[id].max > ordinary[id].max);
  assert.equal(reinforced.body.max, ordinary.body.max);
  assert.equal(reinforced["wheel-front"].max, ordinary["wheel-front"].max);
  const lightweight = createDurability({ frame: "carbon", head: "aero" }).read().parts;
  assert(lightweight.frame.max < ordinary.frame.max);
  assert(lightweight.head.max < ordinary.head.max);
});

test("only installed physical accessories receive durability and attack beak stays one part", () => {
  const stock = createDurability().read().parts;
  assert(!("weapon" in stock));
  assert(!("rocket" in stock));
  for (const weapon of ["launcher", "homing-launcher", "gatling"])
    assert(createDurability({ weapon }).read().parts.weapon.max > 0);
  assert(createDurability({ rocket: "boost" }).read().parts.rocket.max > 0);
  const attackBeak = createDurability({ weapon: "attack-beak" }).read().parts;
  assert(!("weapon" in attackBeak));
  assert(attackBeak.beak.max > stock.beak.max);
  assert.equal(createDurability({ frame: "invalid", rocket: "invalid" }).read().totalMax,
    createDurability().read().totalMax);
  for (const part of DURABILITY_PARTS) assert(part.label && Number.isFinite(part.max) && part.max > 0);
});

test("item descriptions show the durability of the installed anatomical part", () => {
  const description = (slotId, itemId) => formatItemDurability({ id: slotId }, { id: itemId });
  assert.equal(description("head", "guard"), "头部耐久 360");
  assert.equal(description("thighs", "golden"), "单侧耐久 374");
  assert.equal(description("wings", "standard"), "单侧耐久 160");
  assert.equal(description("tires", "standard"), "单侧耐久 160");
  assert.equal(description("frame", "reinforced"), "车架耐久 396");
  assert.equal(description("weapon", "attack-beak"), "喙耐久 225");
  assert.equal(description("weapon", "gatling"), "武器耐久 200");
  assert.equal(description("weapon", "standard"), "未装载");
  assert.equal(description("rocket", "standard"), "未装载");
});

test("a zero-durability part breaks once, cannot go negative, and leaves other parts intact", () => {
  const durability = createDurability();
  durability.damage("head", 80);
  const hit = durability.damage("beak", 500);
  assert.deepEqual(hit, { partId: "beak", applied: 180, newlyBroken: true });
  const first = durability.read();
  assert.deepEqual(first.parts.beak, { current: 0, max: 180, broken: true, repairRemaining: 5 });
  assert.equal(first.parts.head.current, 160);
  assert.equal(first.parts.body.current, 320);
  assert.deepEqual(durability.damage("beak", 100), { partId: "beak", applied: 0, newlyBroken: false });
  assert.equal(durability.read().version, first.version);
});

test("five running seconds repair only broken parts; accumulated ordinary damage persists", () => {
  const durability = createDurability();
  durability.damage("head", 80);
  durability.damage("beak", 180);
  durability.tick(2);
  assert.equal(durability.read().parts.beak.repairRemaining, 3);
  durability.tick(2.99);
  assert.equal(durability.read().parts.beak.broken, true);
  durability.tick(0.01);
  const { parts } = durability.read();
  assert.deepEqual(parts.beak, { current: 180, max: 180, broken: false, repairRemaining: 0 });
  assert.equal(parts.head.current, 160);
  assert.equal(parts.head.repairRemaining, 0);
});

test("parts broken at different times each receive their own five-second repair window", () => {
  const durability = createDurability();
  durability.damage("beak", 180);
  durability.tick(2);
  durability.damage("wheel-front", 160);
  durability.tick(3);
  const first = durability.read().parts;
  assert.equal(first.beak.broken, false);
  assert.equal(first["wheel-front"].broken, true);
  assert.equal(first["wheel-front"].repairRemaining, 2);
  durability.tick(2);
  assert.equal(durability.read().parts["wheel-front"].broken, false);
});

test("rescue repairs broken parts while race restart restores all accumulated damage", () => {
  const durability = createDurability();
  durability.damage("frame", 20);
  durability.damage("leg-right", 220);
  durability.repairBroken();
  assert.equal(durability.read().parts["leg-right"].current, 220);
  assert.equal(durability.read().parts.frame.current, 220);
  durability.repairAll();
  const snapshot = durability.read();
  assert.equal(snapshot.totalCurrent, snapshot.totalMax);
  assert(Object.values(snapshot.parts).every(part => !part.broken && part.repairRemaining === 0));
});

test("invalid damage and elapsed time are ignored and snapshots cannot mutate live state", () => {
  const durability = createDurability();
  for (const amount of [0, -50, NaN, Infinity, undefined]) durability.damage("body", amount);
  durability.damage("unknown", 80);
  durability.damage("__proto__", 80);
  durability.damage("constructor", 80);
  assert.equal(durability.read().version, 0);
  durability.damage("beak", 180);
  for (const dt of [0, -1, NaN, Infinity, undefined]) durability.tick(dt);
  const snapshot = durability.read();
  snapshot.parts.beak.current = 999;
  snapshot.parts.body.broken = true;
  delete snapshot.parts.head;
  const actual = durability.read();
  assert.equal(actual.parts.beak.current, 0);
  assert.equal(actual.parts.beak.repairRemaining, 5);
  assert.equal(actual.parts.body.broken, false);
  assert(actual.parts.head);
});

test("impact coordinates select anatomical regions using the bike's current local axes", () => {
  for (const [point, expected] of [
    [{ x: 0, y: 0.2, z: -1 }, "wheel-front"],
    [{ x: 0, y: 0.2, z: 1 }, "wheel-rear"],
    [{ x: 0, y: 0.2, z: 0 }, "frame"],
    [{ x: 0, y: 1.7, z: -1.2 }, "beak"],
    [{ x: 0, y: 1.7, z: -0.5 }, "head"],
    [{ x: -0.4, y: 1.2, z: 0 }, "wing-left"],
    [{ x: 0.4, y: 1.2, z: 0 }, "wing-right"],
    [{ x: -0.4, y: 0.8, z: 0 }, "leg-left"],
    [{ x: 0.4, y: 0.8, z: 0 }, "leg-right"],
    [{ x: 0, y: 2, z: 0 }, "head"],
    [{ x: 0, y: 1.2, z: 0 }, "body"],
  ]) assert.equal(selectImpactPart(point), expected);
});

test("preview durability includes the selected item's interaction with equipped anatomy", () => {
  assert.equal(formatItemDurability({ id: "beak" }, { id: "cushion" }, { weapon: "attack-beak" }), "喙耐久 360");
  assert.equal(formatItemDurability({ id: "weapon" }, { id: "attack-beak" }, { beak: "cushion" }), "喙耐久 360");
});
