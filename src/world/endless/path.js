import { CHUNK_LENGTH, ROAD_WIDTH, ROAD_HEIGHT } from "./config.js?v=combat-48";
export { CHUNK_LENGTH, ROAD_WIDTH, ROAD_HEIGHT };
import { normalizeMap } from "../../game/map-settings.js?v=coast-55";
import THREE from "../../core/three.js?v=combat-48";

export function randomAt(seed, index, salt = 0) {
  let n =
    (seed ^ Math.imul(index, 374761393) ^ Math.imul(salt, 668265263)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export function createEndlessPath(seed = 93417, settings = {}) {
  const options = normalizeMap({ ...settings, seed });
  const bend = { straight: 0, gentle: 1, sweeping: 1.75 }[options.curves];
  function noise(t, salt) {
    const i = Math.floor(t),
      f = smooth(t - i);
    return (
      (randomAt(seed, i, salt) * (1 - f) + randomAt(seed, i + 1, salt) * f) *
        2 -
      1
    );
  }
  function center(distance) {
    return (
      bend * (noise(distance / 700, 1) * 21 + noise(distance / 260, 2) * 3)
    );
  }
  function sample(distance, lane = 0) {
    const x = center(distance),
      dx = (center(distance + 0.05) - center(distance - 0.05)) / 0.1,
      tangent = new THREE.Vector3(dx, 0, -1).normalize(),
      normal = new THREE.Vector3(1, 0, dx).normalize();
    return {
      distance,
      point: new THREE.Vector3(x, ROAD_HEIGHT, -distance).addScaledVector(
        normal,
        lane,
      ),
      tangent,
      normal,
    };
  }
  return {
    seed,
    options,
    width: options.width,
    height: ROAD_HEIGHT,
    center,
    sample,
  };
}
