export function bindControls(state, reset) {
  const status = document.getElementById("ride-status"),
    brake = document.getElementById("brake-status"),
    rate = document.getElementById("rate");
  function sync() {
    status.textContent = state.raceFinished ? "比赛完成 · R 重新出发" : state.running ? "骑行中" : "已暂停 · P 继续";
    brake.textContent = state.brakeLatched ? "后轮制动中 · F 松开" : "后刹已松开";
    rate.textContent = `限速 ${Math.round(state.targetKmh)} km/h`;
    document.getElementById("speed-cap").textContent = `上限 ${state.tuning?.maxSpeedKmh ?? 220} km/h`;
  }
  function pause() {
    if (state.screen !== "race" || state.settingsOpen || state.raceFinished) return;
    state.running = !state.running;
    sync();
  }
  addEventListener("keydown", (event) => {
    if (state.screen !== "race" || state.settingsOpen || event.repeat || event.ctrlKey || event.metaKey || event.altKey ||
      ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(event.target?.tagName)) return;
    switch (event.code) {
      case "KeyE":
        if (state.running && !state.crashed) {
          if (state.beakEquipped) state.beakAttackRequested = 1;
          else state.fireRequested = true;
        }
        break;
      case "KeyQ":
        if (state.running && !state.crashed && state.beakEquipped) state.beakAttackRequested = -1;
        break;
      case "KeyF": state.brakeLatched = !state.brakeLatched; break;
      case "KeyR": reset(false); break;
      case "KeyN": reset(true); break;
      case "Minus": case "NumpadSubtract": state.targetKmh = Math.max(20, state.targetKmh - 10); break;
      case "Equal": case "NumpadAdd": state.targetKmh = Math.min(state.tuning?.maxSpeedKmh ?? 220, state.targetKmh + 10); break;
      default: return;
    }
    event.preventDefault();
    sync();
  });
  sync();
  return { pause, update: sync };
}
