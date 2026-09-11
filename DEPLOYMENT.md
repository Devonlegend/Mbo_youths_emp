# Mbo Youth Empowerment — Deployment Guide

This repo contains **two apps that deploy separately**:

| App      | Stack                  | Location                |
|----------|------------------------|-------------------------|
| Frontend | Next.js (App Router)   | repo root (`Dockerfile`) |
| Backend  | Django 6 + DRF + Postgres + Redis/Celery | `mbo_youth_emp/` |

There are two supported deployment shapes:

| Shape | Frontend | Backend + DB | Compose file |
|-------|----------|--------------|--------------|
| **A — Coolify (recommended)** | same server | same server, **Postgres is a Coolify database resource** | root `docker-compose.yml` |
| **B — Split** | Render | VPS, bundled Postgres + Caddy | `mbo_youth_emp/docker-compose.yml` |

> The root `docker-compose.yml` does **not** run Postgres or a reverse proxy. It
> joins Coolify's proxy network and points at a Coolify-managed database.
> The backend-only compose (`mbo_youth_emp/`) is self-contained (db + Caddy).

## Architecture notes (how the pieces talk)

- The Next.js app calls the API through its own `/api/proxy` route
  (`src/app/api/proxy/[...path]/route.js`), which needs `BACKEND_URL`.
- Cookies are httpOnly JWT cookies. In shape A the browser talks to
  `mboempowerment.com` (frontend) and `back.mboempowerment.com` (API), so cookies
  are cross-site: `JWT_COOKIE_SAMESITE=None`, `JWT_COOKIE_SECURE=True`.
- `JWT_COOKIE_SECURE=True` + `SECURE_SSL_REDIRECT=True` assume TLS in front
  (Coolify's proxy sets `X-Forwarded-Proto`, which Django trusts).
- Media goes to Cloudinary; nothing important is written to the container FS.

---

## Option A — Full stack on Coolify (recommended)

Coolify is a self-hosted PaaS with a web UI, logs, one-click deploys, backups
and webhooks. It runs **on the VPS** and drives the root `docker-compose.yml`.
Postgres is created as a **Coolify database resource** (managed, backed up, not
published to the internet).

### 1. Install Coolify on the VPS

```bash
curl -fsSL https://get.coollabs.io/coolify/install.sh | sudo bash
```

Dashboard: `http://<VPS_IP>:8000` — create the admin account and set a dashboard
domain (`coolify.mboempowerment.com`) if you want.

### 2. Create the PostgreSQL resource

Project → **New Resource → Databases → PostgreSQL**:

- **Server / Destination:** the VPS and the destination network the app will use.
- **Type/Image:** PostgreSQL **16** (match the old `postgres:16`; 18 is fine for a
  fresh DB).
- Leave **Make it publicly available** off.

Start it, then open **Configuration → General** and copy:
- **Internal URL** hostname (e.g. `postgres-abc123`)
- Username, password, initial database

### 3. Create the application

**New Resource → Docker Compose** (Git repository):

- **Repository:** `github.com/Devonlegend/Mbo_youths_emp`
- **Base Directory:** `/`
- **Docker Compose Location:** `docker-compose.yml`
- **Build Pack:** Docker Compose

### 4. Networking

Enable **Configuration → Advanced → Connect To Predefined Network** so the app
shares the destination network with the database. The compose also joins the
external `coolify` network so Coolify's proxy can route to it.

### 5. Domains

For each public service, set a **Domains** entry (include the internal port):

| Service    | Domain                             |
|------------|------------------------------------|
| `frontend` | `https://mboempowerment.com:3000`  |
| `backend`  | `https://back.mboempowerment.com:8080` |

Point DNS A records for `mboempowerment.com`, `www.mboempowerment.com` and
`back.mboempowerment.com` at the VPS IP.

### 6. Environment variables

Add these in the resource's **Environment Variables** tab. `DB_HOST` must be the
database's **Internal URL hostname** from step 2; the rest are the same as the
root `.env`:

```
DOMAIN=mboempowerment.com
API_DOMAIN=back.mboempowerment.com
BACKEND_URL=http://backend:8080

DB_HOST=<database-internal-hostname>
DB_PORT=5432
DB_NAME=mbo_portal_v2
DB_USER=postgres
DB_PASSWORD=<from the database resource>

SECRET_KEY=<64 chars>
NIN_HASH_PEPPER=<64 chars>
DEBUG=False
ENVIRONMENT=production
ALLOWED_HOSTS=back.mboempowerment.com,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://www.mboempowerment.com,https://mboempowerment.com
CSRF_TRUSTED_ORIGINS=https://www.mboempowerment.com,https://mboempowerment.com
PORTAL_URL=https://mboempowerment.com
JWT_COOKIE_SECURE=True
JWT_COOKIE_SAMESITE=None
SECURE_SSL_REDIRECT=True
CELERY_TASK_ALWAYS_EAGER=False
ZEPTO_MOCK_MODE=False
ZEPTO_API_KEY=…
PAYSTACK_MOCK_MODE=False
PAYSTACK_SECRET_KEY=…
CLOUDINARY_API_KEY=…
CLOUDINARY_API_SECRET=…
CLOUDINARY_CLOUD_NAME=dwn6p3qmd
```

Generate secrets with
`python3 -c "import secrets; print(secrets.token_urlsafe(64))"`.
Grab the full list from `.env.example`.

### 7. Deploy

Press **Deploy**. Coolify clones, builds the images, starts them in dependency
order, and the backend runs Django migrations on boot.

Create the admin user from the resource terminal (or on the server):

```bash
docker compose exec backend python manage.py createsuperuser
```

- Every git push can auto-deploy (enable **Webhooks**).
- Redis data survives rebuilds (the `redisdata` volume); Postgres lives in the
  Coolify database resource.
- Enable **Database → Backups** for scheduled `pg_dump` to S3.

### Migrating existing data (only if you had a running Postgres)

```bash
# old stack
docker compose exec -T db pg_dump -U postgres -Fc mbo_portal_v2 > backup.dump
# restore into the Coolify DB (host = Internal URL, no TLS from inside the network)
pg_restore -h <internal-host> -U postgres -d mbo_portal_v2 --no-owner --no-acl backup.dump
```

### Firewall for the Coolify path

Do **not** expose the dashboard. Either tunnel it:

```bash
ssh -L 8000:localhost:8000 root@<VPS_IP>   # then browse http://localhost:8000
```

or lock it to your IP:

```bash
ADMIN_CIDR=<your-public-ip>/32 sudo bash deploy/firewall.sh
```

---

## Option B — Frontend on Render, backend on a VPS

Uses the self-contained backend stack (`mbo_youth_emp/docker-compose.yml`): it
ships Postgres, Redis, the backend, the worker and Caddy (auto TLS).

### 1. Backend on the VPS

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker

git clone https://github.com/Devonlegend/Mbo_youths_emp.git
cd Mbo_youths_emp/mbo_youth_emp

cp .env.example .env
# edit .env: SECRET_KEY, DB_* , integrations, CORS/CSRF for the Render origin

sudo docker compose up -d --build
sudo docker compose exec backend python manage.py createsuperuser
```

Point DNS: `back.mboempowerment.com` → VPS IP. Caddy grabs the cert
automatically.

### 2. Frontend on Render

- New Web Service → connect the repo.
- **Root directory:** `.`, build `npm ci && npm run build`, start `npm start`.
- **Environment variables:** `BACKEND_URL=https://back.mboempowerment.com`
- Backend env must include the Render origin:
  - `CORS_ALLOWED_ORIGINS=https://www.mboempowerment.com,https://mboempowerment.com,https://<yourapp>.onrender.com`
  - `CSRF_TRUSTED_ORIGINS` — same list
  - `PORTAL_URL=https://<yourapp>.onrender.com`
  - `JWT_COOKIE_SAMESITE=None`, `JWT_COOKIE_SECURE=True`

> Render doesn't persist filesystem writes between deploys. Media is on
> Cloudinary, so that's fine.

---

## Firewall (do this no matter which option)

```bash
sudo bash deploy/firewall.sh            # SSH on 22
# or custom SSH port:
sudo bash deploy/firewall.sh 2222
# or open the Coolify dashboard to just your IP:
ADMIN_CIDR=203.0.113.10/32 sudo bash deploy/firewall.sh
```

What it does:

- UFW: default-deny inbound, allows rate-limited SSH, HTTP, HTTPS.
- **Docker-aware**: UFW can't see Docker's published ports, so it also installs
  `DROP` rules in the `DOCKER-USER` iptables chain for 5432 (Postgres),
  6379 (Redis), 3000, 8080 and 8000. Only 80/443 stay reachable externally.
- Persists across reboots (`iptables-persistent`).

Confirm from a local machine:

```bash
nc -zv <VPS_IP> 80
nc -zv <VPS_IP> 443
nc -zv <VPS_IP> 5432   # should hang / fail
```

## First-run checklist

```bash
# create the admin (Coolify path: run inside the resource terminal)
docker compose exec backend python manage.py createsuperuser

# sanity check
curl https://back.mboempowerment.com/api/schema/
```

## Common tasks

| Task              | Command                                                        |
|-------------------|----------------------------------------------------------------|
| Status            | `docker compose ps`                                            |
| Backend logs      | `docker compose logs -f backend`                               |
| Rebuild           | `docker compose up -d --build`                                 |
| Create superuser  | `docker compose exec backend python manage.py createsuperuser` |
| DB shell (Coolify)| Coolify UI → database → Terminal, or `psql` via the Internal URL |

> Security: never publish Postgres/Redis to the public internet. In Option A the
> database is internal-only in Coolify; in Option B it is `expose`d only, and the
> firewall drops its host port as a second line of defense.

## FAQ

**Why `BACKEND_URL=http://backend:8080` when everyone else runs on one host?**
The frontend's `/api/proxy` route is a Next.js server route. On the same Docker
network it reaches the backend by container name — no public round-trip, no extra
TLS. Change it to `https://back.mboempowerment.com` only for the Render split.

**Do I still need `mbo_youth_emp/.env` for deploys?**
Only for Option B. In Option A, config is the Coolify env vars; compose injects
every variable. `mbo_youth_emp/.env` is for **local** Django development.

**I only want the backend running.**
```bash
cd mbo_youth_emp && sudo docker compose up -d --build
```
That compose ships its own db and Caddy bound to 80/443 — don't run it alongside
Coolify's proxy on the same host.

**Does the root `Caddyfile` still matter?**
No. It is unused by the Coolify path (Coolify's proxy handles TLS). Caddy only
runs in the backend-only compose (`mbo_youth_emp/Caddyfile`).
