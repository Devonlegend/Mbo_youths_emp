#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Mbo portal — VPS firewall (UFW) + Docker hardening.
#
# Usage (on the VPS, as root):
#   bash deploy/firewall.sh            # SSH on 22
#   bash deploy/firewall.sh 2222       # custom SSH port
#   ADMIN_CIDR=203.0.113.10/32 bash deploy/firewall.sh   # open Coolify dashboard to one IP
#
# Rules applied:
#   * default deny incoming / allow outgoing
#   * SSH (rate-limited), HTTP, HTTPS
#   * Coolify dashboard (8000): closed unless ADMIN_CIDR is set — access
#     it via `ssh -L 8000:localhost:8000 user@vps`
#   * Docker-published ports that must stay private (5432, 6379, 3000,
#     8080) are DROPPED in the DOCKER-USER chain, because UFW does NOT
#     manage Docker's iptables rules. Only 80/443 reach the outside.
#
# NOTE: these DOCKER-USER rules do NOT survive a reboot on their own —
# iptables-persistent typically restores before docker.service creates
# the DOCKER-USER chain, so the restore silently no-ops and Docker then
# recreates the chain empty. Pair this script with a systemd drop-in
# (ExecStartPost on docker.service) that reapplies the Docker-hardening
# block below after every Docker start. See deploy/README for the unit
# file — don't rely on `netfilter-persistent save` alone for this part.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

SSH_PORT="${1:-22}"
ADMIN_CIDR="${ADMIN_CIDR:-}"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root (e.g. sudo bash deploy/firewall.sh)" >&2
  exit 1
fi

# ── UFW ──────────────────────────────────────────────────────────────
command -v ufw >/dev/null 2>&1 || { echo "installing ufw..."; apt-get update -y && apt-get install -y ufw; }

echo "==> resetting UFW to a clean state"
ufw --force reset >/dev/null

echo "==> default policies (deny in, allow out)"
ufw default deny incoming
ufw default allow outgoing

echo "==> SSH (port ${SSH_PORT}/tcp, rate-limited)"
ufw limit "${SSH_PORT}/tcp" comment 'SSH'

echo "==> HTTP / HTTPS"
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

if [[ -n "${ADMIN_CIDR}" ]]; then
  echo "==> Coolify dashboard (8000) locked to ${ADMIN_CIDR}"
  ufw allow from "${ADMIN_CIDR}" to any port 8000/tcp comment 'Coolify dashboard'
  ADMIN_ACCEPT=1
else
  echo "==> Coolify dashboard (8000) NOT exposed — use an SSH tunnel"
  ADMIN_ACCEPT=0
fi

echo "==> enabling UFW"
ufw --force enable

echo
echo "==> Docker hardening (DOCKER-USER chain)"
# Flush our previous rules so re-runs don't stack.
iptables -F DOCKER-USER 2>/dev/null || true

# Drop the sensitive ports first, THEN insert the admin ACCEPT rule.
# `iptables -I` with no rule number always inserts at position 1 (top
# of chain), so whichever insert happens LAST ends up evaluated FIRST.
# Doing the ACCEPT insert before the DROP loop (the original bug)
# buries the ACCEPT rule under all five DROPs — including the DROP
# for port 8000 itself — so the admin IP would be silently blocked
# from the dashboard even though ADMIN_CIDR was set correctly.
for port in 5432 6379 3000 8080 8000; do
  iptables -I DOCKER-USER -p tcp --dport "${port}" -j DROP
  echo "   - dropped external → ${port}"
done

if [[ "${ADMIN_ACCEPT}" == "1" ]]; then
  iptables -I DOCKER-USER 1 -s "${ADMIN_CIDR}" -p tcp --dport 8000 -j ACCEPT
  echo "   - allowed ${ADMIN_CIDR} → 8000 (Coolify dashboard)"
fi

# Persist iptables across reboots.
# (See the header note: this alone is not sufficient for DOCKER-USER —
# pair with a docker.service ExecStartPost drop-in.)
command -v netfilter-persistent >/dev/null 2>&1 || { echo "installing iptables-persistent..."; echo iptables-persistent iptables-persistent/autosave_v4 boolean true | debconf-set-selections; echo iptables-persistent iptables-persistent/autosave_v6 boolean true | debconf-set-selections; apt-get install -y iptables-persistent; }
netfilter-persistent save >/dev/null

echo
echo "==> DONE. UFW status:"
ufw status verbose

echo
echo "What's open now:"
echo "  22   (SSH, limited)    80 / 443  (web + TLS via Caddy)"
[[ "${ADMIN_ACCEPT}" == "1" ]] && echo "  8000 (Coolify dashboard, only from ${ADMIN_CIDR})" || echo "  8000 closed — ssh -L 8000:localhost:8000 user@vps for Coolify"