import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(new URL("../vendor/three/three.min.js", import.meta.url), "utf8"), context);
const THREE = context.THREE;
globalThis.window = { THREE };
const { createRider } = await import("../src/models/rider.js");
const { createCockpit } = await import("../src/models/cockpit.js");
const { createRaceRider } = await import("../src/models/race-rider.js");
const { createItemModel } = await import("../src/models/item-preview.js");
const { updateRiding } = await import("../src/animation/riding.js");
const { disposeModel } = await import("../src/models/dispose.js");
const { createWorkshopHead } = await import("../src/ui/garage-preview.js");
const { createAssistant } = await import("../src/world/workshop/assistant.js");
const tipPosition = beak => beak.localToWorld(beak.userData.tip.clone());

test("attack beak replaces the ordinary beak and has an isolated weapon preview", () => {
  const rider = createRider({ attackBeak: true });
  try {
    const beak = rider.pelican.attackBeak;
    assert(beak && beak.parent === rider.pelican.headRig);
    assert.equal(rider.bicycle.group.getObjectByName("weapon-mount").visible, false);
    assert(!rider.pelican.headRig.children.some(node => node.userData.partSlot === "beak"));
    const preview = createItemModel({ parts: {} }, "weapon", "attack-beak");
    const ordinary = createItemModel({ parts: { weapon: "attack-beak" } }, "beak", "streamlined");
    try {
      const size = new THREE.Box3().setFromObject(preview).getSize(new THREE.Vector3());
      assert(size.x > 6 && size.y < 0.5 && size.z < 0.6, "weapon preview includes bicycle or body geometry");
      assert(preview.userData.radius > 3 && Number.isFinite(preview.userData.radius));
      assert(ordinary.userData.radius > 0, "body beak previews must remain available with a long beak equipped");
    } finally { disposeModel(preview); disposeModel(ordinary); }
  } finally { disposeModel(rider.group); }
});

test("E swings the connected head right and Q left, then restores the head and all its accessories", () => {
  const rider = createRider({ attackBeak: true });
  rider.group.rotation.y = Math.PI / 2;
  rider.group.scale.setScalar(0.62);
  try {
    updateRiding(rider, 0);
    const { headRig, attackBeak } = rider.pelican;
    rider.group.updateMatrixWorld(true);
    const joint = headRig.getWorldPosition(new THREE.Vector3());
    const tip = tipPosition(attackBeak);
    assert(Math.abs(tip.distanceTo(joint) - 4) < 0.02, "visual reach differs from melee reach");
    const accessoryLocations = headRig.children.map(node => node.position.clone());
    for (const direction of [-1, 1]) {
      updateRiding(rider, 0, 0, 0, 0, { age: 0.32, direction });
      rider.group.updateMatrixWorld(true);
      const swung = tipPosition(attackBeak);
      assert(swung.x * direction > 3, "beak swung to the wrong side");
      assert(headRig.getWorldPosition(new THREE.Vector3()).distanceTo(joint) < 1e-6, "head detached from neck");
      assert(headRig.children.every((node, i) => node.position.distanceTo(accessoryLocations[i]) < 1e-6));
    }
    updateRiding(rider, 0);
    rider.group.updateMatrixWorld(true);
    assert.equal(headRig.rotation.y, 0);
    assert(tipPosition(attackBeak).distanceTo(tip) < 1e-6);
  } finally { disposeModel(rider.group); }
});

test("both camera modes display and reset the same left and right attack motion", () => {
  const camera = new THREE.PerspectiveCamera(58, 1.5, 0.1, 700);
  const cockpit = createCockpit(camera, { attackBeak: true });
  const racer = createRaceRider(new THREE.Scene(), { attackBeak: true }, {});
  const state = { cameraMode: "third", physicsPose: { x: 0, y: 1, rotation: { x: 0, y: 0, z: 0, w: 1 } }, time: 1, phase: 0 };
  try {
    const mouth = cockpit.group.getObjectByName("first-person-mouth-joint");
    assert(mouth && mouth.position.y < -0.3 && mouth.parent === cockpit.group);
    for (const direction of [-1, 1]) {
      state.beakAttack = { age: 0.32, direction };
      cockpit.update(state);
      racer.update(state);
      const head = racer.group.getObjectByName("pelican-head-joint");
      assert.equal(mouth.rotation.y, head.rotation.y);
      assert(tipPosition(mouth.getObjectByName("attack-beak")).x * direction > 3);
    }
    state.beakAttack = null;
    cockpit.update(state); racer.update(state);
    assert.equal(mouth.rotation.y, 0);
    assert.equal(racer.group.getObjectByName("pelican-head-joint").rotation.y, 0);
    cockpit.group.visible = false;
    assert.equal(mouth.parent.visible, false, "mouth remains visible when cockpit is hidden");
  } finally { disposeModel(cockpit.group); racer.dispose(); }
  assert.equal(camera.children.length, 0, "mouth leaked outside cockpit disposal");
});

test("ordinary pelicans and doctors keep their original head structure and medical gear", () => {
  const rider = createRider();
  const doctor = createAssistant("#638d8c");
  try {
    assert.equal(rider.pelican.headRig, null);
    assert(rider.pelican.bird.children.some(node => node.userData.partSlot === "head"));
    assert(rider.pelican.bird.children.some(node => node.userData.partSlot === "beak"));
    const retainedCyclingGear = [];
    doctor.pivot.traverse(node => { if (["head", "wings"].includes(node.userData.partSlot)) retainedCyclingGear.push(node); });
    assert.equal(retainedCyclingGear.length, 0, "doctor kept cycling helmet or riding wings");
    assert(doctor.pivot.getObjectByName("bill-fitted-medical-mask"));
  } finally { disposeModel(rider.group); disposeModel(doctor.pivot); }
});

test("workshop reparenting preserves the head and lays both ordinary and attack beaks horizontally", () => {
  for (const attackBeak of [false, true]) {
    const rider = createRider({ attackBeak });
    try {
      updateRiding(rider, 0);
      rider.group.updateMatrixWorld(true);
      const tagged = [];
      rider.pelican.bird.traverse(node => {
        if (node === rider.pelican.headRig || ["beak", "head"].includes(node.userData.partSlot))
          tagged.push({ node, position: node.getWorldPosition(new THREE.Vector3()) });
      });
      const head = createWorkshopHead(rider);
      rider.group.updateMatrixWorld(true);
      for (const { node, position } of tagged) {
        assert(node.getWorldPosition(new THREE.Vector3()).distanceTo(position) < 1e-6, "head jumped while preparing surgery");
        let ancestor = node;
        while (ancestor && ancestor !== head) ancestor = ancestor.parent;
        assert(ancestor === head, "part of the head was left behind during surgery");
      }
      if (attackBeak) {
        assert.equal(rider.pelican.headRig.parent, head);
        const beak = rider.pelican.attackBeak;
        rider.pelican.group.rotation.z = Math.PI / 2;
        head.rotation.z = Math.PI / 2;
        updateRiding(rider, 0);
        rider.group.updateMatrixWorld(true);
        const delta = tipPosition(beak).sub(beak.getWorldPosition(new THREE.Vector3()));
        assert(delta.x < -6 && Math.abs(delta.y) < 0.3, "long beak did not lie horizontally with the patient");
      }
    } finally { disposeModel(rider.group); }
  }
});
