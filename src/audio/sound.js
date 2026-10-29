import { createMusic } from "./music.js?v=coast-55";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const KEY = "pelican-audio-v1";

// All sound is synthesized locally; no audio downloads are required.
export function createSound() {
  let volume = 0.45,
    muted = false,
    context,
    master,
    compressor,
    wind,
    rolling,
    brakeNoise,
    windGust,
    windAir,
    noise,
    music;
  let lastCollision = 0,
    lastCrash = false,
    lastTime = 0,
    lastPedalStep = null,
    lastBrakeTick = -1,
    lastHit = -1,
    wasRiding = false;
  let pedalSpeed = 0;
  let lastShot = 0, lastBlast = 0, lastGatlingShot = 0, lastGatlingHit = 0;
  let lastBeakSwing = 0, lastBeakHit = 0;
  let ready = false;
  let workshopToken = 0;
  const active = new Set();
  const AudioContextType = window.AudioContext ?? window.webkitAudioContext;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Number.isFinite(saved?.volume)) volume = clamp(saved.volume, 0, 1);
    muted = saved?.muted === true;
  } catch {
    /* Sound works even when storage is disabled. */
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ volume, muted }));
    } catch {}
  }
  function sync() {
    for (const button of document.querySelectorAll("[data-audio-toggle]")) {
      button.textContent = !AudioContextType
        ? "声音不可用"
        : muted
          ? "声音：关"
          : ready
            ? "声音：开"
            : "开启声音";
      button.setAttribute("aria-pressed", String(ready && !muted));
      button.disabled = !AudioContextType;
    }
    for (const input of document.querySelectorAll("[data-audio-volume]")) {
      input.value = Math.round(volume * 100);
      input.disabled = !AudioContextType;
      input.setAttribute("aria-valuetext", `${Math.round(volume * 100)}%`);
    }
  }
  function gain(param, value, delay = 0.045) {
    if (!context) return;
    param.setTargetAtTime(value, context.currentTime, delay);
  }
  function updateMaster() {
    if (master)
      gain(master.gain, document.hidden || muted ? 0 : volume * 0.55, 0.015);
  }
  function makeLoop(type, frequency, q) {
    const source = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      amp = context.createGain();
    source.buffer = noise;
    source.loop = true;
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    amp.gain.value = 0;
    source.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    source.start(0, Math.random() * 1.8);
    return { source, filter, amp };
  }
  function build() {
    context = new AudioContextType();
    master = context.createGain();
    master.gain.value = 0;
    compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    master.connect(compressor);
    compressor.connect(context.destination);
    noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    wind = makeLoop("lowpass", 900, 0.4);
    rolling = makeLoop("bandpass", 180, 0.8);
    brakeNoise = makeLoop("bandpass", 2600, 2.2);
    windGust = makeLoop("bandpass", 320, 0.55);
    windAir = makeLoop("bandpass", 2400, 0.6);
    music = createMusic(context, master, noise);
    context.addEventListener("statechange", () => {
      ready = context.state === "running";
      sync();
    });
  }
  async function unlock() {
    if (!AudioContextType) return false;
    try {
      if (!context) build();
      if (context.state !== "running") await context.resume();
      ready = context.state === "running";
      updateMaster();
      sync();
      return ready;
    } catch {
      ready = false;
      sync();
      return false;
    }
  }
  function voice(
    frequency,
    duration,
    level,
    type = "sine",
    offset = 0,
    endFrequency = frequency,
  ) {
    if (!ready || muted || document.hidden || active.size >= 24) return;
    const start = context.currentTime + offset,
      amp = context.createGain();
    const source =
      type === "noise"
        ? context.createBufferSource()
        : context.createOscillator();
    let filter;
    if (type === "noise") {
      source.buffer = noise;
      filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = frequency;
      source.connect(filter);
      filter.connect(amp);
    } else {
      source.type = type === "cry" ? "sawtooth" : type;
      source.frequency.setValueAtTime(frequency, start);
      if (type === "cry") {
        // A nasal, rising-then-falling gull cry with a vocal-like resonance.
        source.frequency.exponentialRampToValueAtTime(frequency * 2.5, start + duration * 0.22);
        filter = context.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1800;
        filter.Q.value = 2.4;
        source.connect(filter);
        filter.connect(amp);
      } else source.connect(amp);
      source.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFrequency),
        start + duration,
      );
    }
    amp.gain.setValueAtTime(0, start);
    amp.gain.linearRampToValueAtTime(level, start + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    amp.connect(master);
    active.add(source);
    source.onended = () => {
      active.delete(source);
      source.disconnect();
      filter?.disconnect();
      amp.disconnect();
    };
    source.start(start);
    source.stop(start + duration + 0.025);
  }
  function bell() {
    voice(1480, 0.7, 0.16);
    voice(2220, 0.5, 0.065);
    voice(1480, 0.5, 0.11, "sine", 0.13);
  }
  function click() {
    voice(650, 0.055, 0.05, "sine", 0, 420);
  }
  function equip() {
    voice(300, 0.075, 0.07, "triangle");
    voice(650, 0.08, 0.06, "triangle", 0.06);
    voice(950, 0.12, 0.06, "sine", 0.12);
  }
  function silenceRide() {
    if (!context) return;
    gain(wind.amp.gain, 0, 0.025);
    gain(windGust.amp.gain, 0, 0.025);
    gain(windAir.amp.gain, 0, 0.025);
    pedalSpeed = 0;
    gain(rolling.amp.gain, 0, 0.025);
    gain(brakeNoise.amp.gain, 0, 0.015);
    lastPedalStep = null;
  }
  function stopTransient() {
    for (const source of active) {
      try {
        source.stop();
      } catch {}
    }
  }
  function stopWorkshop() {
    workshopToken++;
    stopTransient();
    music?.duck(1);
  }
  async function workshop(phase) {
    stopWorkshop();
    const token = workshopToken;
    if (!(await unlock()) || token !== workshopToken || document.hidden) return;
    music?.duck(phase === "work" ? 0.28 : 1);
    if (["push", "curtain", "return"].includes(phase)) {
      for (let i = 0; i < 4; i++) voice(110, 0.09, 0.07, "sine", i * 0.12, 55);
    } else if (phase === "appear") {
      voice(130, 0.12, 0.08, "noise");
    } else if (phase === "press") {
      voice(200, 0.32, 0.065, "triangle", 0, 450);
      voice(600, 0.18, 0.05, "noise", 0.2);
    } else if (phase === "strap") {
      voice(1500, 0.07, 0.08, "noise");
      voice(700, 0.09, 0.05, "triangle", 0.1, 300);
    } else if (phase === "close" || phase === "open") {
      voice(1100, 0.3, 0.09, "noise");
      if (phase === "open") {
        voice(650, 0.16, 0.07, "sine", 0.3);
        voice(980, 0.3, 0.06, "sine", 0.45);
      }
    } else if (phase === "work") {
      // Uneven overlapping scrapes, clanks and cries: no regular beat.
      const jitter = () => (Math.random() - 0.5) * 0.035;
      for (const [at, duration, frequency] of [
        [0, 0.23, 5700], [0.09, 0.08, 4400], [0.29, 0.31, 6300],
        [0.47, 0.12, 5100], [0.72, 0.22, 5900],
      ]) {
        const start = Math.max(0, at + jitter());
        voice(frequency, duration, 0.13 + Math.random() * 0.06, "noise", start);
        voice(1700 + Math.random() * 2200, duration * 0.85, 0.045, "sawtooth", start + 0.012, 650 + Math.random() * 900);
      }
      for (const [at, frequency] of [[0.16, 920], [0.22, 1900], [0.56, 630], [0.83, 2400]]) {
        voice(frequency, 0.09, 0.08, "triangle", at + jitter(), frequency * 0.4);
        voice(4200, 0.025, 0.045, "noise", at);
      }
      for (const [at, duration, pitch] of [[0.045, 0.32, 590], [0.38, 0.2, 760], [0.67, 0.29, 520]]) {
        voice(pitch, duration, 0.16, "cry", at + jitter(), 270 + Math.random() * 180);
        voice(pitch * 1.5, duration * 0.9, 0.033, "triangle", at, 430);
      }
    }
  }
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!event.target.closest("[data-audio-toggle]")) void unlock();
    },
    { capture: true },
  );
  document.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    const editable = event.target.closest("input,textarea,select,button");
    if (!editable) void unlock();
    if (event.code === "KeyB" && !editable) {
      void unlock().then((ok) => {
        if (ok) bell();
      });
    }
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    if (
      button.matches(
        "[data-audio-toggle],#bike-bell,.part-option,#equip-item,#modify-player,#skip-operation",
      )
    )
      return;
    const kind = button.matches(".part-option,#equip-item,.garage-option")
      ? "equip"
      : button.id === "start-ride"
        ? "bell"
        : "click";
    void unlock().then((ok) => {
      if (ok) ({ equip, bell, click })[kind]();
    });
  });
  for (const button of document.querySelectorAll("[data-audio-toggle]"))
    button.onclick = async () => {
      if (!ready) {
        muted = false;
        await unlock();
      } else {
        muted = !muted;
        updateMaster();
      }
      save();
      sync();
      if (!muted) click();
    };
  for (const input of document.querySelectorAll("[data-audio-volume]"))
    input.oninput = () => {
      volume = clamp(Number(input.value) / 100, 0, 1);
      if (volume > 0) muted = false;
      void unlock();
      updateMaster();
      save();
      sync();
    };
  const bellButton = document.getElementById("bike-bell");
  if (bellButton) bellButton.onclick = () =>
    void unlock().then((ok) => {
      if (ok) bell();
    });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      silenceRide();
      stopTransient();
      music?.update("off");
    }
    updateMaster();
  });
  sync();
  return {
    workshop,
    stopWorkshop,
    update(state) {
      const riding =
        state.screen === "race" && state.running && !document.hidden;
      const reset =
        state.time < lastTime || (state.collisionCount ?? 0) < lastCollision;
      const beakReset = reset || (state.beakSwings ?? 0) < lastBeakSwing || (state.beakHits ?? 0) < lastBeakHit;
      if (!ready) {
        lastShot = state.weaponShots ?? 0; lastBlast = state.weaponBlasts ?? 0;
        lastGatlingShot = state.gatlingShots ?? 0; lastGatlingHit = state.gatlingHits ?? 0;
        lastBeakSwing = state.beakSwings ?? 0; lastBeakHit = state.beakHits ?? 0;
        lastCollision = state.collisionCount ?? 0;
        lastCrash = !!state.crashed;
        lastTime = state.time;
        return;
      }
      music.update(document.hidden || muted ? "off" : state.screen === "menu" ? "menu" : riding ? "race" : "off");
      if (!riding) {
        silenceRide();
        if (wasRiding) stopTransient();
      } else {
        const speed = clamp(state.velocity / (500 / 3.6), 0, 1),
          moving = clamp(state.velocity / 8, 0, 1);
        gain(wind.filter.frequency, 550 + speed * 1800, 0.12);
        const gust = 0.72 + 0.18 * Math.sin(state.time * 1.7) + 0.1 * Math.sin(state.time * 4.3);
        gain(wind.amp.gain, moving * (0.025 + speed * 0.19), 0.18);
        gain(windGust.filter.frequency, 180 + speed * 420 + gust * 90, 0.25);
        gain(windGust.amp.gain, moving * (0.008 + speed * 0.027) * gust, 0.2);
        gain(windAir.filter.frequency, 1700 + speed * 2200, 0.2);
        gain(windAir.amp.gain, moving * speed * 0.025 * (0.85 + 0.15 * Math.sin(state.time * 3.1)), 0.18);
        const elapsed = reset ? 0 : clamp(state.time - lastTime, 0, 0.1);
        pedalSpeed += (speed - pedalSpeed) * (1 - Math.exp(-elapsed / 0.65));
        const pedalLevel = 0.04 + pedalSpeed * 0.035;
        gain(rolling.filter.frequency, 100 + speed * 550, 0.1);
        gain(
          rolling.amp.gain,
          state.grounded && !state.crashed
            ? moving * (0.035 + speed * 0.065)
            : 0,
          0.05,
        );
        const braking = state.braking && state.grounded && !state.crashed && state.velocity > 0.4;
        gain(brakeNoise.filter.frequency, 1600 + speed * 2900, 0.035);
        gain(brakeNoise.amp.gain, braking ? 0.035 + moving * 0.065 + (state.rearSkid ?? 0) * 0.025 : 0, 0.02);
        if (braking && context.currentTime - lastBrakeTick > 0.13) {
          voice(1700 + speed * 1100, 0.12, 0.025 + speed * 0.02, "triangle", 0, 900 + speed * 600);
          lastBrakeTick = context.currentTime;
        }
        const pedalStep = Math.floor((state.phase ?? 0) / Math.PI);
        const pedaling = state.grounded && !state.crashed && !braking && (state.cadenceRpm ?? 0) > 0;
        if (pedaling && !reset && lastPedalStep !== null && pedalStep !== lastPedalStep) {
          voice(260, 0.06, pedalLevel, "triangle", 0, 150);
          voice(1200 + state.cadenceRpm * 3, 0.045, pedalLevel * 0.85, "noise", 0.015);
        }
        lastPedalStep = pedaling ? pedalStep : null;
        if (
          !reset &&
          (state.collisionCount ?? 0) > lastCollision &&
          context.currentTime - lastHit > 0.12
        ) {
          const strength = clamp(state.impact ?? 0.3, 0.15, 1);
          voice(170, 0.3, 0.22 * strength, "sine", 0, 45);
          voice(1400, 0.2, 0.18 * strength, "noise");
          if (state.crashed) voice(800, 0.6, 0.08, "noise", 0.025);
          lastHit = context.currentTime;
        }
        if (!reset && !state.beakEquipped && (state.gatlingShots ?? 0) > lastGatlingShot) {
          voice(2600, 0.065, 0.065, "noise", 0, 650);
          voice(150, 0.065, 0.045, "triangle", 0, 65);
          voice(2200, 0.045, 0.035, "noise", 0.025, 900);
        }
        if (!reset && !state.beakEquipped && (state.gatlingHits ?? 0) > lastGatlingHit) voice(3300, 0.075, 0.045, "noise", 0, 1100);
        if (!reset && !state.beakEquipped && (state.weaponShots ?? 0) > lastShot) {
          voice(1800, 0.3, 0.11, "noise", 0, 500);
          voice(160, 0.18, 0.10, "triangle", 0, 60);
        }
        if (!reset && !state.beakEquipped && (state.weaponBlasts ?? 0) > lastBlast) {
          voice(90, 0.45, 0.16, "sine", 0, 32);
          voice(900, 0.35, 0.14, "noise");
        }
        if (state.beakEquipped && !beakReset && (state.beakSwings ?? 0) > lastBeakSwing)
          voice(2400, 0.16, 0.08, "noise");
        if (state.beakEquipped && !beakReset && (state.beakHits ?? 0) > lastBeakHit) {
          voice(230, 0.09, 0.09, "triangle", 0, 75);
          voice(3600, 0.065, 0.06, "noise");
        }
        if (!reset && lastCrash && !state.crashed) {
          voice(520, 0.1, 0.045);
          voice(780, 0.13, 0.04, "sine", 0.1);
        }
      }
      lastShot = state.weaponShots ?? 0; lastBlast = state.weaponBlasts ?? 0;
      lastGatlingShot = state.gatlingShots ?? 0; lastGatlingHit = state.gatlingHits ?? 0;
      lastBeakSwing = state.beakSwings ?? 0; lastBeakHit = state.beakHits ?? 0;
      wasRiding = riding;
      lastCollision = state.collisionCount ?? 0;
      lastCrash = !!state.crashed;
      lastTime = state.time;
    },
  };
}
