import test from "node:test";
import assert from "node:assert/strict";
import { createMusic } from "../src/audio/music.js";

const parameter = () => ({
  value: 0,
  setValueAtTime(value) { this.value = value; },
  linearRampToValueAtTime(value) { this.value = value; },
  exponentialRampToValueAtTime(value) { this.value = value; },
  setTargetAtTime(value) { this.value = value; },
});

function fakeAudio() {
  const notes = [], waves = [];
  const node = () => ({ connect() {}, disconnect() {} });
  const context = {
    currentTime: 0,
    notes,
    waves,
    createGain: () => ({ ...node(), gain: parameter() }),
    createBiquadFilter: () => ({ ...node(), frequency: parameter(), Q: parameter() }),
    createBufferSource: () => ({ ...node(), start() {}, stop() {} }),
    createPeriodicWave(_real, imaginary) {
      const wave = { harmonics: [...imaginary] };
      waves.push(wave);
      return wave;
    },
    createOscillator() {
      const source = {
        ...node(),
        frequency: parameter(),
        setPeriodicWave(wave) { this.wave = wave; },
        start(at) {
          notes.push({
            at,
            pitch: Math.round(69 + 12 * Math.log2(this.frequency.value / 440)),
            wave: this.wave,
          });
        },
        stop() {},
      };
      return source;
    },
  };
  return { context, music: createMusic(context, node(), {}) };
}

for (const [mode, bpm] of [["menu", 82], ["race", 112]]) {
  test(`${mode} music changes its notes in the second phrase`, () => {
    const { context, music } = fakeAudio();
    const eighth = 60 / bpm / 2;
    const phrases = [[], []];
    for (let step = 0; step < 64; step++) {
      context.currentTime = step * eighth;
      const before = context.notes.length;
      music.update(mode);
      phrases[Math.floor(step / 32)].push(context.notes.slice(before).map(({ pitch }) => pitch));
    }
    assert(phrases[0].flat().length > 0, `${mode} scheduled no notes`);
    assert(phrases[1].flat().length > 0, `${mode} scheduled no second phrase`);
    assert.notDeepEqual(phrases[1], phrases[0], `${mode} repeats the same 32 steps`);
    assert(context.waves.some(({ harmonics }) => harmonics.slice(2).some((gain) => gain > 0)),
      `${mode} has no upper harmonics`);
    assert(context.notes.every(({ wave }) => wave), `${mode} did not use its instrument waves`);
  });
}

test("off stops scheduling and music schedules again on resume", () => {
  const { context, music } = fakeAudio();
  music.update("menu");
  const beforeOff = context.notes.length;
  assert(beforeOff > 0);
  music.update("off");
  for (let second = 1; second <= 3; second++) {
    context.currentTime = second;
    music.update("off");
  }
  assert.equal(context.notes.length, beforeOff, "off scheduled more notes");
  music.update("menu");
  for (let step = 1; step <= 4; step++) {
    context.currentTime = 3 + step * (60 / 82 / 2);
    music.update("menu");
  }
  assert(context.notes.length > beforeOff, "resume scheduled no music");
});
