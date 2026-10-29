import THREE from "./three.js?v=combat-48";

function mesh(g, m, parent) {
  const o = new THREE.Mesh(g, m);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}
function ell(p, s, m, parent, segments = 10, rings = 7) {
  const o = mesh(new THREE.SphereGeometry(1, segments, rings), m, parent);
  o.position.set(...p);
  o.scale.set(...s);
  return o;
}
function rod(a, b, r, m, parent, n = 8) {
  const aa = new THREE.Vector3(...a),
    bb = new THREE.Vector3(...b),
    d = bb.clone().sub(aa);
  const o = mesh(new THREE.CylinderGeometry(r, r, d.length(), n), m, parent);
  o.position.copy(aa.add(bb).multiplyScalar(0.5));
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return o;
}
function box(p, s, m, parent) {
  const o = mesh(new THREE.BoxGeometry(...s), m, parent);
  o.position.set(...p);
  return o;
}
function ring(p, r, t, m, parent, n = 40) {
  const o = mesh(new THREE.TorusGeometry(r, t, 6, n), m, parent);
  o.position.set(...p);
  return o;
}
function shape(vertices, faces, m, parent) {
  m = m.clone();
  m.userData = { ...m.userData, shared: false };
  m.side = THREE.DoubleSide;
  const g = new THREE.BufferGeometry(),
    a = [];
  faces.forEach((f) => f.forEach((i) => a.push(...vertices[i])));
  g.setAttribute("position", new THREE.Float32BufferAttribute(a, 3));
  g.computeVertexNormals();
  return mesh(g, m, parent);
}
function poly(p, s, m, parent, detail = 1) {
  const o = mesh(new THREE.IcosahedronGeometry(1, detail), m, parent);
  o.position.set(...p);
  o.scale.set(...s);
  return o;
}
function taperedCurve(points, radii, material, parent, steps = 24, sides = 12) {
  const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
    ),
    frames = curve.computeFrenetFrames(steps, false),
    vertices = [],
    faces = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      at = curve.getPointAt(t),
      ridx = t * (radii.length - 1),
      j = Math.min(radii.length - 2, Math.floor(ridx)),
      r = THREE.MathUtils.lerp(radii[j], radii[j + 1], ridx - j);
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2,
        v = at
          .clone()
          .addScaledVector(frames.normals[i], Math.cos(a) * r)
          .addScaledVector(frames.binormals[i], Math.sin(a) * r);
      vertices.push(v.toArray());
    }
  }
  for (let i = 0; i < steps; i++)
    for (let k = 0; k < sides; k++) {
      const a = i * sides + k,
        b = i * sides + ((k + 1) % sides),
        c = b + sides,
        d = a + sides;
      faces.push([a, b, d], [b, c, d]);
    }
  return shape(vertices, faces, material, parent);
}
function limb(a, b, width, depth, material, parent) {
  const av = new THREE.Vector3(...a),
    bv = new THREE.Vector3(...b),
    delta = bv.clone().sub(av),
    o = ell(
      av.clone().add(bv).multiplyScalar(0.5).toArray(),
      [width, delta.length() * 0.65, depth],
      material,
      parent,
      12,
      8,
    );
  o.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    delta.normalize(),
  );
  return o;
}
function moveRod(o, a, b) {
  const d = b.clone().sub(a);
  o.position.copy(a.clone().add(b).multiplyScalar(0.5));
  o.scale.y =
    o.geometry.type === "SphereGeometry" ? d.length() * 0.65 : d.length();
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}
export { mesh, ell, rod, box, ring, shape, poly, taperedCurve, limb, moveRod };
