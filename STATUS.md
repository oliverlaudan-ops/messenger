# Status — messenger

**Stand:** 2026-07-08 (Quick-Health-Check, J.A.R.V.I.S.) — Code-Stand seit 2026-06-05 unverändert

**Live-URL:** https://messenger.future-pulse.de

---

## Was live ist (Schritte 1–7 abgeschlossen)

| # | Schritt | Commit | Stand |
|---|---------|--------|-------|
| 1 | Monorepo-Bootstrap (`/opt/messenger` auf VPS) | `43b882e` | ✓ |
| 2 | Fastify + TS + Prisma + Docker-Compose (Dev) | `43b882e` | ✓ |
| 3 | Auth (Register, Login, /me, JWT, bcrypt, rate-limit) | `464e1a5` | ✓ |
| 4 | Groups + Messages REST + Socket.IO Real-time | `9eba215` | ✓ |
| 5 | Web-Push via VAPID (subscribe/unsubscribe/Trigger) | `83d69e0` | ✓ |
| 6 | Frontend-Migration (PWA-Messenger → vanilla-JS) | `8d3353c` | ✓ |
| 7 | VPS-Deployment (Nginx + Certbot + Live-URL) | `0d63e75` | ✓ |

*Architektur:*

```
https://messenger.future-pulse.de (Nginx vhost, Let's Encrypt)
├── /              → /var/www/messenger/ (statische PWA-Files)
├── /api/*         → proxy_pass 127.0.0.1:3001 (Fastify-Backend)
└── /socket.io/*   → proxy_pass 127.0.0.1:3001 (WebSocket-Upgrade)

Backend:  Container "messenger-backend" (messenger_backend:latest)
          Fastify 5 + TS + Socket.IO 4 + Prisma 5.22 + Node 20-alpine
          Intern auf 127.0.0.1:3001, exposed via Nginx
DB:       Container "messenger-db" (postgres:16-alpine)
          Eigener Container, eigener Volume, DB: "messenger"
          NICHT geteilt mit prompt-factory-v2 (das war ursprünglich
          mal geplant, ist aber als eigene DB eigenständig besser)
```

*VPS-Details:*

- Host: `vmd191585` (62.171.143.32)
- Working dir: `/opt/messenger`
- Repo: https://github.com/oliverlaudan-ops/messenger
- Static files: `/var/www/messenger/`
- Nginx vhost: `/etc/nginx/sites-available/messenger.future-pulse.de`
- Cert: `/etc/letsencrypt/live/messenger.future-pulse.de/` (auto-renew via certbot timer)
- DB-Credentials: in `/opt/messenger/.env` und `/opt/messenger/backend/.env`
- VAPID-Keys: in `/opt/messenger/backend/.env`

---

## Smoke-Test 2026-07-08

| Check | Ergebnis |
|-------|----------|
| HTTPS-Erreichbarkeit | `HTTP 200` in 86 ms (gemessen via `curl -I`) |
| TLS-Cert | Valide bis 2026-09-03 (Let's Encrypt) |
| `messenger-backend` Container | Up 3 weeks, healthy, 127.0.0.1:3001 |
| `messenger-db` (postgres:16-alpine) | Up 3 weeks, healthy |
| DB-Volume (`messenger_messenger_pgdata`) | existiert, **kein Backup-Script aktiv** ⚠️ |
| Letzter Code-Commit | `cf4f6f6` (2026-06-05, Session-Übergangs-Status) |
| Letzte Code-Änderung davor | `0d63e75` (Prisma 5.22 + Alpine 3.20+ Fix) |
| PWA-Icons | weiterhin fehlend (manifest verweist auf nicht-existente Dateien) |

**Bewertung:** MVP stabil, keine offenen Incidents. 33 Tage ohne Code-Touch — das Repo ist auf Stand "live und funktional", nicht "live und in Entwicklung".

---

 (getestet mit echtem Chromium)

1. Page-Load (HTTPS, Certbot-validiert)
2. Register neuer User (E-Mail, Username, Passwort)
3. Login (mit JWT)
4. Group erstellen (Name, Description, optional memberIds)
5. Group-Liste anzeigen
6. Group-Chat öffnen (mit Member-Liste im Header)
7. Message senden (REST)
8. Message live empfangen (Socket.IO `message:new` Event)
9. Logout (JWT wird vergessen, UI springt zu Login)
10. Web-Push Subscriben (Browser-Permission → vapid-key → POST /subscribe)
11. Web-Push an Offline-User (wenn jemand schreibt während andere offline sind)

---

## Was fehlt (offene Punkte für nächste Session)

### Offene Funktionalität

1. **Mitglieder-Management**
   - `POST /api/groups/:id/members` (Owner/Admin fügt User hinzu)
   - `DELETE /api/groups/:id/members/:userId` (Owner/Admin entfernt User)
   - Frontend: UI im Group-Header für "Mitglied hinzufügen" + User-Search-Modal
   - **Voraussetzung:** User-Search-Endpoint (siehe nächster Punkt)

2. **User-Search-Endpoint**
   - `GET /api/users?q=...` für User-Suche
   - Wird gebraucht für DM-Erstellung UND für Member-Add-UI

3. **Direct Messages (DMs)**
   - Backend-Schema ist bereits da: `DmChat`, `DmParticipant`, `DmMessage`
   - REST-Routes fehlen: `POST /api/dms`, `GET /api/dms`, `GET /api/dms/:id/messages`, `POST /api/dms/:id/messages`
   - Frontend: Tab-Wechsel (Group ↔ DM) fehlt komplett
   - **Voraussetzung:** User-Search (für DM-Partner finden)

4. **User-Settings (Settings-Modal)**
   - Im PWA-Messenger gab's DM-Privacy, Blocklist, Do-Not-Disturb
   - Alles rausgeflogen für MVP
   - Backend hat aktuell keine Felder dafür im User-Model (müsste ergänzt werden)

5. **Frontend-Icons (PWA-Installierbarkeit)**
   - `frontend/manifest.json` referenziert `icon-192.png` und `icon-512.png`
   - Diese existieren weder im Repo noch in `/var/www/messenger/`
   - PWA installiert sich trotzdem, zeigt nur Default-Favicon
   - **Nicht-blockierend**, aber nice-to-have

### Offene DevOps-Themen

6. **Container-Start automatisieren**
   - Aktuell läuft das Backend manuell via `docker run` (siehe `messenger-server-log.txt` falls gewünscht)
   - `docker-compose v1.29.2` hat Bugs mit Docker 24+ (`KeyError: 'ContainerConfig'`)
   - `docker-compose-plugin` ist auf Ubuntu 24.04 nicht im default-Repo
   - **Workaround-Optionen:**
     - (a) `docker-compose-plugin` manuell installieren (GitHub-Releases), dann `docker compose` benutzen
     - (b) `deploy/start.sh` schreiben der `docker run --network ... --network-alias db` macht
     - (c) Systemd-Service-Unit, der beim Boot die Container startet
   - Wichtig: Bei Server-Reboot starten die Container aktuell NICHT automatisch (außer mit restart-policy, was hier `unless-stopped` ist und *eigentlich* funktionieren sollte — verifizieren)

7. **Deployment-Reproduzierbarkeit**
   - VPS-spezifische Schritte (Nginx-vhost, Certbot, File-Copy nach `/var/www/messenger`) sind nirgends im Repo dokumentiert
   - Empfehlung: `deploy/` Verzeichnis mit:
     - `deploy/nginx-messenger.conf` (vhost-Template)
     - `deploy/start.sh` (Container-Start-Script)
     - `deploy/install.sh` (Komplett-Setup für neue VPS)

8. **DB-Backup**
   - Volume `messenger_pgdata` ist nicht gesichert
   - Backup-Script fehlt (cron + `pg_dump`)
   - prompt-factory-v2 hat ein `backups/` Verzeichnis — gleiches Pattern übernehmen

9. **CI/CD (GitHub Actions)**
   - Keine automatischen Tests / Lints
   - Kein automatischer Deploy (per SSH auf VPS)
   - Nicht-blockierend für MVP, aber sinnvoll sobald Code refactored wird

### Lessons Learned (aus dieser Session, schon in MEMORY.md)

- Prisma 5.22 + Alpine 3.20+: braucht `PRISMA_QUERY_ENGINE_LIBRARY` env-var
- DB-Passwörter ohne URL-Sonderzeichen (kein `/` etc.)
- `HOST=0.0.0.0` in Backend-.env (nicht `127.0.0.1`)
- `docker-compose v1.29.2` ist auf Ubuntu 24.04 buggy → entweder Plugin installieren oder `docker run`

---

## Nächste Session — Empfohlene Reihenfolge

*Wenn du mitglieder-management bauen willst:*
1. `GET /api/users?q=...` Endpoint
2. `POST /api/groups/:id/members` Endpoint
3. Frontend: User-Search-Modal + "Mitglied hinzufügen" Button
4. E2E-Test

*Wenn du DMs bauen willst:*
1. `GET /api/users?q=...` (siehe oben)
2. `POST /api/dms` (erstellt oder findet 1-zu-1 Chat)
3. `GET /api/dms` (eigene DMs)
4. `GET /api/dms/:id/messages` + `POST /api/dms/:id/messages` (analog zu Groups)
5. Frontend: DM-Tab im UI
6. E2E-Test

*Wenn du DevOps-Themen angehen willst:*
1. `docker-compose-plugin` installieren ODER `deploy/start.sh` schreiben
2. `deploy/nginx-messenger.conf` ins Repo
3. Systemd-Service für Auto-Start
4. DB-Backup-Cron

---

## Offene Fragen / Unklarheiten

- *Push für DM:* Aktuell wird nur bei Group-Messages ein Push gefeuert. Bei DMs müsste das auch rein — selbe `pushToOfflineUsers()`-Funktion, anderer chatType.
- *Member-Rollen:* Soll ein ADMIN (vom OWNER ernannt) auch Members entfernen können? Aktuell nur OWNER.
- *User-Profile:* Aktuell gibt's kein `GET /api/users/:id` für Public-Profile (Avatar, Username, createdAt). Braucht man evtl. für User-Search-Result-Anzeige.
