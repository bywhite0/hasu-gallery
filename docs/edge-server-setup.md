# Edge Server Database Setup (Secure)

> **Security notice (2026-07):** The previous copy-paste guide that opened
> PostgreSQL to `0.0.0.0/0` with a fixed password and `md5` is **withdrawn**.
> Do not use it. If any host was configured that way, rotate the database
> password immediately, audit login history, and re-lock network access.

This document is for **private / lab / edge** hosts where the API and Postgres
run on the same machine or a private network. It is **not** a public internet
database installation guide.

## Principles

1. Postgres listens on localhost or a private interface only.
2. Authentication uses a **strong unique password** (or SCRAM), never a shared
   example password from this repo.
3. Port `5432` is **not** exposed to the public internet.
4. Connection strings stay in a secret manager or a local env file that is not
   committed. Do not print credentials into shell history or chat logs.
5. Prefer SSH tunnel, Tailscale/WireGuard, or a private VPC over opening DB ports.

## Recommended topologies

### A. Same host as the API (preferred for a single edge box)

- Postgres: `listen_addresses = 'localhost'`
- API: `DATABASE_URL=postgres://APP_USER:APP_PASSWORD@127.0.0.1:5432/hasu_gallery`
- Firewall: no public `5432`

### B. Private network / VPN only

- Postgres listens on a private interface or VPN IP
- `pg_hba.conf` allows only the API host CIDR (example: `10.0.0.0/8` or your VPN range)
- Prefer `scram-sha-256` over legacy `md5`
- Cloud security groups / host firewall still block public `5432`

### C. Developer access without exposing Postgres

```bash
# From your workstation: forward local 15432 to remote localhost:5432
ssh -N -L 15432:127.0.0.1:5432 user@edge-host
```

Then set:

```env
DATABASE_URL=postgres://APP_USER:APP_PASSWORD@127.0.0.1:15432/hasu_gallery
```

## Install outline (Debian/Ubuntu)

Replace placeholders yourself. Do **not** copy example passwords into production.

```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

Create a role and database as the `postgres` superuser:

```bash
# Generate a password locally, e.g.:
# openssl rand -base64 32

sudo -u postgres psql <<'SQL'
CREATE USER app_user WITH PASSWORD 'REPLACE_WITH_STRONG_SECRET';
CREATE DATABASE hasu_gallery OWNER app_user;
\c hasu_gallery
GRANT ALL ON SCHEMA public TO app_user;
SQL
```

Keep Postgres local-only unless you intentionally use topology B:

```bash
# Confirm listen address stays local
sudo -u postgres psql -c "SHOW listen_addresses;"
# Expected for topology A: localhost
```

If you previously appended `host all all 0.0.0.0/0 md5` to `pg_hba.conf` or set
`listen_addresses = '*'`, remove those lines, restart Postgres, rotate the
password, and verify public probes to `5432` fail.

## Firewall

Do **not** open `5432/tcp` to the world.

```bash
# UFW example: allow SSH only (adjust for your admin access model)
# ufw allow OpenSSH
# ufw enable
# Do not run: ufw allow 5432/tcp
```

## Application configuration

On the API host (or via tunnel), put secrets only in env / secret storage:

```env
DATABASE_URL=postgres://APP_USER:APP_PASSWORD@127.0.0.1:5432/hasu_gallery
```

Apply migrations, then start the API from the repo root:

```powershell
# PowerShell on the development machine or edge host
$env:DATABASE_URL = "postgres://APP_USER:APP_PASSWORD@127.0.0.1:5432/hasu_gallery"
# apply backend/migrations/*.sql in lexical order, then:
pnpm dev:api
```

Expected health check:

```text
Connecting to database...
Running migrations...
Migrations completed
hasu-gallery API listening at http://127.0.0.1:8787
```

```bash
curl -sS http://127.0.0.1:8787/health
```

## Incident response if the old guide was used

1. Immediately rotate the database password and update `DATABASE_URL`.
2. Inspect Postgres logs and active roles/extensions/scheduled jobs.
3. Confirm no public security group / firewall rule allows `5432`.
4. Verify backups and data integrity.
5. Record date, owner, and remediation result for ops history.

## Related docs

- Deployment: [deployment.md](deployment.md)
- Monitoring: [monitoring.md](monitoring.md)
