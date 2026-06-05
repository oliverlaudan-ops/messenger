// modules/notifications.js
// Web-Push: VAPID-Key holen, Browser-Subscription erstellen, an Backend senden.
// Ohne aktive Subscription passiert nichts (kein Error, aber auch keine Push).

import { api, getToken } from "./apiClient.js";

let cachedKey = null;
let subscription = null;

// URL-Safe Base64 → Uint8Array (für applicationServerKey)
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

async function getVapidKey() {
  if (cachedKey) return cachedKey;
  try {
    const { publicKey } = await api("/api/push/vapid-key");
    cachedKey = publicKey;
  } catch {
    cachedKey = null;
  }
  return cachedKey;
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("Notifications not supported");
    return false;
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  await subscribeForPush();
  return true;
}

async function subscribeForPush() {
  if (!("serviceWorker" in navigator)) return;
  if (!getToken()) return; // nicht eingeloggt

  const key = await getVapidKey();
  if (!key) {
    console.warn("[push] no VAPID public key — push disabled");
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }
    // An Backend senden
    await api("/api/push/subscribe", {
      method: "POST",
      body: {
        endpoint: sub.endpoint,
        keys: sub.toJSON().keys,
        userAgent: navigator.userAgent,
      },
    });
    subscription = sub;
    console.log("🔔 push subscribed");
  } catch (e) {
    console.error("[push] subscribe failed", e);
  }
}

export async function unsubscribeFromPush() {
  if (!subscription) return;
  try {
    await api("/api/push/subscribe", {
      method: "DELETE",
      body: { endpoint: subscription.endpoint },
    });
    await subscription.unsubscribe();
    subscription = null;
  } catch (e) {
    console.error("[push] unsubscribe failed", e);
  }
}

// Beim Login automatisch subscriben (falls Permission schon da)
window.addEventListener("userLoggedIn", async () => {
  if (Notification.permission === "granted") {
    await subscribeForPush();
  }
});
