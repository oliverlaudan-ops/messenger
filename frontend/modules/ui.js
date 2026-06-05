// modules/ui.js
// Kleine DOM-Helpers (show/hide, error-Anzeige, Spinner).

export function showScreen(name) {
  const screens = ["loginScreen", "registerScreen", "chatScreen"];
  for (const s of screens) {
    const el = document.getElementById(s);
    if (el) el.classList.toggle("hidden", s !== name);
  }
}

export function showError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
}

export function clearError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}

export function spinner(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '<div class="spinner"></div>';
}

export function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = String(s);
  return div.innerHTML;
}

export function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
    });
  } catch { return iso; }
}
