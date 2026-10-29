export const MAPS = Object.freeze([
  Object.freeze({ id: "coast", name: "无尽海岸", training: true, description: "明亮海滩 · 单人训练 · 无 AI 对手" }),
  Object.freeze({ id: "canyon", name: "赤岩峡谷", training: false, description: "赤岩沙漠 · AI 同场竞速" }),
  Object.freeze({ id: "neon", name: "霓虹都市", training: false, description: "夜间都市 · AI 同场竞速" }),
]);
export function getMapDefinition(value) {
  const id = typeof value === "string" ? value : value?.mapId;
  return MAPS.find(map => map.id === id) ?? MAPS[0];
}
export const MAP_DEFAULTS = Object.freeze({
  mapId: "coast",
  seed: 93417,
  width: 12,
  curves: "gentle",
  obstacles: "normal",
  destruction: true,
  sparks: true,
  speedEffects: true,
});
const KEY = "pelican-map-v1";
export function normalizeMap(value = {}) {
  value = value && typeof value === "object" ? value : {};
  const pick = (key, values) =>
    values.includes(value[key]) ? value[key] : MAP_DEFAULTS[key];
  const seed = Number(value.seed);
  return {
    mapId: getMapDefinition(value).id,
    seed:
      Number.isInteger(seed) && seed >= 0 && seed <= 4294967295
        ? seed
        : MAP_DEFAULTS.seed,
    width: pick("width", [12, 16, 20]),
    curves: pick("curves", ["straight", "gentle", "sweeping"]),
    obstacles: pick("obstacles", ["off", "light", "normal", "dense"]),
    ...Object.fromEntries(
      ["destruction", "sparks", "speedEffects"].map((key) => [
        key,
        typeof value[key] === "boolean" ? value[key] : true,
      ]),
    ),
  };
}
export function loadMap(storage) {
  try {
    return normalizeMap(JSON.parse(storage?.getItem(KEY) ?? "{}"));
  } catch {
    return normalizeMap();
  }
}
export function saveMap(storage, settings) {
  try {
    storage?.setItem(KEY, JSON.stringify(normalizeMap(settings)));
  } catch {}
}
