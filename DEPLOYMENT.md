# Mbo Youth Empowerment — Deployment Guide

This repo contains **two apps that deploy separately**:

| App      | Stack                  | Location                | Original plan   |
|----------|------------------------|-------------------------|-----------------|
| Frontend | Next.js (App Router)   | repo root (`Dockerfile`) | **Render**      |
| Backend  | Django 6 + DRF + Postgres + Redis/Celery | `mbo_youth_emp/` | **VPS** |

The backend was already dockerized. This repo now ships everything needed to
run the **whole stack on one VPS** behind Caddy, optionally managed by
**Coolify**, with a **firewall** script.

## What was added

```
Dockerfile              # frontend image (Next.js standalone)
.dockerignore
mbo_youth_emp/.dockerignore
docker-compose.yml      # full stack: frontend, backend, db, redis, worker, caddy
Caddyfile               # web + API routing, auto TLS
.env.example            # all deployment variables
deploy/firewall.sh      # UFW + Docker hardening
DEPLOYMENT.md           # this file
```

`next.config.mjs` now emits `output: "standalone"` (smaller image, used by the
Dockerfile; Render's `npm start` is unaffected).

## Architecture notes (how the pieces talk)

- The Next.js app calls the API through its own `/api/proxy` route
  (`src/app/api/proxy/[...path]/route.js`), which needs `BACKEND_URL`.
- Cookies are httpOnly JWT cookies. When everything sits behind **one domain**
  (`mboempowerment.com` via Caddy), the browser only ever talks to that origin,
  so the auth is effectively same-site — you can run `JWT_COOKIE_SAMESITE=Lax`
  if you never hit `api.*` directly. Keep `None` if the frontend is on Render.
- `JWT_COOKIE_SECURE=True` + `SECURE_SSL_REDIRECT=True` assume TLS in front
  (Caddy sets `X-Forwarded-Proto`, which Django trusts).

---

## Option A — Frontend on Render, backend on the VPS (original plan)

### 1. Backend on the VPS (plain Docker)

```bash
# server: Ubuntu 22.04+
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker

git clone https://github.com/Devonlegend/Mbo_youths_emp.git
cd Mbo_youths_emp

cp .env.example .env
# secrets must be committed nowhere; fill them in
#   - SECRET_KEY, NIN_HASH_PEPPER: python3 -c "import secrets; print(secrets.token_urlsafe(64))"
#   - OPEN_PORTAL: keep 80/443 only, leave 5432/6379 closed (they already are — compose `expose`s)
#   - BACKEND_URL here should be http://backend:8080 UNLESS you also serve
#     the frontend from this box (then it doesn't matter, proxy uses internal URL)

sudo docker compose up -d --build
```

Point DNS: `back.mboempowerment.com` → VPS IP. Caddy grabs the cert automatically.

### 2. Frontend on Render

- New Blueprint / Web Service → connect the repo.
- **Root directory:** `.` (or `/`), build command `npm ci && npm run build`,
  start command `npm start`. Render sets `NODE_ENV=production`.
- **Environment variables:**
  - `BACKEND_URL=https://back.mboempowerment.com`
- Backend env adds the Render origin so CORS/cookies work:
  - `CORS_ALLOWED_ORIGINS=https://www.mboempowerment.com,https://mboempowerment.com,https://<yourapp>.onrender.com`
  - `CSRF_TRUSTED_ORIGINS` — same list
  - `PORTAL_URL=https://<yourapp>.onrender.com`
  - `JWT_COOKIE_SAMESITE=None`, `JWT_COOKIE_SECURE=True`

> Note: Render doesn't persist filesystem writes between deploys. This project
> stores media on Cloudinary and uses Postgres on the VPS, so that's fine.

---

## Option B — Everything on one VPS (plain Docker, recommended if you own one VPS)

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker

git clone https://github.com/Devonlegend/Mbo_youths_emp.git
cd Mbo_youths_emp
cp .env.example .env
#   edit .env: DOMAIN, API_DOMAIN, DB_PASSWORD, SECRET_KEY, integrations

# firewall BEFORE any public exposure
sudo bash deploy/firewall.sh

sudo docker compose up -d --build
sudo docker compose exec backend python manage.py createsuperuser
```

DNS: `mboempowerment.com` **and** `www.*` and `back.mboempowerment.com` → VPS IP.

Services exposed: **only 80/443** (Caddy). Postgres, Redis, the API and the
frontend listen on the internal compose network only.

| URL                     | Container    |
|-------------------------|--------------|
| `https://mboempowerment.com` | `frontend:3000` |
| `https://back.mboempowerment.com` | `backend:8080` |

Deploy updates:

```bash
git pull && sudo docker compose up -d --build
```

---

## Option C — Everything on one VPS, managed by Coolify (recommended)

Coolify is a self-hosted PaaS with a web UI, logs, one-click deploys and
webhooks. It runs **on the same VPS** and can drive either a single app or a
`docker compose` file. Our full stack is already one compose file, so this is a
two-minute job.

### 1. Install Coolify on the VPS

```bash
curl -fsSL https://get.coollabs.io/coolify/install.sh | sudo bash
```

Dashboard: `http://<VPS_IP>:8000` — set up the admin account, TLS, and a
domain for the dashboard (`coolify.mboempowerment.com` works if you add DNS).

### 2. Disable Coolify's built-in proxy

Because our stack ships its **own** reverse proxy (Caddy on 80/443):
Server → Settings → **Global Proxy → None**. (Coolify's default Traefik would
otherwise fight Caddy for ports 80/443.)

### 3. Add the app

Left sidebar → **Projects** → New project (e.g. `mbo-portal`) → **New resource →
Docker Compose**:

- **Git Repository / source:** `github.com/Devonlegend/Mbo_youths_emp`
- **Base Directory:** `/`  → **Custom docker compose location / file:**
  `docker-compose.yml`
- **Server / Deployment destination:** your VPS
- **Ports Exposes (required field):** type `80`. That's the only number you
  need — it just satisfies the form so Coolify knows something about the app.
  The real `80:80` and `443:443` mappings live **inside** `docker-compose.yml`
  (the `caddy` service) and Caddy handles TLS, so this field has no practical
  effect with the proxy disabled.

### 4. Environment variables

In the resource's **Environment Variables** tab, Add them all. This is the same
as the root `.env` file:

```
DOMAIN=mboempowerment.com
API_DOMAIN=back.mboempowerment.com
BACKEND_URL=http://backend:8080
DB_NAME=mbo_portal_v2
DB_USER=postgres
DB_PASSWORD=<strong>
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
BREVO_MOCK_MODE=False
BREVO_API_KEY=…
PAYSTACK_MOCK_MODE=False
PAYSTACK_SECRET_KEY=…
CLOUDINARY_API_KEY=…
CLOUDINARY_API_SECRET=…
CLOUDINARY_CLOUD_NAME=dwn6p3qmd
```

(Grab the full list from `.env.example`.) Coolify writes these into the `.env`
it generates for the compose project, so `${VAR}` substitution works exactly
like Option B.

### 5. Deploy

Press **Deploy**. Coolify will clone, build all five images, start them in
dependency order, run Django migrations, and assign ports 80/443.

- Every git push can auto-deploy (enable **Webhooks** in the resource).
- Postgres data survives rebuilds (the `pgdata` volume).
- Watch logs, restart, roll back — all from the UI.

### Firewall for the Coolify path

Do **not** expose the dashboard. Either:

```bash
ssh -L 8000:localhost:8000 root@<VPS_IP>   # then browse http://localhost:8000
```

or lock it to your IP:

```bash
ADMIN_CIDR=<your-public-ip>/32 sudo bash deploy/firewall.sh
```

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

Try these from a local machine to confirm:

```bash
nc -zv <VPS_IP> 80
nc -zv <VPS_IP> 443
nc -zv <VPS_IP> 5432   # should hang / fail
```

## First-run checklist

```bash
# backend migrations + admin (compose runs migrate automatically, this creates the admin)
sudo docker compose exec backend python manage.py createsuperuser

# sanity check
curl https://back.mboempowerment.com/api/schema/
```

## Common tasks

| Task                          | Command                                                       |
|-------------------------------|---------------------------------------------------------------|
| Status                        | `sudo docker compose ps`                                      |
| Backend logs                  | `sudo docker compose logs -f backend`                         |
| Rebuild everything            | `sudo docker compose up -d --build`                           |
| Database shell                | `sudo docker compose exec db psql -U postgres -d mbo_portal_v2` |
| Create superuser              | `sudo docker compose exec backend python manage.py createsuperuser` |

> Security: never publish Postgres/Redis to the public internet. With this
> compose they are `expose`d only (internal network), and the firewall drops
> their host ports as a second line of defense.

## FAQ

**Why `BACKEND_URL=http://backend:8080` when everyone else runs on one host?**
The frontend's `/api/proxy` route is a Next.js server route. On the same Docker
network it can reach the backend directly by container name — no public
round-trip, no extra TLS. Only change it to `https://back.mboempowerment.com` for
the Render split (Option A).

**Do I still need `mbo_youth_emp/.env` for deploys?**
No. Deployment config is the **root** `.env` (or Coolify env vars). The backend
image no longer reads an env file; compose injects every variable. The
`mbo_youth_emp/.env` stays only for **local** Django development.

**I only want the backend running.**
```bash
cd mbo_youth_emp && sudo docker compose up -d --build
```
That compose still ships its own Caddy bound to 80/443 — don't run both stack
compose files on the same host.