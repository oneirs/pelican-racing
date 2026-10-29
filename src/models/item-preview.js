import THREE from "../core/three.js?v=combat-48";
import { createRider } from "./rider.js?v=beak-54";
import { updateRiding } from "../animation/riding.js?v=beak-54";
import { buildLoadout } from "../game/upgrades.js?v=durability-57";
import { disposeModel } from "./dispose.js?v=combat-48";

export function createItemModel(selection, slot, itemId) {
  const loadout = buildLoadout({
    ...selection,
    parts: { ...selection.parts, [slot]: itemId },
  });
  const previewCharacter = { ...loadout.character, attackBeak: slot === "weapon" && loadout.character.attackBeak };
  const rider = createRider(previewCharacter, loadout.bicycle);
  updateRiding(rider, 0.7);
  rider.group.updateMatrixWorld(true);
  const pieces = new THREE.Group();
  rider.group.traverse((node) => {
    if (!node.isMesh || node.userData.previewHidden) return;
    let owner = node;
    while (owner && !owner.userData.partSlot) owner = owner.parent;
    if (owner?.userData.partSlot !== slot) return;
    if (previewCharacter.attackBeak) {
      let ancestor = node;
      while (ancestor && ancestor.name !== "attack-beak") ancestor = ancestor.parent;
      if (!ancestor) return;
    }
    const material = Array.isArray(node.material)
      ? node.material.map((m) => m.clone())
      : node.material.clone();
    const copy = new THREE.Mesh(node.geometry.clone(), material);
    node.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale);
    pieces.add(copy);
  });
  disposeModel(rider.group);
  if (!pieces.children.length)
    throw new Error(`Missing preview geometry: ${slot}`);
  const bounds = new THREE.Box3().setFromObject(pieces);
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
  pieces.position.copy(center).multiplyScalar(-1);
  const pivot = new THREE.Group();
  pivot.add(pieces);
  pivot.userData.radius = radius;
  return pivot;
}
