import { SLOTS } from "./upgrades.js?v=durability-57";

const STORAGE_KEY = "pelican-progression-v1";
export const RACE_DISTANCE_METERS = 5000;
const PAID_SLOTS = new Set(["rocket", "weapon"]);
const PRICES = Object.freeze({
  "rocket:boost": 100,
  "weapon:launcher": 100,
  "weapon:homing-launcher": 200,
  "weapon:gatling": 250,
  "weapon:attack-beak": 150,
});

export function itemPrice(slotId, itemId) {
  const slot = SLOTS.find(value => value.id === slotId);
  if (!slot?.items.some(item => item.id === itemId)) return null;
  return PAID_SLOTS.has(slotId) && itemId !== "standard" ? PRICES[`${slotId}:${itemId}`] : 0;
}

export function createProgression(storage, equipped = {}) {
  let saved;
  try { saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null"); } catch { saved = null; }
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) saved = null;
  let points = Number.isSafeInteger(saved?.points) && saved.points >= 0 ? saved.points : 0;
  const owned = new Set(Array.isArray(saved?.owned) ? saved.owned.filter(key => typeof key === "string") : []);
  // Preserve previously equipped items when upgrading an existing garage save.
  if (!saved) for (const slot of SLOTS) {
    const id = equipped[slot.id];
    if (id && itemPrice(slot.id, id) !== null) owned.add(`${slot.id}:${id}`);
  }
  const finished = new Set();
  function save() {
    try { storage?.setItem(STORAGE_KEY, JSON.stringify({ points, owned: [...owned] })); } catch { /* usable in memory */ }
  }
  function owns(slotId, itemId) {
    const cost = itemPrice(slotId, itemId);
    return cost !== null && (cost === 0 || owned.has(`${slotId}:${itemId}`));
  }
  save();
  return {
    get points() { return points; },
    owns,
    price: itemPrice,
    unlock(slotId, itemId) {
      const cost = itemPrice(slotId, itemId);
      if (cost === null) return false;
      if (owns(slotId, itemId)) return true;
      if (points < cost) return false;
      points -= cost; owned.add(`${slotId}:${itemId}`); save(); return true;
    },
    completeRace(raceId, place) {
      if (!raceId || finished.has(raceId)) return 0;
      const award = place === 1 ? 120 : place === 2 ? 80 : 0;
      if (!award) return 0;
      finished.add(raceId); points += award; save(); return award;
    },
  };
}
