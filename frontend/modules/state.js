// modules/state.js
// Geteilter State — KEIN Firebase mehr.
// Socket-Referenz liegt in socket-client.js (separates Modul, keine Zyklen).

import { getStoredUser, clearAuth } from "./apiClient.js";

let currentUser = getStoredUser();
let currentGroupId = null;
let currentGroup = null;

export function getCurrentUser() { return currentUser; }
export function setCurrentUser(u) { currentUser = u; }
export function clearCurrentUser() {
  currentUser = null;
  clearAuth();
}

export function getCurrentGroupId() { return currentGroupId; }
export function setCurrentGroupId(id) { currentGroupId = id; }
export function getCurrentGroup() { return currentGroup; }
export function setCurrentGroup(g) { currentGroup = g; }
