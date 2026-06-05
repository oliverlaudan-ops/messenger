# Frontend — Self-hosted PWA

Statisches PWA-Frontend, geserved direkt von Nginx (kein Build-Step, kein
Container). Migration aus [PWA-Messenger](https://github.com/oliverlaudan-ops/PWA-Messenger)
ist in Schritt 6 geplant.

## Erwartete Dateien (aus PWA-Messenger übernommen)

```
frontend/
├── index.html
├── styles.css
├── manifest.json
├── sw.js                    # PWA / Offline-Cache
├── icons/
│   ├── icon-192x192.png
│   └── icon-512x512.png
└── modules/                 # Vanilla-JS ES-Modules
    ├── state.js
    ├── auth.js
    ├── ui.js
    ├── users.js
    ├── groups.js
    ├── groupMembers.js
    ├── directMessages.js
    └── notifications.js
```

## Was sich ändert

| Datei | Änderung |
|---|---|
| `modules/state.js` | Firebase-Init entfernen, eigenen API-Client einbauen (`apiClient` mit JWT) |
| `modules/auth.js` | Firebase Auth → eigene `/api/auth/*` Endpoints, JWT in localStorage |
| `modules/notifications.js` | FCM → web-push Subscription, VAPID-Key vom Backend holen |
| `modules/directMessages.js`, `groups.js` | Firestore Listener → Socket.IO Events |
| `firebase.js`, `firebase-messaging-sw.js` | Komplett löschen |

## Verbindung zum Backend

Frontend served von `messenger.future-pulse.de` (Nginx), Backend auf
`127.0.0.1:3001`. Nginx routet `/api/*` und `/socket.io/*` durch — Frontend
spricht same-origin, keine CORS-Konfiguration im Frontend nötig.
