import THREE from "../../core/three.js?v=combat-48";
import { mesh, box } from "../../core/geometry.js?v=combat-48";
import { mat } from "../../models/materials.js?v=combat-48";

export function createRoad(route, parent, layout) {
  const asphalt = mat("#ffffff"),
    white = mat("#fff6d9"),
    coral = mat("#e97955"),
    yellow = mat("#f2ca68");
  const positions = [],
    colors = [],
    indices = [],
    segments = 500;
  for (let i = 0; i <= segments; i++) {
    const { point, normal } = route.sample(i / segments);
    for (const side of [-1, 1]) {
      const p = point.clone().addScaledVector(normal, (side * route.width) / 2);
      positions.push(...p.toArray());
      const c = new THREE.Color("#52626a");
      c.multiplyScalar(1 + 0.014 * Math.sin(i * 1.3));
      colors.push(c.r, c.g, c.b);
    }
    if (i) {
      const a = (i - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  asphalt.vertexColors = true;
  const road = mesh(g, asphalt, parent);
  road.castShadow = false;
  // Continuous edge strips and alternating curb blocks follow the exact route.
  function strip(offset, width, material) {
    const vertices = [],
      faces = [];
    for (let i = 0; i <= segments; i++) {
      const { point, normal } = route.sample(i / segments);
      for (const edge of [-1, 1]) {
        const p = point
          .clone()
          .addScaledVector(normal, offset + (edge * width) / 2);
        p.y += 0.022;
        vertices.push(...p.toArray());
      }
      if (i) {
        const a = (i - 1) * 2;
        faces.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(faces);
    geo.computeVertexNormals();
    const o = mesh(geo, material, parent);
    o.castShadow = false;
  }
  for (const side of [-1, 1])
    strip(side * (route.width / 2 - 0.24), 0.1, white);
  const count = Math.ceil(route.length / 1.55);
  for (let i = 0; i < count; i++) {
    const { point, normal, tangent } = route.sample(i / count);
    for (const side of [-1, 1]) {
      const p = point
        .clone()
        .addScaledVector(normal, side * (route.width / 2 + 0.23));
      p.y = 0.2;
      const curb = box(
        p.toArray(),
        [route.length / count + 0.045, 0.22, 0.43],
        i % 2 ? white : coral,
        parent,
      );
      curb.rotation.y = -Math.atan2(tangent.z, tangent.x);
    }
  }
  const { point, tangent } = route.sample(0);
  const start = new THREE.Group();
  start.position.copy(point);
  start.rotation.y = -Math.atan2(tangent.z, tangent.x);
  parent.add(start);
  const ink = mat("#243d42");
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 10; col++)
      box(
        [(row - 1) * 0.44, 0.04, (col - 4.5) * (route.width / 10)],
        [0.44, 0.018, route.width / 10],
        (row + col) % 2 ? white : ink,
        start,
      );
  for (const z of [-route.width / 2 - 1, route.width / 2 + 1]) {
    box([0, 2.9, z], [0.27, 5.8, 0.27], coral, start);
    box([0, 0.2, z], [0.8, 0.4, 0.8], white, start);
  }
  box([0, 5.65, 0], [0.4, 0.75, route.width + 2.3], white, start);
  // Checkered finish gantry; the route has enough clearance for the rider.
  for (let i = 0; i < 18; i++)
    for (let j = 0; j < 2; j++)
      box(
        [0.211, 5.47 + j * 0.34, (i - 8.5) * ((route.width + 2) / 18)],
        [0.025, 0.34, (route.width + 2) / 18],
        (i + j) % 2 ? white : ink,
        start,
      );
  const bollard = mat("#356f70");
  for (const progress of [0.28, 0.31, 0.49, 0.52, 0.7, 0.73]) {
    const { point, normal, tangent } = route.sample(progress);
    const p = point.clone().addScaledVector(normal, route.width / 2 + 1.3);
    box([p.x, 0.6, p.z], [0.14, 1.1, 0.14], bollard, parent);
    const sign = box([p.x, 1.1, p.z], [1.05, 0.6, 0.1], yellow, parent);
    sign.rotation.y = -Math.atan2(tangent.z, tangent.x);
  }
  for (const slot of layout.grid) {
    const stall = new THREE.Group();
    stall.position.copy(slot.position);
    stall.rotation.y = slot.heading;
    parent.add(stall);
    for (const side of [-1, 1])
      box([0, 0.042, side * 1.05], [3, 0.018, 0.09], white, stall);
    box([1.5, 0.043, 0], [0.13, 0.018, 2.18], yellow, stall);
  }
  const checkpointPaint = mat("#53b5b8");
  for (const checkpoint of layout.checkpoints.slice(1)) {
    const pose = route.sample(checkpoint.progress);
    for (const side of [-1, 1]) {
      const p = pose.point
        .clone()
        .addScaledVector(pose.normal, side * (route.width / 2 + 0.85));
      box([p.x, 1.3, p.z], [0.12, 2.2, 0.12], white, parent);
      const flag = box(
        [p.x, 2.1, p.z],
        [0.7, 0.65, 0.1],
        checkpointPaint,
        parent,
      );
      flag.rotation.y = -Math.atan2(pose.tangent.z, pose.tangent.x);
    }
  }
  return { start };
}
