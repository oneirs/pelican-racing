import { createProgression } from "../game/progression.js?v=progress-59";
import { requiresSurgery, hasBodyChanges } from "../game/upgrade-actions.js?v=combat-48";
import { formatItemDurability } from "../game/durability.js?v=durability-57";
import { createItemViewer } from "./item-viewer.js?v=progress-59";
import {
  SLOTS,
  buildLoadout,
  computeTuning,
  formatItemWeight,
  normalizeParts,
} from "../game/upgrades.js?v=durability-57";
import {
  CHARACTERS,
  BICYCLES,
  loadSelection,
  saveSelection,
} from "../game/garage.js?v=durability-57";
import { createGaragePreview } from "./garage-preview.js?v=beak-54";

export function createMainMenu(state, { start, home, sound }) {
  const menu = document.getElementById("main-menu"),
    race = document.getElementById("race-ui");
  let storage;
  try {
    storage = localStorage;
  } catch {
    /* Storage can be disabled. */
  }
  let selection = loadSelection(storage),
    pendingSelection = null;
  const progress = createProgression(storage, selection.parts);
  state.progression = progress;
  const modifyButton = document.getElementById("modify-player");
  const skipButton = document.getElementById("skip-operation");
  function lock(busy) {
    menu.dataset.operating = String(busy);
    document.getElementById("start-ride").disabled = busy;
    modifyButton.disabled = busy;
    skipButton.hidden = !busy;
    for (const control of document.querySelectorAll(
      ".garage-panel button, .garage-panel input, .garage-panel select",
    ))
      control.disabled = busy;
    if (!busy)
      for (const button of document.querySelectorAll(
        '.part-option[aria-pressed="true"]',
      ))
        button.disabled = true;
  }
  const preview = createGaragePreview(
    document.getElementById("garage-preview"),
    {
      onPhase(phase) {
        sound?.workshop(phase);
      },
      onCommit() {
        if (pendingSelection) {
          selection = pendingSelection;
          pendingSelection = null;
          refresh();
          saveSelection(storage, selection);
          lock(true);
        }
      },
      onFinish() {
        sound?.stopWorkshop();
        lock(false);
        modifyButton.focus({ preventScroll: true });
      },
    },
  );
  function beginOperation(nextSelection = selection) {
    if (preview.busy) return;
    pendingSelection = nextSelection;
    lock(true);
    preview.operate();
  }
  modifyButton.onclick = () => {
    activeSlot = requiresSurgery(activeSlot) ? activeSlot : "thighs";
    refreshParts();
    document.querySelector(".part-option:not(:disabled)")?.focus({ preventScroll: true });
  };
  skipButton.onclick = () => preview.skip();
  const itemViewer = createItemViewer(equipPart, progress);
  let activeSlot = "thighs";
  const slotButtons = [];
  const characterButtons = [],
    bikeButtons = [];
  function choices(items, field, containerId, buttons) {
    const container = document.getElementById(containerId);
    for (const item of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "garage-option";
      button.style.setProperty("--swatch", item.accent ?? item.color);
      button.innerHTML = `<span class="option-swatch" aria-hidden="true"></span><span><strong>${item.name}</strong><small>${item.tag}</small></span><span class="option-check" aria-hidden="true">✓</span>`;
      button.addEventListener("click", () => {
        selection = { ...selection, [field]: item };
        refresh();
        saveSelection(storage, selection);
      });
      container.appendChild(button);
      buttons.push({ button, item });
    }
  }
  for (const id of [
    "thighs",
    "head",
    "beak",
    "wings",
    "frame",
    "tires",
    "drive",
    "rocket",
    "handlebar",
    "weapon",
  ]) {
    const slot = SLOTS.find((slot) => slot.id === id);
    const button = document.createElement("button");
    button.textContent = slot.name;
    button.type = "button";
    button.onclick = () => {
      activeSlot = slot.id;
      refreshParts();
    };
    document
      .getElementById({ "鹈鹕": "pelican-slots", "自行车": "bicycle-slots", "道具": "item-slots", "武器": "weapon-slots" }[slot.owner])
      .appendChild(button);
    slotButtons.push({ slot, button });
  }
  function equipPart(slotId, itemId) {
    if (selection.parts[slotId] === itemId || preview.busy) return;
    if (!progress.unlock(slotId, itemId)) return;
    const next = {
      ...selection,
      parts: { ...selection.parts, [slotId]: itemId },
    };
    if (requiresSurgery(slotId)) beginOperation(next);
    else applySelection(next);

  }
  function refreshParts() {
    const slot = SLOTS.find((slot) => slot.id === activeSlot);
    for (const { slot, button } of slotButtons)
      button.setAttribute("aria-pressed", String(slot.id === activeSlot));
    document.getElementById("active-slot-name").textContent =
      `${slot.name}${slot.owner === "道具" ? "道具" : slot.owner === "武器" ? "（限装备一个）" : "改装"}`;
    const container = document.getElementById("part-options");
    container.replaceChildren();
    for (const item of slot.items) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "part-option";
      const installed = selection.parts[slot.id] === item.id;
      const owned = progress.owns(slot.id, item.id), price = progress.price(slot.id, item.id);
      const action = installed ? "已装配 ✓" : !owned ? `解锁 ${price} 积分` : (requiresSurgery(slot.id) ? "点击改造" : "直接更换");
      button.setAttribute("aria-pressed", String(installed));
      button.innerHTML = `<span class="part-name">${item.name}<small>${action}</small></span><span class="part-changes"><strong class="part-weight">${formatItemWeight(slot, item)}</strong><br>${formatItemDurability(slot, item, selection.parts)}<br>${item.changes}</span><span class="part-effect">${item.effect}</span>`;
      button.disabled = installed || (!owned && progress.points < price);
      button.onclick = () => equipPart(slot.id, item.id);
      const card = document.createElement("article");
      card.className = "part-card";
      const inspect = document.createElement("button");
      inspect.type = "button";
      inspect.className = "part-preview-button";
      inspect.setAttribute("aria-label", `预览${item.name}`);
      const image = document.createElement("img");
      image.src = itemViewer.thumbnail(selection, slot, item);
      image.alt = "";
      const label = document.createElement("span");
      label.textContent = "3D 预览 ↗";
      inspect.append(image, label);
      inspect.onclick = () => itemViewer.open(selection, slot, item);
      card.append(inspect, button);
      container.appendChild(card);
    }
    const tuning = computeTuning(selection.parts),
      base = computeTuning();
    const metrics = [
      ["质量", "mass", " kg", 1],
      ["驱动力", "driveForce", " N", 0],
      ["速度上限", "maxSpeedKmh", " km/h", 0],
      ["轮胎抓地", "grip", "", 2],
      ["空气阻力", "drag", "", 3],
      ["转向响应", "steering", "×", 2],
      ["失控门槛", "crashThreshold", " m/s", 2],
      ["恢复时限", "recoveryTime", " s", 2],
    ];
    document.getElementById("current-attributes").innerHTML = [
      ["速度上限", tuning.maxSpeedKmh.toFixed(0), "km/h"],
      ["总质量", tuning.mass.toFixed(1), "kg"],
      ["驱动力", tuning.driveForce.toFixed(0), "N"],
      ["转向", tuning.steering.toFixed(2), "×"],
      ["抓地", tuning.grip.toFixed(2), ""],
      ["风阻", tuning.drag.toFixed(3), ""],
    ].map(([name, value, unit]) => `<div><span>${name}</span><strong>${value}<small>${unit}</small></strong></div>`).join("");
    document.getElementById("tuning-stats").innerHTML = metrics
      .map(([name, key, unit, precision]) => {
        const change = (tuning[key] / base[key] - 1) * 100;
        return `<div><span>${name}</span><strong>${tuning[key].toFixed(precision)}<small>${unit}</small></strong><em>${Math.abs(change) < 0.05 ? "原装基准" : `${change > 0 ? "+" : ""}${change.toFixed(0)}%`}</em></div>`;
      })
      .join("");
  }
  function applySelection(next) {
    selection = next;
    refresh();
    saveSelection(storage, selection);
  }
  document.getElementById("reset-parts").onclick = () => {
    if (preview.busy) return;
    const next = { ...selection, parts: normalizeParts() };
    if (hasBodyChanges(selection.parts, next.parts)) beginOperation(next);
    else applySelection(next);
  };
  function refresh() {
    document.getElementById("garage-points").textContent = `积分 ${progress.points}`;
    for (const [buttons, field] of [
      [characterButtons, "character"],
      [bikeButtons, "bicycle"],
    ])
      for (const { button, item } of buttons)
        button.setAttribute(
          "aria-pressed",
          String(selection[field].id === item.id),
        );
    document.getElementById("preview-name").textContent =
      selection.character.name;
    document.getElementById("preview-bike").textContent =
      selection.bicycle.name;
    document.getElementById("character-detail").textContent =
      selection.character.description;
    document.getElementById("bike-detail").textContent =
      selection.bicycle.description;
    document.getElementById("loadout-summary").textContent =
      `${Object.values(selection.parts).filter((id) => id !== "standard").length} / ${SLOTS.length} 个部位已改装 · ${selection.character.name}`;
    refreshParts();
    preview.select(buildLoadout(selection));
  }
  function show() {
    state.screen = "menu";
    state.running = false;
    document.body.dataset.screen = "menu";
    menu.hidden = false;
    race.hidden = true;
    document.getElementById("scene").setAttribute("aria-hidden", "true");
    home();
    refresh();
    document.getElementById("start-ride").focus({ preventScroll: true });
  }
  choices(CHARACTERS, "character", "character-options", characterButtons);
  choices(BICYCLES, "bicycle", "bike-options", bikeButtons);
  refresh();
  const startButton = document.getElementById("start-ride");
  startButton.disabled = false;
  startButton.innerHTML = '开始骑行 <span aria-hidden="true">↗</span>';
  startButton.onclick = () => {
    if (preview.busy) return;
    sound?.stopWorkshop();
    start(buildLoadout(selection));
    state.screen = "race";
    state.running = true;
    document.body.dataset.screen = "race";
    menu.hidden = true;
    race.hidden = false;
    const canvas = document.querySelector("#scene canvas");
    canvas.tabIndex = -1;
    canvas.focus();
    document.getElementById("scene").removeAttribute("aria-hidden");
    document.getElementById("riding-loadout").textContent =
      `${selection.character.name} · ${selection.bicycle.name}`;
  };
  document.getElementById("back-home").onclick = show;
  return {
    update(time) {
      if (state.screen === "menu") {
        preview.render(time);
        itemViewer.render();
      }
    },
    show,
  };
}
