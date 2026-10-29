import { normalizeParts } from "./upgrades.js?v=durability-57";

// Game balance values, independent of material strength or physical measurements.
export const DURABILITY_PARTS = Object.freeze([
  { id: "body", label: "躯干", max: 320 },
  { id: "head", label: "头部", max: 240 },
  { id: "beak", label: "喙", max: 180 },
  { id: "wing-left", label: "左翅", max: 160 },
  { id: "wing-right", label: "右翅", max: 160 },
  { id: "leg-left", label: "左腿", max: 220 },
  { id: "leg-right", label: "右腿", max: 220 },
  { id: "frame", label: "车架", max: 240 },
  { id: "wheel-front", label: "前轮", max: 160 },
  { id: "wheel-rear", label: "后轮", max: 160 },
  { id: "handlebar", label: "车把", max: 140 },
  { id: "drive", label: "传动", max: 180 },
  { id: "rocket", label: "助推火箭", max: 180 },
  { id: "weapon", label: "武器", max: 200 },
].map(Object.freeze));

export const DURABILITY_REPAIR_SECONDS = 5;

export function formatItemDurability(slot, item, equipment = {}) {
  const partId = {
    head: "head", beak: "beak", wings: "wing-left", thighs: "leg-left",
    frame: "frame", tires: "wheel-front", handlebar: "handlebar", drive: "drive",
    rocket: "rocket", weapon: item.id === "attack-beak" ? "beak" : "weapon",
  }[slot.id];
  const part = createDurability({ ...equipment, [slot.id]: item.id }).read().parts[partId];
  if (!part) return "未装载";
  const label = ["wings", "thighs", "tires"].includes(slot.id)
    ? "单侧"
    : DURABILITY_PARTS.find(({ id }) => id === partId).label;
  return `${label}耐久 ${part.max}`;
}

function maximums(parts) {
  const equipped = normalizeParts(parts);
  const caps = Object.fromEntries(DURABILITY_PARTS.map(({ id, max }) => [id, max]));
  caps.head *= { guard: 1.5, aero: 0.8 }[equipped.head] ?? 1;
  caps.beak *= { streamlined: 0.85, cushion: 1.6 }[equipped.beak] ?? 1;
  if (equipped.weapon === "attack-beak") caps.beak *= 1.25;
  const wingScale = { glide: 1.15, sprint: 1.35 }[equipped.wings] ?? 1;
  caps["wing-left"] *= wingScale;
  caps["wing-right"] *= wingScale;
  const legScale = {
    power: 1.2, agile: 0.9, golden: 1.7, diamond: 1.5,
    mechanical: 1.6, hormone: 0.9,
  }[equipped.thighs] ?? 1;
  caps["leg-left"] *= legScale;
  caps["leg-right"] *= legScale;
  caps.frame *= { carbon: 0.8, reinforced: 1.65 }[equipped.frame] ?? 1;
  const wheelScale = { slick: 0.85, grip: 1.2 }[equipped.tires] ?? 1;
  caps["wheel-front"] *= wheelScale;
  caps["wheel-rear"] *= wheelScale;
  caps.handlebar *= { precision: 1.15, agile: 1.25 }[equipped.handlebar] ?? 1;
  caps.drive *= { balanced: 1.15, torque: 1.3 }[equipped.drive] ?? 1;
  if (equipped.rocket !== "boost") delete caps.rocket;
  // The attack beak is one physical beak, rather than a second detached weapon.
  if (!["launcher", "homing-launcher", "gatling"].includes(equipped.weapon))
    delete caps.weapon;
  return Object.fromEntries(Object.entries(caps).map(([id, max]) => [id, Math.round(max)]));
}

/** Impact point relative to the chassis: +x right, -z forward, y above the wheel axle. */
export function selectImpactPart(localPoint = {}) {
  const x = Number.isFinite(localPoint.x) ? localPoint.x : 0;
  const y = Number.isFinite(localPoint.y) ? localPoint.y : 1.1;
  const z = Number.isFinite(localPoint.z) ? localPoint.z : 0;
  if (y <= 0.45) {
    if (z <= -0.5) return "wheel-front";
    if (z >= 0.5) return "wheel-rear";
    return "frame";
  }
  if (y >= 1.5 && z <= -0.35) return z <= -0.9 ? "beak" : "head";
  if (Math.abs(x) > 0.2) {
    const side = x < 0 ? "left" : "right";
    return `${y < 1.05 ? "leg" : "wing"}-${side}`;
  }
  if (y >= 1.85) return "head";
  return y >= 0.95 ? "body" : "frame";
}

export function createDurability(equipment = {}) {
  const parts = Object.fromEntries(Object.entries(maximums(equipment)).map(([id, max]) => [
    id, { current: max, max, broken: false, repairRemaining: 0 },
  ]));
  let version = 0;

  function restore(part) {
    part.current = part.max;
    part.broken = false;
    part.repairRemaining = 0;
  }

  return {
    damage(partId, amount) {
      const part = Object.hasOwn(parts, partId) ? parts[partId] : null;
      if (!part || part.broken || !Number.isFinite(amount) || amount <= 0)
        return { partId, applied: 0, newlyBroken: false };
      const applied = Math.min(amount, part.current);
      part.current = Math.max(0, part.current - applied);
      part.broken = part.current === 0;
      if (part.broken) part.repairRemaining = DURABILITY_REPAIR_SECONDS;
      version++;
      return { partId, applied, newlyBroken: part.broken };
    },
    tick(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      let repaired = false;
      for (const part of Object.values(parts)) {
        if (!part.broken) continue;
        part.repairRemaining = Math.max(0, part.repairRemaining - dt);
        if (part.repairRemaining <= 1e-9) {
          restore(part);
          repaired = true;
        }
      }
      if (repaired) version++;
    },
    repairBroken() {
      let repaired = false;
      for (const part of Object.values(parts)) {
        if (!part.broken) continue;
        restore(part);
        repaired = true;
      }
      if (repaired) version++;
    },
    repairAll() {
      let repaired = false;
      for (const part of Object.values(parts)) {
        if (part.current === part.max && !part.broken) continue;
        restore(part);
        repaired = true;
      }
      if (repaired) version++;
    },
    read() {
      return {
        version,
        parts: Object.fromEntries(Object.entries(parts).map(([id, part]) => [id, { ...part }])),
        totalCurrent: Object.values(parts).reduce((sum, part) => sum + part.current, 0),
        totalMax: Object.values(parts).reduce((sum, part) => sum + part.max, 0),
      };
    },
  };
}
