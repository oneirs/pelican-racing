export function bindSettings(state) {
  const dialog = document.getElementById("game-settings");
  let wasRunning = false;
  function open() {
    if (dialog.open) return;
    wasRunning = state.running;
    state.settingsOpen = true;
    if (state.screen === "race") state.running = false;
    dialog.showModal();
  }
  for (const button of document.querySelectorAll("[data-open-settings]"))
    button.addEventListener("click", open);
  document.getElementById("close-settings").onclick = () => dialog.close();
  dialog.addEventListener("close", () => {
    state.settingsOpen = false;
    if (state.screen === "race") {
      state.running = wasRunning;
      document.querySelector("#scene canvas")?.focus();
    }
  });
}
