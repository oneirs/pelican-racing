import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(new URL("../vendor/three/three.min.js", import.meta.url), "utf8"), context);
const THREE = context.THREE;
globalThis.window = { THREE };
const { createAssistant } = await import("../src/world/workshop/assistant.js");
const { createItemModel } = await import("../src/models/item-preview.js");
const { createCockpit } = await import("../src/models/cockpit.js");
const { createRaceRider } = await import("../src/models/race-rider.js");
const { disposeModel } = await import("../src/models/dispose.js");

test("doctors' shoulder, elbow and wrist stay joined through extended and lifted targets", () => {
  for (const scientist of [false, true]) {
    const doctor = createAssistant("#638d8c", { scientist });
    try {
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        doctor.arms.forEach((arm, j) => {
          arm.position.set(0.16 + 0.55 * t, 2.59 + 0.65 * Math.sin(t * Math.PI), (j ? 1 : -1) * (0.79 - 0.19 * t));
          arm.rotation.z = -0.85 * t;
        });
        doctor.updateArms();
        for (const rig of doctor.armRigs) {
          const endpoint = (mesh, y) => new THREE.Vector3(0, y * mesh.scale.y, 0).applyQuaternion(mesh.quaternion).add(mesh.position);
          assert(endpoint(rig.upper, -0.5).distanceTo(rig.shoulder) < 1e-6);
          assert(endpoint(rig.upper, 0.5).distanceTo(endpoint(rig.lower, -0.5)) < 1e-6);
          assert(endpoint(rig.lower, 0.5).distanceTo(rig.hand.position) < 1e-6);
          assert(Math.abs(rig.upper.scale.y - 0.9) < 1e-6);
          assert(Math.abs(rig.lower.scale.y - 0.85) < 1e-6);
        }
        if (scientist) assert.equal(doctor.saw.parent, doctor.armRigs[1].hand);
      }
    } finally { disposeModel(doctor.pivot); }
  }
});

test("new bicycle items have isolated previews, cockpit geometry and throttle-bound exhaust", () => {
  for (const [slot, ids] of [["weapon", ["standard", "launcher", "homing-launcher", "gatling"]], ["rocket", ["standard", "boost"]], ["handlebar", ["standard", "precision", "agile"]]]) {
    for (const id of ids) {
      const preview = createItemModel({ parts: {}, character: {}, bicycle: {} }, slot, id);
      assert(preview.userData.radius > 0 && Number.isFinite(preview.userData.radius));
      disposeModel(preview);
    }
  }
  for (const part of ["precision", "agile"]) {
    const cockpit = createCockpit(new THREE.PerspectiveCamera(), {}, { handlebarPart: part });
    disposeModel(cockpit.group);
  }
  const rider = createRaceRider(new THREE.Scene(), {}, { rocketPart: "boost" });
  const state = { cameraMode: "third", physicsPose: { x: 0, y: 1, rotation: { x: 0, y: 0, z: 0, w: 1 } }, running: true, grounded: true, throttleInput: 1, time: 1, phase: 0 };
  const flames = []; rider.group.traverse(node => { if (node.name === "rocket-flame") flames.push(node); });
  assert.equal(flames.length, 2);
  rider.update(state); assert(flames.every(f => f.visible));
  state.braking = true; rider.update(state); assert(flames.every(f => !f.visible));
  state.braking = false; state.throttleInput = 0; rider.update(state); assert(flames.every(f => !f.visible));
  rider.dispose();
});

test("held launcher rises smoothly, aims with attached wings, and returns to its mount", async () => {
  const {createRider}=await import("../src/models/rider.js");
  const {createHeldWeapon}=await import("../src/models/held-weapon.js");
  const rider=createRider({}, {weaponPart:"homing-launcher"}), held=createHeldWeapon(rider);
  try {
    held.update({}); const rest=held.gun.position.clone();
    assert(!held.rig.visible);assert(!held.gun.visible);assert(held.gun.scale.x>1);
    let previous=rest;
    for(let i=0;i<=115;i++) {
      held.update({weaponAction:{age:i*.01,fired:i>=48,aim:{dx:1,dy:0,dz:0}}});
      assert(held.gun.position.distanceTo(previous)<.11);
      previous=held.gun.position.clone();
      for(const a of held.arms) {
        const endpoint=(mesh,y)=>new THREE.Vector3(0,y*mesh.scale.y,0).applyQuaternion(mesh.quaternion).add(mesh.position);
        assert(endpoint(a.upper,-.5).distanceTo(a.shoulder)<1e-6);
        assert(endpoint(a.upper,.5).distanceTo(endpoint(a.lower,-.5))<1e-6);
        assert(endpoint(a.lower,.5).distanceTo(a.hand.position)<1e-6);
      }
    }
    held.update({weaponAction:{age:.4,fired:false,aim:{dx:0,dy:0,dz:-1}}});
    assert(held.gun.visible);assert(held.gun.position.z>0,"cannon must rise on right");
    held.update({});assert(held.gun.position.distanceTo(rest)<1e-6);assert(!held.rig.visible);assert(!held.gun.visible);
  }finally{disposeModel(rider.group);}
});
