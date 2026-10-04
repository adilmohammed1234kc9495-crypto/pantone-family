# Pantone Fixed Asset Management System — Production Deployment Guide

## 1. System Overview & Architecture

The Pantone Fixed Asset Management System (FAM) production deployment uses a four-tier architecture designed for internet scale, multi-tenancy, and security isolation:

```
                              PUBLIC INTERNET
                                     │
                                     │ HTTPS (Port 443)
                                     ▼
                      Domain: https://fam.pantone.com
                                     │
                                     ▼
                         Reverse Proxy (Nginx)
                     TLS Termination / Security Headers
                                     │
             ┌───────────────────────┴───────────────────────┐
             │                                               │
             ▼                                               ▼
       Frontend (Next.js)                            Backend API (Express)
    Internal: Port 3000                             Internal: Port 5000
    Routes: /                                       Routes: /api/v1/
                                                             │
                                                             ▼
                                                    PostgreSQL Database
                                                   Port 5432 (PRIVATE)
```

### Security Isolation Principles
- **No Direct Database Exposure:** PostgreSQL is on an internal, private network and NEVER accessible directly over the internet.
- **TLS 1.2 / 1.3 Strict Enforcement:** All HTTP traffic on port 80 is permanently redirected (301) to HTTPS on port 443.
- **HSTS & Secure Headers:** Preloaded `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and strict CORS policies.
- **Mobile Access:** Native Android client connects to `https://fam.pantone.com/api/v1/` over cellular (4G/5G) or any external Wi-Fi without LAN or private IP dependencies.

---

## 2. Server & Infrastructure Requirements

### Minimum Hardware
- **CPU:** 4 vCPU cores (x86_64 or ARM64)
- **RAM:** 8 GB ECC RAM (16 GB recommended for high concurrent load)
- **Disk:** 80 GB SSD / NVMe storage
- **Operating System:** Ubuntu 22.04 LTS / Debian 12 / Rocky Linux 9

### Network & Firewall Rules
| Port | Protocol | Source | Destination | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **80** | TCP | Public Internet (`0.0.0.0/0`) | Host | HTTP Challenge & HTTPS Redirect |
| **443** | TCP | Public Internet (`0.0.0.0/0`) | Host | Production HTTPS Web & Mobile API |
| **22** | TCP | Admin Bastion / VPN | Host | Secure SSH Administration |
| **5000** | TCP | INTERNAL ONLY (`127.0.0.1` / Docker) | Backend | Internal API Service (DO NOT EXPOSE) |
| **3000** | TCP | INTERNAL ONLY (`127.0.0.1` / Docker) | Frontend | Internal Next.js App (DO NOT EXPOSE) |
| **5432** | TCP | INTERNAL ONLY (`backend` container) | Database | Private PostgreSQL (DO NOT EXPOSE) |

---

## 3. Domain & DNS Configuration

1. Contact the corporate DNS registrar / Cloudflare / Route53 administrator for `pantone.com`.
2. Create an **A Record** pointing `fam.pantone.com` to the server's public static IPv4 address:
   ```
   Type:  A
   Host:  fam
   Name:  fam.pantone.com
   Value: <PRODUCTION_SERVER_PUBLIC_IP>
   TTL:   300 (or Auto)
   ```
3. (Optional IPv6): Create an **AAAA Record** pointing to the public IPv6 address if applicable.
4. Verify DNS propagation:
   ```bash
   dig +short fam.pantone.com
   # Output should match <PRODUCTION_SERVER_PUBLIC_IP>
   ```

---

## 4. HTTPS & TLS Certificate Provisioning

### Using Let's Encrypt (Certbot)
1. Install Certbot on the host:
   ```bash
   sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx
   ```
2. Request a certificate using the standalone or webroot authenticator:
   ```bash
   sudo certbot certonly --webroot -w /var/www/certbot \
     -d fam.pantone.com \
     --email admin@pantone.com --agree-tos --no-eff-email
   ```
3. Certificates will be stored at:
   - Full Chain: `/etc/letsencrypt/live/fam.pantone.com/fullchain.pem`
   - Private Key: `/etc/letsencrypt/live/fam.pantone.com/privkey.pem`
4. Set up automatic renewal cron:
   ```bash
   echo "0 3 * * * root certbot renew --quiet --post-hook 'docker exec pantone-reverse-proxy nginx -s reload'" | sudo tee /etc/cron.d/certbot-renew
   ```

---

## 5. Environment Variables & Secret Configuration

Copy the production template:
```bash
cp backend/.env.production.template backend/.env
```
Generate high-entropy random secrets (NEVER use default or example passwords in production):
```bash
# Generate 64-character hex strings
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-20)
```

Configure `backend/.env`:
```ini
NODE_ENV=production
HOST=0.0.0.0
PORT=5000
API_PREFIX=/api/v1
TRUST_PROXY=true

STORAGE_PATH=/var/data/pantone/uploads

DB_HOST=postgres
DB_PORT=5432
DB_USER=pantone_prod_user
DB_PASSWORD=<GENERATED_DB_PASSWORD>
DB_NAME=pantone_fam
DB_SSL=false
DB_POOL_MIN=4
DB_POOL_MAX=25

JWT_SECRET=<GENERATED_JWT_SECRET>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<GENERATED_JWT_REFRESH_SECRET>
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGIN=https://fam.pantone.com
```

---

## 6. Containerized Deployment (Docker Compose)

1. Clone or sync the repository to the production host:
   ```bash
   cd /opt/pantone-fam
   ```
2. Build and launch all services:
   ```bash
   docker compose -f docker-compose.production.yml build
   docker compose -f docker-compose.production.yml up -d
   ```
3. Run migrations and database seeding:
   ```bash
   # Run schema migrations (001 through 009)
   docker exec -it pantone-backend-api npm run migrate

   # Run initial bootstrap seed (creates roles, companies, initial admin accounts)
   docker exec -it pantone-backend-api npm run seed
   ```
4. Check service health:
   ```bash
   docker compose -f docker-compose.production.yml ps
   ```

---

## 7. Health Checks & Verification

Verify each endpoint:
```bash
# 1. Liveness probe
curl -I https://fam.pantone.com/health

# 2. Readiness probe (verifies database connectivity)
curl -s https://fam.pantone.com/api/v1/health/ready | jq .
# Expected: { "success": true, "data": { "status": "UP", "database": "CONNECTED" } }

# 3. HTTP to HTTPS redirect verification
curl -I http://fam.pantone.com/
# Expected: HTTP/1.1 301 Moved Permanently -> Location: https://fam.pantone.com/

# 4. Security Headers verification
curl -I https://fam.pantone.com/
# Expected: Strict-Transport-Security, X-Content-Type-Options: nosniff, X-Frame-Options: DENY
```

---

## 8. Database Backup & Disaster Recovery

### Automated Daily Backup Setup
Add to `/etc/cron.d/pantone-backup`:
```bash
0 2 * * * root /opt/pantone-fam/scripts/backup-db.sh /var/backups/pantone_fam >> /var/log/pantone-backup.log 2>&1
```

### Manual Backup Command
```bash
./scripts/backup-db.sh /var/backups/pantone_fam
```

### Restore Procedure
```bash
./scripts/restore-db.sh /var/backups/pantone_fam/pantone_fam_backup_YYYYMMDD_HHMMSS.sql.gz
```

---

## 9. Rollback Procedure

If an upgrade deployment encounters critical failures:
1. Revert container image to previous tag:
   ```bash
   docker compose -f docker-compose.production.yml down
   git checkout <PREVIOUS_STABLE_TAG>
   docker compose -f docker-compose.production.yml build
   docker compose -f docker-compose.production.yml up -d
   ```
2. If database schema was affected, restore from pre-deployment snapshot:
   ```bash
   ./scripts/restore-db.sh /var/backups/pantone_fam/pre_upgrade_snapshot.sql.gz
   ```
3. Verify readiness via `https://fam.pantone.com/api/v1/health/ready`.
