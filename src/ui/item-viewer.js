import { requiresSurgery } from "../game/upgrade-actions.js?v=combat-48";
import { formatItemWeight } from "../game/upgrades.js?v=durability-57";
import { formatItemDurability } from "../game/durability.js?v=durability-57";
import THREE from "../core/three.js?v=combat-48";
import { createItemModel } from "../models/item-preview.js?v=durability-57";
import { disposeModel } from "../models/dispose.js?v=combat-48";

export function createItemViewer(onEquip, progress) {
  const dialog = document.getElementById("item-dialog");
  const viewport = document.getElementById("item-viewport");
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
  scene.add(new THREE.HemisphereLight(0xf2fcff, 0xaca282, 2.8));
  const light = new THREE.DirectionalLight(0xfff1db, 3);
  light.position.set(-3, 5, 5);
  scene.add(light);
  let model,
    selected,
    angle = -0.2,
    tilt = 0,
    zoom = 1,
    drag = false,
    lastX = 0,
    lastY = 0;
  const cache = new Map();
  function load(selection, slot, item) {
    if (model) disposeModel(model);
    model = createItemModel(selection, slot.id, item.id);
    scene.add(model);
    angle = -0.2;
    tilt = 0;
    zoom = 1;
  }
  function draw(width, height) {
    if (!model || width <= 0 || height <= 0) return;
    if (
      renderer.domElement.style.width !== `${width}px` ||
      renderer.domElement.style.height !== `${height}px`
    ) {
      renderer.setSize(width, height);
    }
    camera.aspect = width / height;
    const halfFov = Math.atan(
      Math.tan((Math.PI * 35) / 360) * Math.min(1, camera.aspect),
    );
    const d = (model.userData.radius / Math.sin(halfFov)) * 1.12 * zoom;
    camera.position.set(d * 0.36, d * 0.18, d * 0.92);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    model.rotation.set(tilt, angle, 0);
    renderer.render(scene, camera);
  }
  function close() {
    dialog.close();
  }
  document.getElementById("close-item").onclick = close;
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  document.getElementById("equip-item").onclick = () => {
    const { slot, item } = selected;
    close();
    onEquip(slot.id, item.id);
  };
  document.getElementById("item-turn-left").onclick = () => (angle -= 0.3);
  document.getElementById("item-turn-right").onclick = () => (angle += 0.3);
  document.getElementById("item-zoom-in").onclick = () =>
    (zoom = Math.max(0.6, zoom - 0.12));
  document.getElementById("item-zoom-out").onclick = () =>
    (zoom = Math.min(1.8, zoom + 0.12));
  document.getElementById("item-view-reset").onclick = () => {
    angle = -0.2;
    tilt = 0;
    zoom = 1;
  };
  viewport.addEventListener("pointerdown", (event) => {
    drag = true;
    lastX = event.clientX;
    lastY = event.clientY;
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!drag) return;
    angle += (event.clientX - lastX) * 0.012;
    tilt = Math.max(-1, Math.min(1, tilt + (event.clientY - lastY) * 0.008));
    lastX = event.clientX;
    lastY = event.clientY;
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    viewport.addEventListener(event, () => (drag = false));
  viewport.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      zoom = Math.max(0.6, Math.min(1.8, zoom + event.deltaY * 0.001));
    },
    { passive: false },
  );
  return {
    thumbnail(selection, slot, item) {
      const key = JSON.stringify([selection, slot.id, item.id]);
      if (cache.has(key)) return cache.get(key);
      load(selection, slot, item);
      draw(220, 155);
      const url = renderer.domElement.toDataURL("image/png");
      if (cache.size >= 60) cache.delete(cache.keys().next().value);
      cache.set(key, url);
      return url;
    },
    open(selection, slot, item) {
      selected = { slot, item };
      load(selection, slot, item);
      document.getElementById("item-name").textContent = item.name;
      document.getElementById("item-slot").textContent =
        `${slot.owner} / ${slot.name}`;
      const weight = document.createElement("strong");
      weight.className = "item-weight";
      weight.textContent = formatItemWeight(slot, item);
      document.getElementById("item-changes").replaceChildren(weight, document.createElement("br"), document.createTextNode(formatItemDurability(slot, item, selection.parts)), document.createElement("br"), document.createTextNode(item.changes));
      document.getElementById("item-effect").textContent = item.effect;
      const installed = selection.parts[slot.id] === item.id;
      const equip = document.getElementById("equip-item");
      const owned = !progress || progress.owns(slot.id, item.id);
      const price = progress?.price(slot.id, item.id) ?? 0;
      equip.textContent = installed ? "已装配" : !owned ? `解锁并装配 · ${price} 积分` : requiresSurgery(slot.id) ? "改造此部位" : "更换此物品";
      equip.disabled = installed || (!owned && progress.points < price);
      viewport.appendChild(renderer.domElement);
      dialog.showModal();
    },
    render() {
      if (dialog.open) {
        const rect = viewport.getBoundingClientRect();
        draw(rect.width, rect.height);
      }
    },
  };
}
