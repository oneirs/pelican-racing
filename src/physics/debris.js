export const MAX_DEBRIS = 72;
export const DEBRIS_LIFETIME = 4;
// Small physical shell pieces collide with the world, not the rider or one another.
export function createDebris(R, world) {
  const pieces = [];
  const handles = new Set();
  let nextId = 0;
  function remove(index) {
    const [piece] = pieces.splice(index, 1);
    handles.delete(piece.handle);
    world.removeRigidBody(piece.body);
  }
  function burst(position, rotation, velocity, strength, chunkId) {
    const count = 6 + Math.round(strength * 6);
    while (pieces.length + count > MAX_DEBRIS) remove(0);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const half = [0.065, 0.1 + (i % 3) * 0.025, 0.12];
      const body = world.createRigidBody(
        R.RigidBodyDesc.dynamic()
          .setTranslation(
            position.x + Math.cos(a) * 0.3,
            position.y + ((i % 3) - 1) * 0.25,
            position.z + Math.sin(a) * 0.3,
          )
          .setRotation(rotation)
          .setCcdEnabled(true)
          .setLinearDamping(0.6)
          .setAngularDamping(0.7),
      );
      const collider = world.createCollider(
        R.ColliderDesc.cuboid(...half)
          .setMass(12 / count)
          .setFriction(0.85)
          .setRestitution(0.32)
          .setCollisionGroups(0x00040001),
        body,
      );
      body.setLinvel(
        {
          x: velocity.x * 0.65 + Math.cos(a) * (2 + strength * 4),
          y: Math.max(0, velocity.y) + 2 + (i % 3) * 1.4,
          z: velocity.z * 0.65 + Math.sin(a) * (2 + strength * 4),
        },
        true,
      );
      body.setAngvel(
        { x: Math.sin(a) * 9, y: 3 + (i % 4), z: Math.cos(a) * 9 },
        true,
      );
      handles.add(collider.handle);
      pieces.push({
        id: ++nextId,
        body,
        handle: collider.handle,
        half,
        white: i % 3 === 0,
        life: DEBRIS_LIFETIME,
        chunkId,
      });
    }
  }
  return {
    burst,
    handles,
    step(dt) {
      for (let i = pieces.length - 1; i >= 0; i--) {
        pieces[i].life -= dt;
        if (pieces[i].life <= 1e-6 || pieces[i].body.translation().y < -10)
          remove(i);
      }
    },
    syncChunks(chunks) {
      for (let i = pieces.length - 1; i >= 0; i--)
        if (!chunks.has(pieces[i].chunkId)) remove(i);
    },
    read(origin) {
      return pieces.map((p) => {
        const t = p.body.translation();
        return {
          id: p.id,
          x: t.x,
          y: t.y,
          z: t.z - origin,
          rotation: { ...p.body.rotation() },
          half: p.half,
          white: p.white,
          life: p.life,
        };
      });
    },
    get count() {
      return pieces.length;
    },
  };
}
