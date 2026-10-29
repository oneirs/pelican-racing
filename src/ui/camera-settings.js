const KEY = "pelican-camera-v1";
export function bindCameraSettings(state, onChange) {
  const select = document.getElementById("camera-setting");
  const toggle = document.getElementById("camera-toggle");
  const label = document.getElementById("camera-label");
  try { state.cameraMode = localStorage.getItem(KEY) === "third" ? "third" : "first"; } catch { state.cameraMode = "first"; }
  function sync() {
    const name = state.cameraMode === "third" ? "第三人称" : "第一人称";
    select.value = state.cameraMode;
    if (toggle) toggle.textContent = `视角：${name} · C`;
    label.textContent = name;
    document.getElementById("scene").setAttribute("aria-label", `鹈鹕${name}海滩骑行，前方赛道随行进持续生成`);
  }
  function change(mode) {
    state.cameraMode = mode;
    state.lookYaw = state.lookPitch = 0;
    try { localStorage.setItem(KEY, mode); } catch {}
    onChange();
    sync();
  }
  function cycle() { change(state.cameraMode === "third" ? "first" : "third"); }
  select.onchange = () => change(select.value);
  if (toggle) toggle.onclick = () => { cycle(); document.querySelector("#scene canvas")?.focus(); };
  addEventListener("keydown", (event) => {
    if (state.screen !== "race" || state.settingsOpen || event.code !== "KeyC" || event.repeat || ["INPUT", "SELECT", "TEXTAREA"].includes(event.target?.tagName)) return;
    event.preventDefault();
    cycle();
  });
  sync();
}
