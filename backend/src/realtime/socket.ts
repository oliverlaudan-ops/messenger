// Socket.IO helpers — wird sowohl beim connection-Handler als auch
// von REST-Routes (Broadcast nach save) genutzt.

import type { Server as SocketIOServer } from "socket.io";

let ioRef: SocketIOServer | null = null;

export function setIO(io: SocketIOServer) {
  ioRef = io;
}

export function getIO(): SocketIOServer {
  if (!ioRef) throw new Error("Socket.IO not initialized");
  return ioRef;
}

/**
 * Sendet ein Event an alle Sockets der Mitglieder einer Gruppe.
 * Erwartet, dass jeder User-typischerweise nur einen Socket hat
 * (single device). Bei Multi-Device später die userId join-Map erweitern.
 *
 * WICHTIG: membersToNotify wird vom Caller übergeben, weil das Schema
 * ohne zusätzliche Query nicht alle Member kennt.
 */
export function broadcastToGroup(
  groupId: string,
  event: string,
  payload: unknown,
  exceptSocketId?: string,
) {
  if (!ioRef) return;
  const room = `group:${groupId}`;
  if (exceptSocketId) {
    ioRef.to(room).except(exceptSocketId).emit(event, payload);
  } else {
    ioRef.to(room).emit(event, payload);
  }
}
