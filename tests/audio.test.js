import test from "node:test";
import assert from "node:assert/strict";
import { createSound } from "../src/audio/sound.js";

test("audio starts only after interaction; pause, mute, visibility and collision resets behave correctly", async () => {
  const originals = Object.fromEntries(
    ["window", "document", "localStorage"].map((key) => [key, globalThis[key]]),
  );
  const handlers = new Map(),
    toggles = [{}, {}],
    sliders = [{}, {}],
    bell = {};
  for (const element of [...toggles, ...sliders])
    element.setAttribute = () => {};
  let saved = null,
    built = 0,
    context;
  const parameter = () => ({
    value: 0,
    setTargetAtTime(v) {
      this.value = v;
    },
    setValueAtTime(v) {
      this.value = v;
    },
    linearRampToValueAtTime(v) {
      this.peak = v;
      this.value = v;
    },
    exponentialRampToValueAtTime(v) {
      this.value = v;
    },
  });
  const node = () => ({ connect() {}, disconnect() {} });
  class FakeContext {
    constructor() {
      built++;
      context = this;
      this.state = "suspended";
      this.currentTime = 0;
      this.sampleRate = 8000;
      this.destination = node();
      this.gains = [];
      this.filters = [];
      this.voices = 0;
    }
    addEventListener() {}
    async resume() {
      this.state = "running";
    }
    createGain() {
      const result = { ...node(), gain: parameter() };
      this.gains.push(result);
      return result;
    }
    createDynamicsCompressor() {
      return {
        ...node(),
        threshold: parameter(),
        knee: parameter(),
        ratio: parameter(),
      };
    }
    createBuffer(channels, length) {
      return { getChannelData: () => new Float32Array(length) };
    }
    createBiquadFilter() {
      const filter = { ...node(), frequency: parameter(), Q: parameter() };
      this.filters.push(filter);
      return filter;
    }
    createBufferSource() {
      this.voices++;
      return {
        ...node(),
        start() {},
        stop() {
          this.onended?.();
        },
      };
    }
    createOscillator() {
      this.voices++;
      return {
        ...node(),
        frequency: parameter(),
        start() {},
        stop() {
          this.onended?.();
        },
      };
    }
  }
  globalThis.window = { AudioContext: FakeContext };
  globalThis.document = {
    hidden: false,
    querySelectorAll: (s) => (s.includes("toggle") ? toggles : sliders),
    getElementById: () => bell,
    addEventListener: (type, handler) => handlers.set(type, handler),
  };
  globalThis.localStorage = {
    getItem: () => saved,
    setItem: (_, value) => (saved = value),
  };
  try {
    const sound = createSound();
    assert.equal(built, 0, "page load must not auto-start audio");
    await toggles[0].onclick();
    assert.equal(built, 1);
    assert.equal(context.state, "running");
    const state = {
      screen: "race",
      running: true,
      velocity: 130,
      grounded: false,
      time: 1,
      collisionCount: 0,
      crashed: false,
    };
    sound.update(state);
    assert(context.gains[1].gain.value > 0, "no speed-driven wind");
    assert(context.gains[7].gain.value > 0 && context.gains[6].gain.value === 0,
      "race music did not replace menu music");
    state.running = false;
    sound.update(state);
    assert.equal(context.gains[1].gain.value, 0, "pause left wind audible");
    assert.equal(context.gains[7].gain.value, 0, "pause left race music audible");
    state.running = true;
    context.currentTime = 1;
    state.collisionCount = 1;
    const before = context.voices;
    sound.update(state);
    assert(context.voices > before, "collision sound missing");
    const once = context.voices;
    sound.update(state);
    assert.equal(context.voices, once, "same collision repeated");
    state.collisionCount = 0;
    state.time = 0;
    sound.update(state);
    assert.equal(context.voices, once, "restart played a false collision");
    state.grounded = true;
    state.cadenceRpm = 60;
    state.phase = 0;
    sound.update(state);
    let pedalBefore = context.voices;
    state.phase = Math.PI;
    sound.update(state);
    assert.equal(context.voices - pedalBefore, 2, "one stroke should play one pedal/chain pair");
    const unchanged = context.voices;
    sound.update(state);
    assert.equal(context.voices, unchanged, "same pedal stroke repeated");
    state.cadenceRpm = 180;
    for (let i = 2; i <= 4; i++) { state.phase = i * Math.PI; sound.update(state); }
    assert.equal(context.voices - unchanged, 6, "faster strokes must produce more pedal sounds");
    state.braking = true;
    sound.update(state);
    assert(context.gains[3].gain.value > 0, "brake friction loop missing");
    const brakeBefore = context.voices;
    state.phase += Math.PI;
    sound.update(state);
    assert.equal(context.voices, brakeBefore, "pedaling should stop during braking");
    state.braking = false;
    state.cadenceRpm = 0;
    sound.update(state);
    assert.equal(context.gains[3].gain.value, 0, "brake release left friction audible");
    // Speed affects volume smoothly, with a bounded maximum at racing speed.
    state.velocity = 0; state.cadenceRpm = 60;
    for (let i = 0; i < 50; i++) { state.time += 0.1; sound.update(state); }
    state.phase += Math.PI; sound.update(state);
    const quietPedal = context.gains.at(-2).gain.peak;
    state.velocity = 500 / 3.6;
    state.time += 0.1; state.phase += Math.PI; sound.update(state);
    const firstRise = context.gains.at(-2).gain.peak;
    for (let i = 0; i < 50; i++) { state.time += 0.1; sound.update(state); }
    state.phase += Math.PI; sound.update(state);
    const fastPedal = context.gains.at(-2).gain.peak;
    assert(quietPedal < firstRise && firstRise < fastPedal, "pedal volume did not rise smoothly");
    assert(fastPedal <= 0.075 && fastPedal < quietPedal * 2, "pedal volume is too loud");
    assert(context.gains[4].gain.value > 0 && context.gains[5].gain.value > 0, "layered wind missing");
    state.running = false; sound.update(state);
    assert.equal(context.gains[4].gain.value, 0);
    assert.equal(context.gains[5].gain.value, 0);
    state.running = true;
    state.grounded = false;
    state.cadenceRpm = 0;
    state.beakEquipped = true;
    state.beakSwings = state.beakHits = 0;
    sound.update(state);
    const beakBefore = context.voices;
    state.beakSwings = state.beakHits = 1;
    // A beak is the only equipped attack: stale gun counters must stay silent.
    state.weaponShots = state.weaponBlasts = state.gatlingShots = state.gatlingHits = 1;
    sound.update(state);
    assert.equal(context.voices - beakBefore, 3, "beak swing and impact should play without gunfire");
    const beakOnce = context.voices;
    sound.update(state);
    assert.equal(context.voices, beakOnce, "same beak attack repeated its sound");
    state.beakSwings = state.beakHits = 0;
    sound.update(state);
    assert.equal(context.voices, beakOnce, "beak counter reset played a false attack");
    state.beakSwings = state.beakHits = 1;
    sound.update(state);
    assert.equal(context.voices - beakOnce, 3, "beak sound did not resume after a counter reset");
    const countRasps = () => context.filters.filter(f => f.type === "lowpass" && f.frequency.value === 2400).length;
    const countBeakHits = () => context.filters.filter(f => f.type === "lowpass" && f.frequency.value === 3600).length;
    const beakRasps = countRasps(), beakHits = countBeakHits();
    state.running = false;
    state.beakSwings = state.beakHits = 2;
    sound.update(state);
    assert.equal(countRasps(), beakRasps, "paused beak swing created sound");
    assert.equal(countBeakHits(), beakHits, "paused beak hit created sound");
    state.running = true;
    sound.update(state);
    assert.equal(countRasps(), beakRasps, "resume replayed a paused beak swing");
    assert.equal(countBeakHits(), beakHits, "resume replayed a paused beak hit");
    state.beakEquipped = false;
    state.beakSwings = state.beakHits = 3;
    sound.update(state);
    assert.equal(countRasps(), beakRasps, "unequipped beak created swing sound");
    assert.equal(countBeakHits(), beakHits, "unequipped beak created hit sound");
    state.beakEquipped = true;
    await toggles[0].onclick();
    assert.equal(context.gains[0].gain.value, 0, "mute did not silence master");
    assert.equal(JSON.parse(saved).muted, true);
    const silent = context.voices;
    state.collisionCount = 1;
    state.beakSwings = state.beakHits = 4;
    context.currentTime = 2;
    sound.update(state);
    assert.equal(context.voices, silent, "muted collision created sound");
    assert.equal(countRasps(), beakRasps, "muted beak swing created sound");
    assert.equal(countBeakHits(), beakHits, "muted beak hit created sound");
    await toggles[1].onclick();
    document.hidden = true;
    handlers.get("visibilitychange")();
    assert.equal(context.gains[0].gain.value, 0);
    state.beakSwings = state.beakHits = 5;
    sound.update(state);
    assert.equal(countRasps(), beakRasps, "hidden beak swing created sound");
    assert.equal(countBeakHits(), beakHits, "hidden beak hit created sound");
    document.hidden = false;
    handlers.get("visibilitychange")();
    assert(context.gains[0].gain.value > 0);
    sound.update(state);
    assert.equal(countRasps(), beakRasps, "returning to the tab replayed a beak swing");
    assert.equal(countBeakHits(), beakHits, "returning to the tab replayed a beak hit");
    state.screen = "menu";
    sound.update(state);
    assert.equal(context.gains[1].gain.value, 0);
    assert(context.gains[6].gain.value > 0 && context.gains[7].gain.value === 0,
      "returning home did not restore menu music");
    const beforeWorkshop = context.voices;
    await sound.workshop("work");
    assert(
      context.voices > beforeWorkshop,
      "workshop tools must produce sound after interaction",
    );
    assert(context.filters.some((f) => f.type === "bandpass" && f.Q.value === 2.4), "vocal resonance for pelican cries is missing");
    assert(context.filters.some((f) => f.type === "lowpass" && f.frequency.value >= 4300), "sharp saw rasp is missing");
    sound.stopWorkshop();
    await toggles[0].onclick();
    sound.update(state);
    assert.equal(context.gains[6].gain.value, 0, "mute left menu music audible");
    const mutedWorkshop = context.voices;
    await sound.workshop("work");
    assert.equal(
      context.voices,
      mutedWorkshop,
      "muted workshop must remain silent",
    );
    document.hidden = true;
    await sound.workshop("strap");
    assert.equal(
      context.voices,
      mutedWorkshop,
      "background workshop must stay silent",
    );
  } finally {
    for (const [key, value] of Object.entries(originals))
      value === undefined ? delete globalThis[key] : (globalThis[key] = value);
  }
});
