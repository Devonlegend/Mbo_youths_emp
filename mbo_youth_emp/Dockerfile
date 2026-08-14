FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Build-time env: there is no .env in the image, and settings.py refuses to
# load when DEBUG=False and SECRET_KEY is empty. A throwaway key lets
# collectstatic run; runtime secrets are injected by compose/Coolify.
RUN SECRET_KEY=docker-build python manage.py collectstatic --no-input

EXPOSE 8080

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8080"]
