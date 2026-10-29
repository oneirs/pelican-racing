import THREE from "../../core/three.js?v=combat-48";
export const ROAD_HEIGHT = 0.22;
export const ROAD_WIDTH = 12.0;
export function createRoute() {
  const points = [
    [-32, 16],
    [-13, 25],
    [15, 24],
    [35, 14],
    [34, -2],
    [26, -10],
    [20, -22],
    [8, -28],
    [-13, -23],
    [-29, -23],
    [-40, -9],
  ];
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, z]) => new THREE.Vector3(x, ROAD_HEIGHT, z)),
    true,
    "centripetal",
  );
  curve.arcLengthDivisions = 2400;
  curve.updateArcLengths();
  const length = curve.getLength();
  function sample(progress) {
    const t = (((progress + 0.2) % 1) + 1) % 1;
    const point = curve.getPointAt(t),
      tangent = curve.getTangentAt(t).normalize();
    return {
      point,
      tangent,
      normal: new THREE.Vector3(-tangent.z, 0, tangent.x),
    };
  }
  const samples = Array.from({ length: 600 }, (_, i) => sample(i / 600).point);
  function distanceTo(x, z) {
    let d = Infinity;
    for (const p of samples) d = Math.min(d, Math.hypot(x - p.x, z - p.z));
    return d;
  }
  return {
    curve,
    length,
    width: ROAD_WIDTH,
    height: ROAD_HEIGHT,
    sample,
    samples,
    distanceTo,
  };
}
