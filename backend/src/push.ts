// Web-Push Setup
// Liest VAPID-Keys aus Env, konfiguriert web-push Library.
// Wenn Keys fehlen → Push-Funktionen werden zu No-Ops (graceful degradation).

import webpush from "web-push";
import { prisma } from "./db.js";
import { getIO } from "./realtime/socket.js";

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@localhost";

let initialized = false;

export function initPush() {
  if (!PUBLIC_KEY || !PRIVATE_KEY) {
    console.warn(
      "[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set — web-push disabled",
    );
    return;
  }
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  initialized = true;
  console.log("[push] web-push initialized");
}

export function vapidPublicKey(): string | null {
  return initialized ? PUBLIC_KEY ?? null : null;
}

/**
 * Sendet Push an einen Token. Bei 404/410 (= Subscription abgelaufen/ungültig)
 * wird der Token aus der DB gelöscht.
 */
async function sendToToken(
  token: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url: string; chatId: string; chatType: "group" | "dm" },
) {
  try {
    await webpush.sendNotification(
      {
        endpoint: token.endpoint,
        keys: { p256dh: token.p256dh, auth: token.auth },
      },
      JSON.stringify(payload),
    );
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      // Subscription ist tot, aufräumen
      await prisma.pushToken.delete({ where: { id: token.id } }).catch(() => {});
      return { ok: false, expired: true };
    }
    console.error("[push] send failed", { endpoint: token.endpoint.slice(0, 60), status, err: (err as Error).message });
    return { ok: false, expired: false };
  }
  return { ok: true, expired: false };
}

/**
 * Sendet Push an eine Liste von UserIds — aber nur an die,
 * die aktuell KEINEN offenen Socket haben (= offline).
 *
 * WICHTIG: Importiert 'getIO' lazy um circular deps zu vermeiden.
 */
export async function pushToOfflineUsers(
  userIds: string[],
  payload: {
    title: string;
    body: string;
    url: string;
    chatId: string;
    chatType: "group" | "dm";
  },
) {
  if (!initialized) return;
  if (userIds.length === 0) return;

  // Online-User ermitteln
  let onlineUserIds: Set<string>;
  try {
    const io = getIO();
    onlineUserIds = new Set<string>();
    for (const [, socket] of io.sockets.sockets) {
      const uid = socket.data.userId as string | undefined;
      if (uid) onlineUserIds.add(uid);
    }
  } catch {
    return; // Socket.IO nicht initialisiert
  }
  const offlineUserIds = userIds.filter((id) => !onlineUserIds.has(id));
  if (offlineUserIds.length === 0) return;

  // PushTokens holen
  const tokens = await prisma.pushToken.findMany({
    where: { userId: { in: offlineUserIds } },
    select: { id: true, endpoint: true, p256dh: true, auth: true, userId: true },
  });
  if (tokens.length === 0) return;

  // Parallel versenden, Errors pro Token isoliert
  const results = await Promise.allSettled(
    tokens.map((t) => sendToToken(t, payload)),
  );
  const sent = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
  const expired = results.filter(
    (r) => r.status === "fulfilled" && r.value.expired,
  ).length;
  console.log(
    `[push] target=${userIds.length} offline=${offlineUserIds.length} tokens=${tokens.length} sent=${sent} expired=${expired}`,
  );
}
