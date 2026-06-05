// modules/auth.js
// Eigenes Auth-Modul: Register, Login, Logout, /me-Refresh.
// Username wird beim Register mitgegeben (Backend akzeptiert es).

import { api, setToken, clearAuth } from "./apiClient.js";
import {
  getCurrentUser, setCurrentUser, clearCurrentUser,
} from "./state.js";
import { showScreen, showError, clearError } from "./ui.js";
import { disconnectSocket } from "./socket-client.js";

export async function register() {
  clearError("registerError");
  const email = document.getElementById("registerEmail").value.trim();
  const username = document.getElementById("registerUsername").value.trim().toLowerCase();
  const password = document.getElementById("registerPassword").value;

  if (!email || !username || !password) {
    showError("registerError", "Bitte alle Felder ausfüllen.");
    return;
  }
  if (password.length < 8) {
    showError("registerError", "Passwort muss mindestens 8 Zeichen haben.");
    return;
  }

  try {
    const { user, token } = await api("/api/auth/register", {
      method: "POST",
      body: { email, username, password },
    });
    setToken(token, user);
    setCurrentUser(user);
    enterApp(user);
  } catch (e) {
    const conflict = e.data?.conflict;
    if (conflict === "email") return showError("registerError", "E-Mail bereits registriert.");
    if (conflict === "username") return showError("registerError", "Benutzername bereits vergeben.");
    const fieldErrs = e.data?.details;
    if (fieldErrs) {
      const first = Object.values(fieldErrs).flat()[0];
      if (first) return showError("registerError", first);
    }
    showError("registerError", e.message || "Registrierung fehlgeschlagen.");
  }
}

export async function login() {
  clearError("loginError");
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    showError("loginError", "Bitte alle Felder ausfüllen.");
    return;
  }

  try {
    const { user, token } = await api("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setToken(token, user);
    setCurrentUser(user);
    enterApp(user);
  } catch (e) {
    if (e.status === 401) return showError("loginError", "E-Mail oder Passwort falsch.");
    showError("loginError", e.message || "Login fehlgeschlagen.");
  }
}

export async function logout() {
  try { await api("/api/auth/logout", { method: "POST" }).catch(() => {}); } catch {}
  clearCurrentUser();
  disconnectSocket();
  showScreen("loginScreen");
}

function enterApp(user) {
  document.getElementById("userInfo").textContent = "@" + user.username;
  showScreen("chatScreen");
  window.dispatchEvent(new CustomEvent("userLoggedIn", { detail: user }));
}

export async function bootstrap() {
  // Wenn Token in localStorage: /me versuchen, bei Erfolg direkt in App
  if (!getCurrentUser()) return;
  try {
    const { user } = await api("/api/auth/me");
    setCurrentUser(user);
    enterApp(user);
  } catch {
    clearCurrentUser();
    showScreen("loginScreen");
  }
}

// Globale 401-Reaktion
window.addEventListener("auth:expired", () => {
  clearCurrentUser();
  showScreen("loginScreen");
});
