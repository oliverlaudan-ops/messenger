// modules/socket-client.js
// Socket.IO-Client. Eine einzige Verbindung pro Browser-Tab.
// Auth-Token wird bei connect übergeben (Server prüft es).

import { io } from "./vendor/socket.io.esm.min.js";
import { getToken } from "./apiClient.js";

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 10;

export function getSocket() { return socket; }

export function connectSocket() {
  if (socket?.connected) return socket;

  socket = io({
    path: "/socket.io",
    auth: { token: getToken() },
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    console.log("🔌 socket connected", socket.id);
    reconnectAttempts = 0;
  });

  socket.on("disconnect", (reason) => {
    console.log("🔌 socket disconnected:", reason);
  });

  socket.on("connect_error", (err) => {
    reconnectAttempts++;
    console.error("🔌 socket connect_error:", err.message, "attempt:", reconnectAttempts);
    if (reconnectAttempts > MAX_RECONNECT) {
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }
  });

  return socket;
}

export function joinGroup(groupId) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) return reject(new Error("socket not connected"));
    socket.emit("group:join", { groupId }, (resp) => {
      if (resp?.ok) resolve(resp);
      else reject(new Error(resp?.error ?? "join failed"));
    });
  });
}

export function leaveGroup(groupId) {
  if (socket?.connected) socket.emit("group:leave", { groupId });
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
