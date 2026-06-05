# Messenger

Self-hosted PWA Messenger. Migration von [PWA-Messenger](https://github.com/oliverlaudan-ops/PWA-Messenger) (Firebase) zu einem selbst gehosteten Stack.

Live: `https://messenger.future-pulse.de`

## Stack

- **Backend:** Node.js 20, Fastify 5, TypeScript, Socket.IO 4, Prisma 5.22
- **Database:** PostgreSQL 16 (Alpine) — *geteilt* mit `prompt-factory-v2`, separate Datenbank `messenger`
- **Frontend:** Vanilla JS PWA (aus PWA-Messenger übernommen)
- **Push:** `web-push` (VAPID) — funktioniert in Chrome, Firefox, Safari 16.4+, Edge
- **Deployment:** Docker-Compose + Host-Nginx + Let's Encrypt

## Architektur

```
messenger.future-pulse.de (Nginx vhost)
├── /               → /var/www/messenger/frontend/  (static)
├── /api/*          → 127.0.0.1:3001                 (Fastify)
└── /socket.io/*    → 127.0.0.1:3001                 (Socket.IO)
```

## Portplan (kein Konflikt mit prompt-factory-v2)

| Service | Port | Host |
|---|---|---|
| prompt-factory-v2 | 3000 | 127.0.0.1 |
| messenger-backend | 3001 | 127.0.0.1 |
| messenger-frontend | — | Nginx static |

## Repo-Struktur

```
messenger/
├── backend/                  Fastify + Socket.IO + Prisma
│   ├── src/
│   ├── prisma/schema.prisma
│   ├── Dockerfile
│   └── package.json
├── frontend/                 PWA (Migration aus PWA-Messenger, in Schritt 6)
│   └── README.md
├── docker-compose.yml        Postgres-Service
├── .env.example
└── README.md
```

## Schnellstart (lokal)

```bash
# Repo klonen
git clone https://github.com/oliverlaudan-ops/messenger.git
cd messenger

# Backend-Env
cp backend/.env.example backend/.env
# JWT_SECRET setzen: openssl rand -base64 48
# DATABASE_URL ggf. anpassen

# Postgres via Docker-Compose starten
docker compose up -d db

# Backend dev
cd backend
npm install
npx prisma migrate dev
npm run dev
# → http://127.0.0.1:3001/api/health
```

## Build-Phasen

- [x] **Schritt 1+2:** Repo-Skeleton, Fastify-Bootstrap, Postgres, Prisma-Schema
- [ ] **Schritt 3:** Auth (Register, Login, JWT) + altes Firebase-Auth raus
- [ ] **Schritt 4:** Messages-Persistenz + Socket.IO Real-time
- [ ] **Schritt 5:** Web-Push (VAPID) + altes FCM raus
- [ ] **Schritt 6:** Frontend-Migration aus PWA-Messenger
- [ ] **Schritt 7:** VPS-Deployment (Nginx-vhost, Certbot, Docker-Compose)

## Lizenz

Privat.
