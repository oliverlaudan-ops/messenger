# Messenger

Self-hosted PWA Messenger. Live: **[https://messenger.future-pulse.de](https://messenger.future-pulse.de)**

Migration von [PWA-Messenger](https://github.com/oliverlaudan-ops/PWA-Messenger) (Firebase) zu einem eigenem Backend.

## Status

Siehe **[STATUS.md](./STATUS.md)** für aktuellen Stand, was läuft, was fehlt, und was als nächstes ansteht.

Kurzfassung: Schritte 1–7 abgeschlossen. Live-URL funktioniert (HTTPS, Auth, Groups, Real-time Messages, Web-Push). Offen: Mitglieder-Management, DMs, User-Search, DevOps (Auto-Start, Backups).

## Stack

- **Backend:** Node.js 20, Fastify 5, TypeScript, Socket.IO 4, Prisma 5.22
- **Database:** PostgreSQL 16 (Alpine) — eigener Container
- **Frontend:** Vanilla-JS PWA (kein Build-Step)
- **Push:** `web-push` (VAPID) — funktioniert in Chrome, Firefox, Safari 16.4+, Edge
- **Deployment:** Docker-Container + Host-Nginx + Let's Encrypt

## Architektur

```
https://messenger.future-pulse.de (Nginx vhost, Let's Encrypt)
├── /              → /var/www/messenger/ (statische PWA-Files)
├── /api/*         → proxy_pass 127.0.0.1:3001 (Fastify-Backend)
└── /socket.io/*   → proxy_pass 127.0.0.1:3001 (WebSocket-Upgrade)

Backend:  Container "messenger-backend" (messenger_backend:latest)
          Fastify 5 + TS + Socket.IO 4 + Prisma 5.22 + Node 20-alpine
DB:       Container "messenger-db" (postgres:16-alpine, Volume: messenger_pgdata)
```

## Repo-Struktur

```
messenger/
├── backend/                  Fastify + Socket.IO + Prisma
│   ├── src/
│   │   ├── server.ts
│   │   ├── db.ts
│   │   ├── push.ts
│   │   ├── plugins/         authenticate, rate-limit
│   │   ├── routes/          auth, groups, messages, push
│   │   └── realtime/        socket.ts (broadcast helpers)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── Dockerfile
│   └── package.json
├── frontend/                 PWA (Vanilla-JS, keine Build-Tools)
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   ├── manifest.json
│   ├── sw.js                 Service Worker (Cache + Web-Push Handler)
│   └── modules/
│       ├── apiClient.js
│       ├── state.js
│       ├── ui.js
│       ├── auth.js
│       ├── socket-client.js
│       ├── groups.js
│       ├── notifications.js
│       └── vendor/           Socket.IO 4 Client (40KB, lokal)
├── docker-compose.yml
├── STATUS.md                 ← wo wir stehen, was als nächstes
└── README.md                 ← du bist hier
```

## Quickstart (Dev / Lokal)

```bash
# Repo klonen
git clone https://github.com/oliverlaudan-ops/messenger.git
cd messenger

# Backend-Env
cp backend/.env.example backend/.env
# JWT_SECRET setzen: openssl rand -base64 48
# DB-Passwort ohne Sonderzeichen: openssl rand -hex 16

# Top-level .env (für docker-compose)
cp .env.example .env
# POSTGRES_PASSWORD gleich wie in backend/.env

# Postgres via Docker-Compose
docker compose up -d db

# Backend Dev
cd backend
npm install
npx prisma migrate dev
npm run dev
# → http://127.0.0.1:3001/api/health

# Frontend Dev (separates Terminal)
cd frontend
npx http-server -p 8080 --proxy http://127.0.0.1:3001
# → http://127.0.0.1:8080
```

## Production-Deploy (VPS)

Siehe `/opt/messenger` auf dem VPS. Wichtige Pfade:

- Working dir: `/opt/messenger`
- Static files: `/var/www/messenger/`
- Nginx vhost: `/etc/nginx/sites-available/messenger.future-pulse.de`
- Cert: `/etc/letsencrypt/live/messenger.future-pulse.de/`

Container-Start (manuell, weil `docker-compose v1.29.2` auf Ubuntu 24.04 buggy ist):

```bash
# DB
docker run -d --name messenger-db \
  --network messenger_default --network-alias db \
  -e POSTGRES_USER=messenger -e POSTGRES_PASSWORD=... -e POSTGRES_DB=messenger \
  -v messenger_pgdata:/var/lib/postgresql/data \
  --restart unless-stopped \
  --health-cmd "pg_isready -U messenger" --health-interval 10s \
  postgres:16-alpine

# Backend
docker run -d --name messenger-backend \
  --network messenger_default --restart unless-stopped \
  --env-file /opt/messenger/backend/.env \
  -e PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-mussl-openssl-3.0.x.so.node \
  -p 127.0.0.1:3001:3001 -w /app \
  --health-cmd "wget -qO- http://127.0.0.1:3001/api/health" --health-interval 30s \
  messenger_backend:latest

# DB-Schema initial anlegen (einmalig)
docker exec -i messenger-db psql -U messenger -d messenger \
  < backend/prisma/migrations/*/migration.sql

# Frontend-Files nach /var/www/messenger/
cp -r frontend/* /var/www/messenger/

# Nginx reload
systemctl reload nginx
```

## Lessons Learned (kurz, vollständig in MEMORY.md)

- **Prisma 5.22 + Alpine 3.20+** hat kaputte libssl-auto-detection. `PRISMA_QUERY_ENGINE_LIBRARY` env-var in docker-compose MUSS gesetzt sein.
- **DB-Passwörter** ohne URL-Sonderzeichen (`/`, `?`, `#`). `openssl rand -hex 16` ist sicher.
- **`HOST=0.0.0.0`** in Backend-.env (nicht `127.0.0.1`), sonst bindet der Server auf Container-Loopback.
- **`docker-compose v1.29.2`** auf Ubuntu 24.04 hat Bugs. Entweder Plugin installieren oder Container manuell mit `docker run` starten.

## Lizenz

Privat.
