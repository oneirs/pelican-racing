import { workshopGrab } from "../animation/workshop-grab.js?v=combat-48";
import { createWorkshopSparks } from "../effects/workshop-sparks.js?v=combat-48";
import THREE from "../core/three.js?v=combat-48";
import { createRider } from "../models/rider.js?v=beak-54";
import { updateRiding } from "../animation/riding.js?v=beak-54";
import { disposeModel } from "../models/dispose.js?v=combat-48";
import { createWorkshopRoom } from "../world/workshop/room.js?v=combat-48";
import { createAssistant } from "../world/workshop/assistant.js?v=beak-54";
import {
  createWorkshopSequence,
  WORKSHOP_PHASES,
} from "../animation/workshop-sequence.js?v=combat-48";
const smooth = (t) => t * t * (3 - 2 * t),
  mix = (a, b, t) => a + (b - a) * t;

export function createWorkshopHead(rider) {
  const head = new THREE.Group();
  head.position.set(0.06, 3.95, 0);
  const bird = rider.pelican.bird;
  bird.updateMatrixWorld(true);
  const nodes = bird.children.filter((node) => {
    // Include the articulated attack head as one connected assembly, even if
    // an equipped beak extends below the ordinary head's height threshold.
    if (node === rider.pelican.headRig || ["beak", "head"].includes(node.userData.partSlot))
      return true;
    const bounds = new THREE.Box3().setFromObject(node);
    return !bounds.isEmpty() && bounds.min.y > 3.72;
  });
  bird.add(head);
  bird.updateMatrixWorld(true);
  nodes.forEach(node => head.attach(node));
  return head;
}

export function createGaragePreview(
  container,
  { onPhase = () => {}, onCommit = () => {}, onFinish = () => {} } = {},
) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
  scene.add(new THREE.HemisphereLight("#e5f6f0", "#b39a74", 2.3));
  const sun = new THREE.DirectionalLight("#fff4dc", 3);
  sun.position.set(-5, 10, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -9,
    right: 9,
    top: 8,
    bottom: -8,
    near: 0.1,
    far: 35,
  });
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const room = createWorkshopRoom(scene);
  const sparks = createWorkshopSparks(scene);
  const helpers = [createAssistant("#4f8e89"), createAssistant("#cb9c60")];
  helpers.forEach((h) => scene.add(h.pivot));
  const scientist = createAssistant("#758f7a", { scientist: true });
  scene.add(scientist.pivot);
  const player = new THREE.Group(),
    bike = new THREE.Group();
  // One shared turntable preserves the original rider/bicycle alignment.
  const display = new THREE.Group();
  display.position.z = 2.75;
  scene.add(display);
  display.add(player, bike);
  const roomMaterials = new Set();
  for (const root of [room.room, scientist.pivot])
    root.traverse((node) => {
      for (const material of node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : [])
        roomMaterials.add(material);
    });
  function revealRoom(amount) {
    room.room.visible = amount > 0.001;
    room.room.position.z = 0;
    for (const material of roomMaterials) {
      material.transparent = amount < 1;
      material.opacity = amount;
      material.depthWrite = amount > 0.95;
    }
    room.light.intensity *= amount;
  }
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.6, 0.12, 64),
    new THREE.MeshStandardMaterial({ color: "#d3dbca", roughness: 0.9 }),
  );
  platform.position.set(0, -0.11, 2.75);
  platform.receiveShadow = true;
  scene.add(platform);
  player.scale.setScalar(0.75);
  bike.scale.setScalar(0.75);
  let rider,
    angle = 0.12,
    drag = false,
    lastX = 0,
    lastTime = null;
  const sequence = createWorkshopSequence({ onPhase, onCommit, onFinish });
  const status = document.getElementById("workshop-status");
  const progress = document.getElementById("operation-progress");
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  container.addEventListener("pointerdown", (e) => {
    if (sequence.state.busy) return;
    drag = true;
    lastX = e.clientX;
    container.setPointerCapture(e.pointerId);
  });
  container.addEventListener("pointermove", (e) => {
    if (!drag) return;
    angle += (e.clientX - lastX) * 0.008;
    lastX = e.clientX;
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    container.addEventListener(event, () => (drag = false));
  container.addEventListener("keydown", (e) => {
    if (!sequence.state.busy && ["ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      angle += e.key === "ArrowLeft" ? -0.15 : 0.15;
    }
  });
  function pose(time) {
    const { phase, progress: p, busy } = sequence.state,
      t = smooth(p);
    const stage = WORKSHOP_PHASES.findIndex((step) => step[0] === phase);
    const reveal = phase === "appear" ? t : phase === "return" ? 1 - t : busy ? 1 : 0;
    // Frame the rider and bicycle at a fixed size. Long weapon reach must not
    // recenter the turntable or shrink the pelican using whole-model bounds.
    const d = Math.max(7.2, 6.7 / camera.aspect);
    const wide = Math.max(13.5, 12.7 / camera.aspect);
    camera.position.set(0, mix(3.6, 3.8, reveal), mix(2.75 + d, wide, reveal));
    camera.lookAt(0, 1.95, mix(2.75, 0, reveal));
    display.rotation.y = angle * (1 - reveal);
    platform.visible = reveal < 1;
    document.querySelector(".doctor-caption").style.opacity = String(reveal);

    const grabPose = workshopGrab(p);
    const lying =
      phase === "press" ? grabPose.turn : phase === "return" ? 1 - t : stage >= 2 ? 1 : 0;
    const transfer = phase === "press" ? grabPose.transfer : lying;
    const lift = phase === "press" ? grabPose.lift : 0;
    const pushed = phase === "push" ? t : stage >= 4 ? 1 : 0;
    const returning = phase === "return" ? t : 0;
    const cartX = 0;
    const cartZ = mix(2.6 - pushed * 3.8, -2.3, returning);
    room.stretcher.position.set(cartX, 0, cartZ);
    room.wheels.forEach((w) => (w.rotation.x = (cartZ + 2.3) / 0.2));
    const closed =
      phase === "close"
        ? t
        : phase === "work"
          ? 1
          : phase === "open"
            ? 1 - t
            : 0;
    const walk =
      busy && ["push", "curtain", "return"].includes(phase)
        ? Math.abs(Math.sin(time * 11)) * 0.04
        : 0;
    for (let i = 0; i < 2; i++) {
      const h = helpers[i],
        side = i === 0 ? -1 : 1;
      // Both doctors keep their hands on the stretcher end handles while rolling.
      const handleReach = 2.3 + 0.92 * (0.16 + 0.44);
      const reach = phase === "strap" ? 1.65 : phase === "push" ? mix(1.65, handleReach, t) : handleReach;
      let hx = cartX + side * reach,
        hz = cartZ - 0.25;
      if (phase === "curtain") {
        hx = mix(hx, side * 4.05, t);
        hz = mix(hz, -1.2, t);
      }
      if (["close", "work", "open"].includes(phase)) {
        hx = side * mix(4.05, 0.85, closed);
        hz = -1.2;
      }
      if (phase === "return") {
        hx = mix(side * 4.05, hx, t);
        hz = mix(-1.2, hz, t);
      }
      const grab = phase === "press" ? grabPose.grip : 1;
      if (phase === "appear" || phase === "press") {
        hx = cartX + side * 1.65;
        hz = cartZ - 0.25;
      }
      h.pivot.visible = busy;
      h.pivot.position.set(hx, walk, hz);
      h.pivot.rotation.y = side === -1 ? 0 : -Math.PI;
      const holding = phase === "push" ? t : 0;
      h.arms.forEach((arm, armIndex) => {
        arm.rotation.z = phase === "press" ? mix(-0.45, -0.85, grab) : phase === "strap" ? -0.85 : phase === "push" ? mix(-0.85, 0, t) : lying * -0.3;
        if (phase === "appear") arm.rotation.z = mix(0, -0.45, t);
        arm.position.x =
          0.16 + (phase === "appear" ? 0.4 * t : phase === "press" ? mix(0.4, 0.55, grab) : phase === "strap" ? 0.55 : phase === "push" ? 0.55 * (1 - t) : phase === "close" || phase === "open" ? 0.3 : 0);
        arm.position.y = mix(2.59, 2.73 - walk, holding) + lift;
        arm.position.z = (armIndex === 0 ? -1 : 1) * mix(0.79, 0.6, holding);
      });
      h.updateArms();
    }
    const startX = -0.525;
    player.position.set(
      mix(startX, cartX, transfer),
      mix(1.875, 1.79, transfer) + lift,
      mix(0, cartZ - 3, transfer),
    );
    player.rotation.set(0, 0, (lying * Math.PI) / 2);
    bike.position.set(-3.8 * transfer, 0, 0);
    bike.rotation.y = 0;
    room.straps.visible = [
      "strap",
      "push",
      "curtain",
      "close",
      "work",
      "open",
    ].includes(phase);
    room.straps.scale.y = phase === "strap" ? mix(0.8, 1, t) : 1;
    for (const c of room.curtains) {
      c.mesh.position.x = c.side * mix(3.5, 1.875, closed);
      c.mesh.scale.x = mix(0.14, 1, closed);
    }
    const working = phase === "work";
    const doctorApproach =
      phase === "push" ? t : stage >= 4 ? (phase === "return" ? 1 - t : 1) : 0;
    scientist.pivot.visible = reveal > 0.001;
    scientist.pivot.position.set(
      mix(1.7, 0.35, doctorApproach),
      0,
      mix(-2.8, -2.5, doctorApproach) - 2 * (1 - reveal),
    );
    scientist.pivot.rotation.y = -Math.PI / 2;
    scientist.arms[1].position.x =
      0.16 + (working ? Math.sin(time * 32) * 0.14 : 0);
    scientist.updateArms();
    scientist.saw.rotation.z =
      -0.2 + (working ? Math.sin(time * 32) * 0.12 : 0);
    room.light.intensity = working ? 2.2 + Math.sin(time * 15) * 0.3 : 1.5;
    room.bulbMaterial.emissiveIntensity = working ? 1.4 : 0.8;
    room.starGroup.visible = false;
    sparks.update(p, working);
    room.starGroup.position.y = working ? Math.sin(time * 3) * 0.06 : 0;
    room.starGroup.children.forEach(
      (o) => (o.rotation.z = time * 0.8 + o.userData.phase),
    );
    revealRoom(reveal);
    container.dataset.phase = phase;
    status.textContent = busy
      ? phase === "press" ? (p < 0.25 ? "伸手抓稳" : p < 0.62 ? "抬起并转向担架" : "缓缓放上担架") : sequence.state.label
      : "拖动旋转预览 · 选择下方部件";
    progress.hidden = !busy;
    progress.value = busy ? (stage + p) / WORKSHOP_PHASES.length : 0;
    if (rider) {
      updateRiding(rider, 0.7, 0, 0, time);
      rider.workshopHead.rotation.z = (lying * Math.PI) / 2;
    }
  }
  return {
    select(selection) {
      if (rider) {
        disposeModel(rider.pelican.group);
        disposeModel(rider.group);
      }
      rider = createRider(selection.character, selection.bicycle);
      rider.workshopHead = createWorkshopHead(rider);
      player.add(rider.pelican.group);
      rider.pelican.group.position.set(0.7, -2.5, 0);
      bike.add(rider.group);
      updateRiding(rider, 0.7);
      resize();
    },
    operate() {
      drag = false;
      return sequence.start();
    },
    skip() {
      sequence.skip();
    },
    get busy() {
      return sequence.state.busy;
    },
    render(time) {
      const dt =
        lastTime === null ? 0 : Math.min(0.05, Math.max(0, time - lastTime));
      lastTime = time;
      if (!document.hidden) sequence.update(dt);
      pose(time);
      renderer.render(scene, camera);
    },
  };
}
