export function bindRiding(canvas, state, onPause) {
  const keys = new Set(),
    touch = new Set();
  const allowed = new Set([
    "KeyA",
    "KeyD",
    "KeyW",
    "KeyS",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Space",
    "KeyP",
    "KeyE",
    "KeyQ",
    "ShiftLeft",
    "ShiftRight",
  ]);
  const editable = (e) =>
    ["INPUT", "TEXTAREA", "BUTTON", "SELECT"].includes(e.target?.tagName);
  addEventListener("keydown", (e) => {
    if (state.screen !== "race" || state.settingsOpen || editable(e) || !allowed.has(e.code)) return;
    e.preventDefault();
    if (e.code === "KeyP") {
      if (!e.repeat) onPause();
      return;
    }
    if (e.code === "Space") {
      if (!e.repeat && !keys.has(e.code) && state.running && !state.crashed) state.jumpRequested = true;
    }
    keys.add(e.code);
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => {
    keys.clear();
    touch.clear();
    state.brakeInput = state.brakeLatched = false;
    state.looking = false;
    state.jumpRequested = false;
    state.fireRequested = false;
    state.beakAttackRequested = 0;
    state.gatlingHeld = false;
    state.balanceAssistHeld = false;
    state.throttleInput = state.balanceRoll = state.balancePitch = 0;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      keys.clear();
      touch.clear();
      state.brakeInput = state.brakeLatched = false;
      state.looking = false;
      state.jumpRequested = false;
      state.fireRequested = false;
      state.beakAttackRequested = 0;
      state.gatlingHeld = false;
      state.balanceAssistHeld = false;
      state.throttleInput = state.balanceRoll = state.balancePitch = 0;
    }
  });
  for (const [id, sign] of [
    ["left", -1],
    ["right", 1],
    ["accelerate", "forward"],
    ["reverse", "reverse"],
  ]) {
    const button = document.getElementById(id);
    if (!button) continue;
    button.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      touch.add(sign);
      button.setPointerCapture(e.pointerId);
    });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      button.addEventListener(event, () => touch.delete(sign));
  }
  let x = 0,
    y = 0;
  canvas.addEventListener("pointerdown", (e) => {
    state.looking = true;
    x = e.clientX;
    y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!state.looking) return;
    state.lookYaw = Math.max(
      -0.55,
      Math.min(0.55, state.lookYaw - (e.clientX - x) * 0.003),
    );
    state.lookPitch = Math.max(
      -0.18,
      Math.min(0.22, state.lookPitch + (e.clientY - y) * 0.002),
    );
    x = e.clientX;
    y = e.clientY;
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    canvas.addEventListener(event, () => (state.looking = false));
  return function update(dt, path) {
    if (!state.running) {
      keys.clear(); touch.clear();
      state.jumpRequested = false;
      state.fireRequested = false;
      state.beakAttackRequested = 0;
      state.gatlingHeld = false;
      state.balanceAssistHeld = false;
      state.brakeInput = false;
      state.throttleInput = state.balanceRoll = state.balancePitch = state.steerInput = 0;
      state.steerVisual *= Math.exp(-dt * 7);
      return;
    }
    state.balanceAssistHeld = (keys.has("KeyW") || touch.has("forward")) && !keys.has("KeyS");
    const air = state.crashed || !state.grounded;
    const weightOnly = keys.has("ShiftLeft") || keys.has("ShiftRight");
    state.balanceRoll = Number(keys.has("ArrowRight") || touch.has(1)) - Number(keys.has("ArrowLeft") || touch.has(-1));
    state.balancePitch = Number(keys.has("ArrowUp")) - Number(keys.has("ArrowDown"));
    if (state.crashed) {
      state.jumpRequested = false;
      state.fireRequested = false;
      state.beakAttackRequested = 0;
      state.gatlingHeld = false;
      state.throttleInput = state.brakeLatched ? 0 : Number(state.balanceAssistHeld);
      state.steerInput = 0;
      state.brakeInput = false;
      return;
    }
    state.gatlingHeld = keys.has("KeyE");
    const steer = Number(keys.has("KeyD") || (!weightOnly && keys.has("ArrowRight")) || touch.has(1)) - Number(keys.has("KeyA") || (!weightOnly && keys.has("ArrowLeft")) || touch.has(-1));
    state.steerInput = steer;
    state.steerVisual += (steer - state.steerVisual) * (1 - Math.exp(-dt * 22));
    state.brakeInput = state.brakeLatched;
    const forward = keys.has("KeyW") || (!air && !weightOnly && keys.has("ArrowUp")) || touch.has("forward");
    const reverse = keys.has("KeyS") || (!air && !weightOnly && keys.has("ArrowDown")) || touch.has("reverse");
    state.throttleInput = state.brakeInput ? 0 : Number(forward) - Number(reverse);
  };
}
