const midi = note => 440 * 2 ** ((note - 69) / 12);

// Original, locally synthesized 16-bar scores. Four-bar ideas recur with small answers.
const tempos = { menu: 82, race: 112 };
const menuHarmony = {
  C: [48, 52, 55, 59], G: [43, 47, 50, 55],
  Am: [45, 48, 52, 55], F: [41, 45, 48, 52],
  Em: [40, 43, 47, 50], Dm: [38, 41, 45, 48],
  G7: [43, 47, 50, 53],
};
const raceHarmony = {
  Em: [40, 43, 47], C: [36, 40, 43],
  G: [43, 47, 50], D: [38, 42, 45],
  Am: [45, 48, 52], B7: [47, 51, 54, 57],
};

// Eight eighth-notes per bar; the ending leads back into the opening.
const menuBars = [
  ["C",  [72, null, 76, null, 79, null, 76, null]],
  ["G",  [71, null, 74, null, 79, null, 74, null]],
  ["Am", [72, null, 76, null, 79, null, 76, null]],
  ["F",  [69, null, 72, null, 76, 74, 72, null]],
  ["C",  [72, null, 76, null, 79, null, 84, null]],
  ["G",  [74, null, 71, null, 74, null, 79, null]],
  ["F",  [72, null, 76, null, 79, null, 76, null]],
  ["G7", [71, null, 74, null, 77, 74, 71, null]],
  ["Am", [72, null, 76, null, 81, null, 79, null]],
  ["Em", [71, null, 74, null, 79, null, 76, null]],
  ["F",  [72, null, 77, null, 81, null, 77, null]],
  ["C",  [72, null, 76, null, 79, null, 76, null]],
  ["Dm", [74, null, 77, null, 81, null, 77, null]],
  ["G7", [71, null, 74, null, 77, null, 74, null]],
  ["C",  [72, null, 76, null, 79, null, 84, null]],
  ["C",  [72, null, 76, null, 79, 76, 72, null]],
];
const raceBars = [
  ["Em", [76, null, 79, null, 83, null, 79, null]],
  ["C",  [76, null, 79, null, 84, null, 79, null]],
  ["G",  [74, null, 79, null, 83, null, 79, null]],
  ["D",  [78, null, 81, null, 86, null, 81, null]],
  ["Em", [76, null, 79, null, 83, 86, 83, null]],
  ["C",  [76, null, 79, null, 84, null, 79, null]],
  ["Am", [76, null, 81, null, 84, null, 81, null]],
  ["B7", [75, null, 78, null, 83, 78, 75, null]],
  ["C",  [76, null, 79, null, 84, null, 79, null]],
  ["G",  [74, null, 79, null, 83, null, 79, null]],
  ["D",  [78, null, 81, null, 86, null, 81, null]],
  ["Em", [76, null, 79, null, 83, null, 86, null]],
  ["Am", [72, null, 76, null, 81, null, 76, null]],
  ["B7", [75, null, 78, null, 83, null, 78, null]],
  ["Em", [76, null, 79, null, 83, 86, 83, null]],
  ["Em", [76, null, 79, null, 83, 79, 76, null]],
];

// Each instrument uses one oscillator. Custom waves add restrained harmonics
// without adding oscillator nodes for every note.
const instruments = {
  menuPad: { fallback: "sine", partials: [0, 1, 0.16, 0.07], attack: 0.28, release: 0.52, body: 0.78 },
  menuLead: { fallback: "sine", partials: [0, 1, 0.34, 0.12, 0.04], attack: 0.045, release: 0.24, body: 0.84 },
  menuPluck: { fallback: "triangle", partials: [0, 1, 0.3, 0.12], attack: 0.01, release: 0.18, body: 0.48 },
  menuBass: { fallback: "triangle", partials: [0, 1, 0.28, 0.09], attack: 0.015, release: 0.25, body: 0.72 },
  racePad: { fallback: "triangle", partials: [0, 1, 0.23, 0.12, 0.04], attack: 0.16, release: 0.4, body: 0.72 },
  raceLead: { fallback: "triangle", partials: [0, 1, 0.48, 0.22, 0.08], attack: 0.025, release: 0.21, body: 0.78 },
  raceBass: { fallback: "triangle", partials: [0, 1, 0.42, 0.18, 0.05], attack: 0.012, release: 0.16, body: 0.7 },
  raceAnswer: { fallback: "sine", partials: [0, 1, 0.25, 0.08], attack: 0.025, release: 0.17, body: 0.62 },
  kick: { fallback: "sine", partials: [0, 1, 0.06], attack: 0.005, release: 0.09, body: 0.62 },
};

export function createMusic(context, output, noise) {
  // Keep these as the first two nodes; existing audio tests inspect them.
  const buses = {
    menu: context.createGain(),
    race: context.createGain(),
  };
  for (const bus of Object.values(buses)) {
    bus.gain.value = 0;
    bus.connect(output);
  }
  const waves = Object.fromEntries(Object.entries(instruments).map(([name, instrument]) => [
    name,
    context.createPeriodicWave?.(
      new Float32Array(instrument.partials.length),
      new Float32Array(instrument.partials),
    ),
  ]));
  let mode = "off", nextTime = 0, duck = 1;
  const positions = { menu: 0, race: 0 };

  function tone(note, at, length, level, name, bus) {
    const instrument = instruments[name];
    const source = context.createOscillator(), amp = context.createGain();
    if (waves[name] && source.setPeriodicWave) source.setPeriodicWave(waves[name]);
    else source.type = instrument.fallback;
    source.frequency.setValueAtTime(midi(note), at);
    const peak = at + Math.min(instrument.attack, length * 0.25);
    const release = at + Math.max(length * 0.5, length - instrument.release);
    const settle = Math.min(release, peak + Math.min(0.12, length * 0.15));
    amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(level, peak);
    amp.gain.linearRampToValueAtTime(level * instrument.body, settle);
    amp.gain.setValueAtTime(level * instrument.body, release);
    amp.gain.linearRampToValueAtTime(0, at + length);
    source.connect(amp);
    amp.connect(bus);
    source.onended = () => { source.disconnect(); amp.disconnect(); };
    source.start(at);
    source.stop(at + length + 0.01);
  }

  function drum(at, length, level, frequency, type, bus) {
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), amp = context.createGain();
    source.buffer = noise;
    filter.type = type;
    filter.frequency.value = frequency;
    amp.gain.setValueAtTime(level, at);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(bus);
    source.onended = () => { source.disconnect(); filter.disconnect(); amp.disconnect(); };
    source.start(at);
    source.stop(at + length + 0.01);
  }

  function scheduleMenu(index, at) {
    const bar = Math.floor(index / 8), pulse = index % 8;
    const [name, melody] = menuBars[bar];
    const chord = menuHarmony[name], section = Math.floor(bar / 4);
    const beat = 60 / tempos.menu / 2;
    if (pulse === 0) {
      for (const note of chord.slice(1))
        tone(note + 12, at, beat * 7.9, section === 2 ? 0.018 : 0.014, "menuPad", buses.menu);
      tone(chord[0] - 12, at, beat * 3.6, 0.086, "menuBass", buses.menu);
    }
    if (pulse === 4 && section !== 3)
      tone(chord[0] - 5, at, beat * 2.8, 0.038, "menuBass", buses.menu);
    if (melody[pulse] !== null)
      tone(melody[pulse], at, beat * (pulse === 7 ? 0.85 : 2.12), 0.059, "menuLead", buses.menu);
    // One or two quiet answers per bar leave space around the recurring tune.
    if ((section === 1 || section === 2) && (pulse === 3 || (section === 2 && pulse === 7)))
      tone(chord[pulse === 3 ? 1 : 2] + 12, at, beat * 1.05,
        0.019, "menuPluck", buses.menu);
    else if ((section === 0 || section === 3) && pulse === 7)
      tone(chord[2] + 12, at, beat * 0.9, 0.014, "menuPluck", buses.menu);
    if (pulse === 2 || pulse === 6)
      drum(at, 0.052, section === 2 ? 0.020 : 0.013, 3800, "highpass", buses.menu);
    if (bar % 4 === 3 && pulse === 7)
      drum(at, 0.095, 0.018, 1800, "bandpass", buses.menu);
  }

  function scheduleRace(index, at) {
    const bar = Math.floor(index / 8), pulse = index % 8;
    const [name, melody] = raceBars[bar];
    const chord = raceHarmony[name], section = Math.floor(bar / 4);
    const beat = 60 / tempos.race / 2;
    if (pulse === 0) {
      for (const note of chord.slice(1))
        tone(note + 12, at, beat * 7.8, section === 2 ? 0.017 : 0.013,
          "racePad", buses.race);
    }
    if (pulse % 2 === 0) {
      const bass = pulse === 6 && section >= 1 ? chord[1] : chord[0];
      tone(bass - 12, at, beat * 1.7, pulse === 0 ? 0.088 : 0.068,
        "raceBass", buses.race);
    }
    if (melody[pulse] !== null)
      tone(melody[pulse], at, beat * (pulse === 7 ? 0.8 : 2.06),
        section === 1 ? 0.067 : 0.06, "raceLead", buses.race);
    // A single answer in the middle sections adds depth without rushing the lead.
    if ((section === 1 || section === 2) && pulse === 3)
      tone(chord[1] + 24, at, beat * 1.15, 0.022, "raceAnswer", buses.race);
    if (pulse === 0 || pulse === 4) {
      tone(36, at, 0.17, pulse === 0 ? 0.092 : 0.068, "kick", buses.race);
      drum(at, 0.052, 0.064, 180, "lowpass", buses.race);
    }
    if (pulse === 2 || pulse === 6)
      drum(at, 0.09, 0.067, 1500, "highpass", buses.race);
    if (pulse % 2 === 1)
      drum(at, 0.035, section === 2 ? 0.021 : 0.015, 5000, "highpass", buses.race);
    if (bar % 4 === 3 && pulse === 7)
      drum(at, 0.08, 0.027, 590, "bandpass", buses.race);
  }

  function setLevels() {
    for (const [name, bus] of Object.entries(buses))
      bus.gain.setTargetAtTime(name === mode ? (name === "menu" ? 0.7 * duck : 0.8) : 0, context.currentTime, 0.12);
  }

  return {
    update(requestedMode) {
      if (requestedMode !== mode) {
        mode = requestedMode;
        nextTime = context.currentTime + 0.025;
        setLevels();
      }
      if (mode === "off") return;
      const interval = 60 / tempos[mode] / 2;
      if (nextTime < context.currentTime - interval) nextTime = context.currentTime + 0.025;
      for (let scheduled = 0; nextTime < context.currentTime + 0.12 && scheduled < 2; scheduled++) {
        (mode === "menu" ? scheduleMenu : scheduleRace)(positions[mode] % 128, nextTime);
        positions[mode]++;
        nextTime += interval;
      }
    },
    duck(value) {
      duck = value;
      setLevels();
    },
  };
}
