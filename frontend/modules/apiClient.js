// modules/apiClient.js
// Wrapper um fetch mit JWT-Auth, einheitlichem Error-Handling
// und automatischer Token-Persistenz in localStorage.

const TOKEN_KEY = "messenger.jwt";
const USER_KEY = "messenger.user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers ?? {}) };
  const token = getToken();
  if (token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // 401 → global ausloggen
  if (res.status === 401) {
    clearAuth();
    window.dispatchEvent(new CustomEvent("auth:expired"));
  }

  let data = null;
  try { data = await res.json(); } catch { /* leerer Body */ }

  if (!res.ok) {
    const err = new Error(data?.error ?? `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
