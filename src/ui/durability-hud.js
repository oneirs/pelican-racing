import { DURABILITY_PARTS } from "../game/durability.js?v=durability-57";

const number = (value) => Number.isInteger(value) ? String(value) : value.toFixed(1);

export function createDurabilityHud() {
  const panel = document.getElementById("durability-panel");
  const rows = document.getElementById("durability-rows");
  const rivalHeading = document.getElementById("durability-rival-heading");
  let signature = "", playerVersion, rivalVersion;
  let entries = [];

  function cell(label, owner) {
    const element = document.createElement("td");
    const value = document.createElement("span");
    const bar = document.createElement("progress");
    bar.setAttribute("aria-label", `${owner}${label}耐久`);
    element.append(value, bar);
    return { element, value, bar };
  }

  function showPart(view, part, rival = false) {
    view.element.hidden = rival && rivalHeading.hidden;
    view.bar.hidden = !part;
    view.value.textContent = part ? `${number(part.current)}/${number(part.max)}` : "—";
    view.element.dataset.broken = String(!!part?.broken);
    view.element.dataset.low = String(!!part && part.current / part.max <= 0.3);
    if (!part) {
      view.element.title = "未装配此部位";
      return;
    }
    view.bar.max = part.max;
    view.bar.value = part.current;
    view.bar.setAttribute("aria-valuetext", `${number(part.current)} / ${number(part.max)}${part.broken ? " · 已损坏" : ""}`);
    view.element.title = part.broken ? "此部位已损坏" : "当前耐久 / 最大耐久";
  }

  return function update(state) {
    const player = state.partDurability, rival = state.rival?.partDurability;
    const parts = DURABILITY_PARTS.filter(({ id }) => player?.parts[id] || rival?.parts[id]);
    panel.hidden = parts.length === 0;
    const nextSignature = parts.map(({ id }) => `${id}:${player?.parts[id]?.max ?? ""}:${rival?.parts[id]?.max ?? ""}`).join("|");
    if (nextSignature !== signature) {
      signature = nextSignature;
      entries = parts.map(({ id, label }) => {
        const row = document.createElement("tr");
        const name = document.createElement("th");
        name.scope = "row";
        name.textContent = label;
        const own = cell(label, "玩家"), other = cell(label, "AI");
        row.append(name, own.element, other.element);
        return { id, row, own, other };
      });
      rows.replaceChildren(...entries.map(({ row }) => row));
    } else if (player?.version !== undefined && player.version === playerVersion && rival?.version === rivalVersion) return;
    rivalHeading.hidden = !rival;
    for (const entry of entries) {
      showPart(entry.own, player?.parts[entry.id]);
      showPart(entry.other, rival?.parts[entry.id], true);
    }
    playerVersion = player?.version;
    rivalVersion = rival?.version;
  };
}
