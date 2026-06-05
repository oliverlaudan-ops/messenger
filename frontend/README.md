# Frontend

Vanilla-JS PWA-Frontend, geserved von Nginx (oder einem beliebigen Static-Server).
Migration aus [PWA-Messenger](https://github.com/oliverlaudan-ops/PWA-Messenger) (Firebase).

## Dateien

```
frontend/
├── index.html              App-Shell, ~140 Zeilen
├── app.js                  Entry, 4 Module-Bindings
├── styles.css              komplett übernommen
├── manifest.json           PWA-Manifest
├── sw.js                   Service Worker (App-Cache + Web-Push)
├── modules/
│   ├── apiClient.js        fetch-Wrapper mit JWT-Auth
│   ├── state.js            Geteilter State
│   ├── ui.js               DOM-Helpers
│   ├── auth.js             Register/Login/Logout/Me
│   ├── socket-client.js    Socket.IO-Client, eine Verbindung pro Tab
│   ├── groups.js           Group-Liste, Group-Chat, Messages
│   ├── notifications.js    Web-Push Subscription
│   └── vendor/
│       └── socket.io.esm.min.js  Socket.IO 4 Client (40KB, lokal)
```

## Was wurde ersetzt (PWA-Messenger → messenger)

| Vorher (Firebase) | Nachher (Self-hosted) |
|---|---|
| Firebase Auth SDK | `fetch('/api/auth/*')` mit JWT |
| Firestore `onSnapshot` | REST + Socket.IO `message:new` |
| Cloud Functions | Fastify-Routes in `backend/src/routes/` |
| FCM | `web-push` (VAPID) |
| `firebase.js`, `firebase-messaging-sw.js` | Komplett entfernt |
| Username-Setup-Screen (zweistufig) | Username ist Teil der Register-Payload |

## Was noch fehlt (für später)

- **Direct Messages (DMs)** — Backend-Schema ist da (DmChat, DmMessage, DmParticipant),
  REST-Routes und Frontend-UI kommen in Schritt 7.
- **User-Search** — keine `GET /api/users` Route; nötig für DM-Erstellung.
- **Group-Members-Management** — UI ist rausgeflogen, Backend ist da.
- **Settings** (Blocklist, DM-Permission, DND) — vereinfacht für MVP.
