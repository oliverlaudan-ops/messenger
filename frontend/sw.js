// sw.js
// App-Shell-Cache (Offline) + Web-Push-Handler.
// KEIN Firebase / FCM mehr — komplett web-push.

const CACHE_NAME = "messenger-v1";
const SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.json",
];

// Install: precache App-Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(SHELL).catch(() => {})),
  );
  self.skipWaiting();
});

// Activate: alte Caches weg
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// Fetch: Network-first, Fallback auf Cache
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // API + Socket.IO + Push-Endpoints NICHT cachen
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/socket.io/")
  ) {
    return;
  }
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // Erfolgreiche GETs in Cache schieben
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match("/"))),
  );
});

// === Web-Push Handler ===
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const { title, body, url, chatId, chatType } = data;

  event.waitUntil(
    self.registration.showNotification(title || "Neue Nachricht", {
      body: body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url, chatId, chatType },
      vibrate: [200, 100, 200],
    }),
  );
});

// Notification-Click → fokussieren / navigieren
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if (c.url.includes(self.location.origin)) {
          c.focus();
          c.postMessage({ type: "NOTIFICATION_CLICKED", data: event.notification.data });
          return;
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
