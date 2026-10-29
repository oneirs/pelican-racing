import THREE from "../core/three.js?v=combat-48";
import { disposeModel } from "../models/dispose.js?v=combat-48";
import { collectRiderPartMeshes } from "../models/rider-parts.js?v=durability-57";

const REASSEMBLE_TIME = 0.42;
const smooth = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const visibleWithin = (mesh, root) => {
  for (let current = mesh; current && current !== root; current = current.parent)
    if (!current.visible) return false;
  return true;
};

// Only a depleted part separates. All intact meshes and the real rigid body
// keep their transforms; repair snapshots control when that part returns.
export function createRiderBreakup(scene, name = "player") {
  const group = new THREE.Group();
  group.name = `${name}-rider-breakup`;
  group.visible = false;
  scene.add(group);
  let source = null, partMeshes = new Map();
  const loose = new Map();
  const inverse = new THREE.Matrix4(), target = new THREE.Vector3(), targetRotation = new THREE.Quaternion();
  const focusBounds = new THREE.Box3(), meshBounds = new THREE.Box3(), focusCenter = new THREE.Vector3();
  const focusSize = new THREE.Vector3(), focusSphere = new THREE.Sphere(), boundsVersions = new WeakMap();

  function restore(part) {
    for (const original of part.originals) original.mesh.visible = original.visible;
  }
  function remove(part) {
    if (part.group) disposeModel(part.group);
    restore(part);
    loose.delete(part.id);
  }
  function reset() {
    for (const part of [...loose.values()]) remove(part);
    group.visible = false;
  }
  function detach(id, state) {
    const model = source.model.group, meshes = partMeshes.get(id) ?? [];
    if (!meshes.length) return;
    model.updateWorldMatrix(true, true);
    inverse.copy(model.matrixWorld).invert();
    const cluster = new THREE.Group(); cluster.name = `detached-${id}`;
    const originals = meshes.map(mesh => ({ mesh, visible: mesh.visible }));
    for (const mesh of meshes) {
      if (mesh.userData.previewHidden || !visibleWithin(mesh, model)) continue;
      const material = Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : mesh.material.clone();
      const copy = new THREE.Mesh(mesh.geometry.clone(), material);
      copy.castShadow = true; copy.receiveShadow = true;
      mesh.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale);
      cluster.add(copy);
    }
    const bounds = new THREE.Box3().setFromObject(cluster);
    const center = bounds.isEmpty() ? model.getWorldPosition(new THREE.Vector3()) : bounds.getCenter(new THREE.Vector3());
    const anchor = center.clone().applyMatrix4(inverse);
    cluster.children.forEach(mesh => mesh.position.sub(center));
    cluster.position.copy(center);
    const shown = cluster.children.length > 0;
    if (shown) group.add(cluster);
    const index = loose.size, angle = index * 2.399963;
    const yaw = state.physicsPose?.yaw ?? 0, speed = state.velocity ?? 0;
    const part = { id, originals, group: shown ? cluster : null, anchor,
      initialRotation: model.getWorldQuaternion(new THREE.Quaternion()),
      x: center.x, y: center.y, z: center.z - state.distance,
      vx: -Math.sin(yaw) * speed * 0.92 + Math.cos(angle) * (3.5 + index % 3),
      vy: 3.8 + index % 5, vz: -Math.cos(yaw) * speed * 0.92 + Math.sin(angle) * (3.5 + index % 3),
      spin: new THREE.Vector3(1.4 + index % 4, Math.sin(angle) * 2, 1.8 + index % 3),
      floor: 0.25 + (bounds.isEmpty() ? 0 : Math.min(0.55, bounds.getSize(new THREE.Vector3()).y * 0.35)),
      phase: "scattered", returnAge: 0 };
    loose.set(id, part);
    for (const original of originals) original.mesh.visible = false;
  }
  function extendVisibleBounds(root) {
    let count = 0;
    root.updateWorldMatrix(true, true);
    root.traverse(mesh => {
      if (!mesh.isMesh || !visibleWithin(mesh, root)) return;
      const attribute = mesh.geometry.attributes.position;
      if (!mesh.geometry.boundingBox || boundsVersions.get(mesh.geometry) !== attribute?.version) {
        mesh.geometry.computeBoundingBox(); boundsVersions.set(mesh.geometry, attribute?.version);
      }
      meshBounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
      focusBounds.union(meshBounds); count++;
    });
    return count;
  }

  return {
    group,
    get active() { return group.children.length > 0; },
    isDetached(id) { return loose.has(id); },
    getFocus() {
      if (!group.children.length || !source?.model) return null;
      focusBounds.makeEmpty();
      // Include the surviving rider, not just a loose wheel far behind it.
      const attachedCount = extendVisibleBounds(source.model.group);
      extendVisibleBounds(group);
      if (focusBounds.isEmpty()) return null;
      focusBounds.getCenter(focusCenter); focusBounds.getSize(focusSize); focusBounds.getBoundingSphere(focusSphere);
      const phase = [...loose.values()].some(part => part.phase === "scattered") ? "scattered" : "returning";
      return { x: focusCenter.x, y: focusCenter.y, z: focusCenter.z, radius: focusSphere.radius,
        size: { x: focusSize.x, y: focusSize.y, z: focusSize.z }, count: group.children.length, attachedCount, phase };
    },
    setRider(rider) {
      reset(); source = rider ?? null;
      partMeshes = collectRiderPartMeshes(source?.model);
    },
    reset,
    update(dt, state) {
      if (!source?.model || !state.physicsPose || state.mapSettings?.destruction === false) { reset(); return; }
      const snapshot = state.partDurability?.parts ?? {};
      for (const [id, value] of Object.entries(snapshot)) {
        if (!value.broken) continue;
        if (!loose.has(id)) detach(id, state);
        const part = loose.get(id);
        if (part?.phase === "returning") part.phase = "scattered";
      }
      const model = source.model.group;
      model.updateWorldMatrix(true, false);
      for (const part of [...loose.values()]) {
        if (!snapshot[part.id]?.broken && part.phase === "scattered") {
          part.phase = "returning"; part.returnAge = 0;
          part.returnStart = new THREE.Vector3(part.x, part.y, part.z);
          part.returnRotation = part.group?.quaternion.clone();
        }
        // Riding and weapon animations may show a mesh again; keep just the
        // damaged part hidden while leaving all other source meshes untouched.
        for (const original of part.originals) original.mesh.visible = false;
        if (part.phase === "returning") {
          part.returnAge += dt;
          if (part.group) {
            target.copy(part.anchor).applyMatrix4(model.matrixWorld); target.z -= state.distance;
            const t = smooth(part.returnAge / REASSEMBLE_TIME);
            part.group.position.copy(part.returnStart).lerp(target, t);
            part.x = part.group.position.x; part.y = part.group.position.y; part.z = part.group.position.z;
            targetRotation.copy(model.getWorldQuaternion(new THREE.Quaternion())).multiply(part.initialRotation.clone().invert());
            part.group.quaternion.copy(part.returnRotation).slerp(targetRotation, t);
          }
          if (part.returnAge >= REASSEMBLE_TIME) { remove(part); continue; }
        } else if (dt > 0 && part.group) {
          part.vy -= 9.81 * dt;
          part.x += part.vx * dt; part.y += part.vy * dt; part.z += part.vz * dt;
          if (part.y < part.floor) {
            part.y = part.floor; part.vy = Math.abs(part.vy) * 0.24;
            const damping = Math.exp(-dt * 4);
            part.vx *= damping; part.vz *= damping; part.spin.multiplyScalar(damping);
          }
          part.group.rotateX(part.spin.x * dt); part.group.rotateY(part.spin.y * dt); part.group.rotateZ(part.spin.z * dt);
        }
        part.group?.position.set(part.x, part.y, part.z + state.distance);
      }
      group.visible = group.children.length > 0;
    },
    dispose() { reset(); group.removeFromParent(); source = null; partMeshes.clear(); },
  };
}
