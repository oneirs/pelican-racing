import test from "node:test";
import assert from "node:assert/strict";
import { bindSettings } from "../src/ui/settings.js";

test("settings pause an active ride and preserve an already paused ride", () => {
  const previous = globalThis.document;
  let open, onClose, focused = false;
  const dialog = {
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; onClose(); },
    addEventListener(event, handler) { if (event === "close") onClose = handler; },
  };
  const closeButton = {};
  globalThis.document = {
    getElementById: (id) => id === "game-settings" ? dialog : closeButton,
    querySelectorAll: () => [{ addEventListener(event, handler) { open = handler; } }],
    querySelector: () => ({ focus() { focused = true; } }),
  };
  try {
    const state = { screen: "race", running: true };
    bindSettings(state);
    open();
    assert.equal(state.running, false);
    assert.equal(state.settingsOpen, true);
    open(); // Opening twice must not overwrite the original running state.
    closeButton.onclick();
    assert.equal(state.running, true);
    assert.equal(state.settingsOpen, false);
    assert(focused);
    state.running = false;
    open();
    dialog.close(); // Escape follows the native dialog close event too.
    assert.equal(state.running, false);
    state.screen = "menu";
    open();
    dialog.close();
    assert.equal(state.running, false);
  } finally {
    globalThis.document = previous;
  }
});
