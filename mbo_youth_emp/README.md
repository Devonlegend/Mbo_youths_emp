# Mbo Youth Empowerment API — Backend

Django REST backend for the Mbo LGA youth scholarship / grant / empowerment portal.
Cookie-based JWT auth (httpOnly `access_token` / `refresh_token`) with an email-OTP step.

- Django 6.0 + DRF, PostgreSQL, Redis + Celery, Cloudinary (media), Brevo (email), Paystack (payments)
- Docs: `/api/docs/` (Swagger), `/api/redoc/`, schema at `/api/schema/`

---

## Local development

### 1. Setup

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # macOS/Linux

pip install -r requirements.txt
```

### 2. Environment

```bash
cp .env.example .env
```

Fill in the local values. Sensible defaults exist for dev, so `SECRET_KEY`, a local
Postgres connection, and `BREVO_MOCK_MODE=True` / `PAYSTACK_MOCK_MODE=True` will get
you running without external accounts.

### 3. Run

```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Celery (optional in dev, eager mode is the default when `DEBUG=True`):

```bash
celery -A config worker -l info
```

---

## Production deployment (Docker, VPS)

The repo ships a `Dockerfile` and `docker-compose.yml` that run the whole stack:
Postgres, Redis, the backend (gunicorn), a Celery worker, and Caddy (reverse proxy +
automatic HTTPS). This guide assumes an Ubuntu VPS.

### 1. Install Docker on the VPS

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
```

### 2. Clone the repo

```bash
sudo apt install -y git
git clone https://github.com/Devonlegend/Mbo_youths_emp.git
cd Mbo_youths_emp
```

### 3. Create the `.env`

Copy `.env.example` and set production values. Required:

```
DEBUG="False"
ENVIRONMENT=production
SECRET_KEY=<generate: python3 -c "import secrets; print(secrets.token_urlsafe(64))">
ALLOWED_HOSTS=api.mboempowerment.com
DOMAIN=api.mboempowerment.com

# PostgreSQL — compose injects DB_HOST/DB_PORT to the db service automatically
DB_NAME=mbo_portal_v2
DB_USER=postgres
DB_PASSWORD=<strong-password>

# Frontend origin(s)
CORS_ALLOWED_ORIGINS=https://www.mboempowerment.com,https://mboempowerment.com,https://<render-app>.onrender.com
CSRF_TRUSTED_ORIGINS=https://www.mboempowerment.com,https://mboempowerment.com,https://<render-app>.onrender.com
PORTAL_URL=https://www.mboempowerment.com

# Cross-site cookie auth
JWT_COOKIE_SECURE="True"
JWT_COOKIE_SAMESITE="None"

# Services — leave eager OFF in production
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_TASK_ALWAYS_EAGER="False"

# Integrations — real credentials for production
BREVO_API_KEY=...
BREVO_MOCK_MODE="False"
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_MOCK_MODE="False"
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### 4. Build and start

```bash
sudo docker compose up -d --build
```

What comes up:

| Service   | Purpose                                        | Exposed port |
|-----------|------------------------------------------------|--------------|
| `db`      | PostgreSQL (data persists in the `pgdata` volume) | 5432       |
| `redis`   | Celery broker                                  | —            |
| `backend` | Django + gunicorn, runs migrations on boot     | 8080         |
| `worker`  | Celery worker                                  | —            |
| `caddy`   | Reverse proxy, automatic Let's Encrypt TLS     | 80, 443      |

Migrations run automatically on startup. Create an admin user:

```bash
sudo docker compose exec backend python manage.py createsuperuser
```



Verify:

```bash
curl https://back.mboempowerment.com/api/schema/
```

### 6. Deploy updates

```bash
git pull
sudo docker compose up -d --build
```

The Postgres data and Caddy certs live in Docker volumes, so they survive rebuilds.

---

## Common tasks

| Task                                    | Command                                                        |
|-----------------------------------------|----------------------------------------------------------------|
| View status                             | `sudo docker compose ps`                                       |
| Follow backend logs                     | `sudo docker compose logs -f backend`                          |
| Open a Postgres shell                   | `sudo docker compose exec db psql -U postgres -d mbo_portal_v2` |
| Rebuild a single service                | `sudo docker compose up -d --build backend`                    |
| Connect from pgAdmin (via SSH tunnel)   | Host `localhost`, port `5432`, user `postgres`                 |

> Security note: don't open port 5432 to the public internet. Use an SSH tunnel
> (pgAdmin's SSH Tunnel tab) or `ssh -L 5432:localhost:5432 user@vps` instead.

---

## Architecture notes

- **Auth**: cookie-based JWT (`accounts.authentication.CookieJWTAuthentication`),
  cross-site (`SameSite=None; Secure`) so the Render-hosted frontend and the VPS API
  can exchange cookies. CORS is locked down via `CORS_ALLOWED_ORIGINS`.
- **Media**: uploaded to Cloudinary, nothing persisted on the server.
- **Static**: served by whitenoise, collected at Docker build time.
- **Payments / email**: Paystack and Brevo with mock modes for development.
- **NIN hashing**: SHA-256 with a server-only `NIN_HASH_PEPPER` (defaults to `SECRET_KEY`).
