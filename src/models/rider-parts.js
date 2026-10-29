export const RIDER_PART_IDS = ["body", "head", "beak", "wing-left", "wing-right", "leg-left", "leg-right",
  "frame", "wheel-front", "wheel-rear", "handlebar", "drive", "rocket", "weapon"];

const descendsFrom = (node, parent) => {
  if (!parent) return false;
  for (let current = node; current; current = current.parent) if (current === parent) return true;
  return false;
};
const ancestorNamed = (node, name) => {
  for (let current = node; current; current = current.parent) if (current.name === name) return current;
  return null;
};

// Body models face +X: their +Z side becomes the rider's right in the race.
export function collectRiderPartMeshes(rider) {
  const parts = new Map(RIDER_PART_IDS.map(id => [id, []]));
  if (!rider?.group) return parts;
  rider.group.traverse(mesh => {
    if (!mesh.isMesh) return;
    let id = null;
    for (let i = 0; i < rider.bicycle.wheels.length; i++)
      if (descendsFrom(mesh, rider.bicycle.wheels[i])) id = i === 0 ? "wheel-rear" : "wheel-front";
    for (const leg of rider.pelican.legs)
      if (descendsFrom(mesh, leg.upper.parent)) id = leg.side > 0 ? "leg-right" : "leg-left";
    const heldWings = ancestorNamed(mesh, "weapon-holding-wings");
    if (!id && heldWings) {
      let child = mesh;
      while (child.parent !== heldWings) child = child.parent;
      id = heldWings.children.indexOf(child) < 3 ? "wing-left" : "wing-right";
    }
    // A long attack beak is an anatomical beak, although its selection card
    // belongs to the weapon slot. It must never disappear with a damaged gun.
    if (!id && ancestorNamed(mesh, "attack-beak")) id = "beak";
    let owner = mesh;
    while (owner && !owner.userData.partSlot) owner = owner.parent;
    const slot = owner?.userData.partSlot;
    if (!id && slot === "wings") id = mesh.position.z >= 0 ? "wing-right" : "wing-left";
    if (!id && ["beak", "head", "frame", "handlebar", "drive", "rocket", "weapon"].includes(slot)) id = slot;
    if (!id && rider.pelican.headRig && descendsFrom(mesh, rider.pelican.headRig)) id = "head";
    if (!id && descendsFrom(mesh, rider.pelican.bird)) {
      mesh.geometry.computeBoundingBox();
      const lower = mesh.geometry.boundingBox.min.y * mesh.scale.y + mesh.position.y;
      id = lower > 3.72 ? "head" : "body";
    }
    if (!id) id = descendsFrom(mesh, rider.bicycle.group) ? "frame" : "body";
    parts.get(id).push(mesh);
  });
  return parts;
}
