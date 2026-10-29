import test from "node:test";
import assert from "node:assert/strict";
import { createDurability } from "../src/game/durability.js";
import { createDurabilityHud } from "../src/ui/durability-hud.js";

function fixture() {
  const nodes = new Map();
  function element() {
    return {
      children: [], dataset: {}, attributes: new Map(), hidden: false,
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      setAttribute(key, value) { this.attributes.set(key, value); },
    };
  }
  const previous = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, element());
      return nodes.get(id);
    },
    createElement: element,
  };
  const update = createDurabilityHud();
  return {
    update,
    node: (id) => nodes.get(id),
    row: (label) => nodes.get("durability-rows").children.find(row => row.children[0].textContent === label),
    restore() {
      if (previous === undefined) delete globalThis.document;
      else globalThis.document = previous;
    },
  };
}

test("durability HUD distinguishes player and AI parts and updates damage, breakage and repair", () => {
  const ui = fixture(), player = createDurability(), rival = createDurability({ head: "guard" });
  const state = { partDurability: player.read(), rival: { partDurability: rival.read() } };
  try {
    ui.update(state);
    assert.equal(ui.node("durability-panel").hidden, false);
    assert.equal(ui.node("durability-rows").children.length, 12);
    const head = ui.row("头部");
    assert.equal(head.children[1].children[0].textContent, "240/240");
    assert.equal(head.children[2].children[0].textContent, "360/360");
    const wing = ui.row("左翅"), own = wing.children[1], other = wing.children[2];
    player.damage("wing-left", 120);
    state.partDurability = player.read();
    ui.update(state);
    assert.equal(ui.row("左翅"), wing, "damage should update existing rows instead of rebuilding the table");
    assert.equal(own.children[0].textContent, "40/160");
    assert.equal(own.children[1].value, 40);
    assert.equal(own.children[1].max, 160);
    assert.equal(own.dataset.low, "true");
    assert.equal(other.children[0].textContent, "160/160", "player damage leaked into AI");
    assert.equal(ui.row("右翅").children[1].children[0].textContent, "160/160");
    player.damage("wing-left", 40);
    state.partDurability = player.read();
    ui.update(state);
    assert.equal(own.dataset.broken, "true");
    assert.match(own.children[1].attributes.get("aria-valuetext"), /已损坏/);
    player.tick(5);
    state.partDurability = player.read();
    ui.update(state);
    assert.equal(own.children[0].textContent, "160/160");
    assert.equal(own.dataset.broken, "false");
    assert.equal(own.dataset.low, "false");
  } finally { ui.restore(); }
});

test("durability HUD shows only installed parts and removes AI and stale loadout rows", () => {
  const ui = fixture(), player = createDurability({ weapon: "attack-beak" });
  const rival = createDurability({ weapon: "gatling", rocket: "boost" });
  const state = { partDurability: player.read(), rival: { partDurability: rival.read() } };
  try {
    ui.update(state);
    assert.equal(ui.node("durability-rows").children.length, 14);
    const weapon = ui.row("武器");
    assert.equal(weapon.children[1].children[0].textContent, "—");
    assert.equal(weapon.children[1].children[1].hidden, true, "uninstalled player weapon displayed a bar");
    assert.equal(weapon.children[2].children[0].textContent, "200/200");
    assert.equal(ui.row("喙").children[1].children[0].textContent, "225/225");
    state.rival = null;
    ui.update(state);
    assert.equal(ui.node("durability-rival-heading").hidden, true);
    assert.equal(ui.node("durability-rows").children.length, 12);
    assert.equal(ui.row("武器"), undefined, "AI-only weapon stayed after leaving the race");
    for (const row of ui.node("durability-rows").children)
      assert.equal(row.children[2].hidden, true, "single-player mode left an AI column");
    state.partDurability = createDurability({ weapon: "launcher" }).read();
    ui.update(state);
    assert.equal(ui.row("武器").children[1].children[0].textContent, "200/200");
    state.partDurability = null;
    ui.update(state);
    assert.equal(ui.node("durability-panel").hidden, true);
    assert.equal(ui.node("durability-rows").children.length, 0);
  } finally { ui.restore(); }
});
