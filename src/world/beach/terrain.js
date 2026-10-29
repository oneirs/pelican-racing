import THREE from "../../core/three.js?v=combat-48";
import { mesh } from "../../core/geometry.js?v=combat-48";
import { mat } from "../../models/materials.js?v=combat-48";
function shoreRadius(a) {
  return 1 + 0.027 * Math.sin(a * 5) + 0.018 * Math.cos(a * 9);
}
export function islandDisc(rx, rz, y, color, parent, cx = 0, cz = 0) {
  const points = [cx, y, cz],
    indices = [];
  const n = 100;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      r = shoreRadius(a);
    points.push(cx + Math.cos(a) * rx * r, y, cz + Math.sin(a) * rz * r);
  }
  for (let i = 0; i < n; i++) indices.push(0, ((i + 1) % n) + 1, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  const o = mesh(g, mat(color), parent);
  o.castShadow = false;
  return o;
}
export function createTerrain(parent) {
  const sea = mesh(
    new THREE.PlaneGeometry(1600, 1600),
    mat("#329ead", 0.4),
    parent,
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.55;
  sea.castShadow = false;
  islandDisc(72, 58, -0.49, "#43b4ba", parent);
  islandDisc(65, 51, -0.42, "#65c9c6", parent);
  islandDisc(58, 46, -0.32, "#98d9d1", parent);
  islandDisc(54.4, 43.4, -0.2, "#f2e7be", parent);
  islandDisc(53, 42, 0.025, "#eacb8b", parent);
  islandDisc(50.5, 40, 0.034, "#f5dea5", parent);
  islandDisc(24, 14, 0.07, "#aac87c", parent, -3, 0);
  islandDisc(20.5, 11.5, 0.082, "#b8d18a", parent, -4, 0);
  const foam = new THREE.Group();
  parent.add(foam);
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2,
      r = shoreRadius(a),
      x = Math.cos(a) * 56 * r,
      z = Math.sin(a) * 44.3 * r;
    const geo = new THREE.PlaneGeometry(1.0 + (i % 3) * 0.5, 0.12);
    const m = new THREE.MeshBasicMaterial({
      color: "#eef8df",
      transparent: true,
      opacity: 0.6,
    });
    const stripe = mesh(geo, m, foam);
    stripe.position.set(x, -0.14, z);
    stripe.rotation.set(-Math.PI / 2, 0, -a - Math.PI / 2);
    stripe.castShadow = false;
    stripe.receiveShadow = false;
  }
  return { foam };
}
