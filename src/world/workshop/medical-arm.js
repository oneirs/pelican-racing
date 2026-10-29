import THREE from "../../core/three.js?v=combat-48";
import { mesh, poly, moveRod } from "../../core/geometry.js?v=combat-48";

// The animation moves a wrist target. Two fixed-length bones keep the shoulder attached.
export function createMedicalArm(parent, side, coat, glove, cuff) {
  const shoulder = new THREE.Vector3(-0.34, 2.95, side * 0.77);
  const control = new THREE.Group();
  control.position.set(0.16, 2.59, side * 0.79);
  parent.add(control);
  const upper = mesh(new THREE.CylinderGeometry(0.24, 0.21, 1, 7), coat, parent);
  const lower = mesh(new THREE.CylinderGeometry(0.21, 0.17, 1, 7), coat, parent);
  const joint = poly([0, 0, 0], [0.245, 0.245, 0.245], coat, parent, 0);
  const hand = new THREE.Group();
  parent.add(hand);
  poly([0, 0, 0], [0.22, 0.21, 0.22], glove, hand, 0);
  poly([-0.15, 0, 0], [0.08, 0.225, 0.235], cuff, hand, 0);
  const wrist = new THREE.Vector3(), direction = new THREE.Vector3(), bend = new THREE.Vector3(), elbow = new THREE.Vector3();
  const upperLength = 0.9, lowerLength = 0.85;
  function update() {
    control.updateMatrix();
    wrist.set(0.44, -0.03, 0).applyMatrix4(control.matrix);
    direction.copy(wrist).sub(shoulder);
    const distance = Math.max(0.06, Math.min(upperLength + lowerLength - 0.01, direction.length()));
    if (direction.lengthSq() < 1e-8) direction.set(1, 0, 0);
    direction.normalize();
    wrist.copy(shoulder).addScaledVector(direction, distance);
    bend.set(0, -1, side * 0.25);
    bend.addScaledVector(direction, -bend.dot(direction));
    if (bend.lengthSq() < 1e-8) bend.set(0, 0, 1).addScaledVector(direction, -direction.z);
    bend.normalize();
    const along = (distance * distance + upperLength ** 2 - lowerLength ** 2) / (2 * distance);
    elbow.copy(shoulder).addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2)));
    moveRod(upper, shoulder, elbow);
    moveRod(lower, elbow, wrist);
    joint.position.copy(elbow);
    hand.position.copy(wrist);
    hand.quaternion.copy(control.quaternion);
  }
  update();
  return { control, hand, update, shoulder, elbow, wrist, upper, lower };
}
