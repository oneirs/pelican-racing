import { obstaclePlacement } from "../world/endless/obstacles.js?v=coast-55";
import {
  loadMap,
  normalizeMap,
  saveMap,
  MAP_DEFAULTS,
  MAPS,
  getMapDefinition,
} from "../game/map-settings.js?v=coast-55";
import { createEndlessPath } from "../world/endless/path.js?v=coast-55";
const LABELS = {
  straight: "笔直赛道",
  gentle: "舒缓弯道",
  sweeping: "连续大弯",
  off: "无障碍",
  light: "稀疏",
  normal: "标准",
  dense: "密集",
};
export function createMapEditor(state) {
  let storage;
  try {
    storage = localStorage;
  } catch {}
  state.mapSettings = loadMap(storage);
  state.seed = state.mapSettings.seed;
  const canvas = document.getElementById("map-preview"),
    ctx = canvas.getContext("2d");
  const fields = [
    "mapId",
    "width",
    "curves",
    "obstacles",
    "seed",
    "destruction",
    "sparks",
    "speedEffects",
  ];
  const editor = document.getElementById("map-editor"),
    equipment = document.getElementById("equipment-editor");
  const open = document.getElementById("open-map-editor"),
    garage = document.getElementById("open-equipment-editor");
  const mapSelect = document.getElementById("map-mapId");
  mapSelect.replaceChildren(...MAPS.map(map => {
    const option = document.createElement("option");
    option.value = map.id; option.textContent = map.name + (map.training ? " · 单人训练" : " · 竞速");
    return option;
  }));
  function mode(map) {
    editor.hidden = !map;
    equipment.hidden = map;
    open.setAttribute("aria-pressed", String(map));
    garage.setAttribute("aria-pressed", String(!map));
    document.getElementById("workshop-title").textContent = map
      ? "地图工坊"
      : "改装工坊";
  }
  open.onclick = () => mode(true);
  garage.onclick = () => mode(false);
  function render() {
    const settings = state.mapSettings,
      path = createEndlessPath(settings.seed, settings),
      map = getMapDefinition(settings);
    for (const key of fields) {
      const field = document.getElementById("map-" + key);
      if (field.type === "checkbox") field.checked = settings[key];
      else field.value = settings[key];
    }
    document.getElementById("map-summary").textContent =
      `${map.description} · ${settings.width} 米宽 · ${LABELS[settings.curves]} · ${settings.obstacles === "off" ? "无障碍" : LABELS[settings.obstacles] + "障碍"}`;
    const heading = editor.querySelector(".map-preview-heading");
    heading.querySelector("strong").textContent = map.name;
    heading.querySelector("span").textContent = map.training ? "实时生成 · 单人训练" : "5 公里竞速 · 8 人赛道 · AI 对手";
    canvas.setAttribute(
      "aria-label",
      `${map.name}前方 700 米预览，${settings.width} 米宽，${LABELS[settings.curves]}，${LABELS[settings.obstacles]}，${map.training ? "单人训练" : "AI 竞速"}`,
    );
    const w = canvas.width,
      h = canvas.height;
    const preview = {
      coast: ["#dbcaa0", "#5cafb2", "#98d2cb", "#acc48d", "#fff7dc", "#586f73", "#f6efce", "#23484b"],
      canyon: ["#dfa16d", "#ad563e", "#c88254", "#be7950", "#ffe5bb", "#755953", "#ffe5bb", "#653f31"],
      neon: ["#252b42", "#30394f", "#70cbdc", "#1c2339", "#70e5ec", "#253148", "#e16eeb", "#cff8ff"],
    }[map.id];
    ctx.fillStyle = preview[0];
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = preview[1];
    ctx.fillRect(0, 0, w * 0.23, h);
    ctx.fillStyle = preview[2];
    ctx.fillRect(w * 0.23, 0, w * 0.045, h);
    ctx.fillStyle = preview[3];
    ctx.fillRect(w * 0.8, 0, w * 0.2, h);
    const point = (d) => [
      w * 0.53 + path.center(d) * 2,
      h - 24 - (d / 700) * (h - 48),
    ];
    const stroke = (color, width) => {
      ctx.beginPath();
      for (let d = 0; d <= 700; d += 2) {
        const [x, y] = point(d);
        d ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    stroke(preview[4], settings.width * 2 + 5);
    stroke(preview[5], settings.width * 2);
    ctx.setLineDash([4, 7]);
    stroke(preview[6], 1);
    ctx.setLineDash([]);
    for (let i = 0; i < 11; i++) {
      const placement = obstaclePlacement(path, i);
      if (!placement) continue;
      const [x, y] = point(placement.distance);
      ctx.fillStyle = "#ef9653";
      ctx.fillRect(x + placement.lane * 2 - 3, y - 3, 6, 6);
    }
    ctx.fillStyle = "#e88954";
    const [x, y] = point(0);
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x - 5, y + 4);
    ctx.lineTo(x + 5, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = preview[7];
    ctx.font = "12px sans-serif";
    ctx.fillText("前方 700 m", 18, 24);
    ctx.fillText(map.training ? "单人训练 · 无 AI" : "5 公里竞速 · AI 同场竞速", 18, h - 16);
  }
  function commit() {
    state.mapSettings = normalizeMap(state.mapSettings);
    state.seed = state.mapSettings.seed;
    saveMap(storage, state.mapSettings);
    render();
  }
  for (const key of fields)
    document.getElementById("map-" + key).onchange = (event) => {
      const input = event.target;
      state.mapSettings = {
        ...state.mapSettings,
        [key]:
          input.type === "checkbox"
            ? input.checked
            : ["width", "seed"].includes(key)
              ? Number(input.value)
              : input.value,
      };
      commit();
    };
  document.getElementById("random-map").onclick = () => {
    state.mapSettings.seed =
      (Math.imul(state.mapSettings.seed, 1664525) + 1013904223) >>> 0;
    commit();
  };
  document.getElementById("reset-map").onclick = () => {
    state.mapSettings = { ...MAP_DEFAULTS };
    commit();
  };
  render();
  return {
    refresh: render,
    saveSeed(seed) {
      state.mapSettings.seed = seed;
      saveMap(storage, state.mapSettings);
      render();
    },
  };
}
