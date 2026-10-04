# Pantone Fixed Asset Management System — Production Setup & Configuration

## 1. System Environment Architecture

The system supports strict three-tier environment isolation:

| Parameter | Development | Staging | Production |
| :--- | :--- | :--- | :--- |
| **API Base URL** | `http://127.0.0.1:5000/api/v1` | `https://staging-fam.pantone.com/api/v1` | `https://fam.pantone.com/api/v1` |
| **Web URL** | `http://localhost:3000` | `https://staging-fam.pantone.com` | `https://fam.pantone.com` |
| **Android Release Target** | Dev loopback (`10.0.2.2`) | Staging Profile | Production Profile (Default) |
| **Protocol** | HTTP permitted for loopback | Strict HTTPS only | Strict HTTPS only |
| **PostgreSQL Access** | Local `127.0.0.1` | Private VPC internal | Private Docker Network (`postgres:5432`) |
| **CORS Policy** | Localhost origins | `https://staging-fam.pantone.com` | `https://fam.pantone.com` |
| **Rate Limiting** | Disabled in tests | Active (bursts allowed) | Active (strict enforcement) |
| **Error Details** | Stack traces enabled | Sanitized error codes | Sanitized error codes (`request_id` only) |

---

## 2. Infrastructure Setup & Network Hardening

### Private PostgreSQL Network Setup
PostgreSQL MUST NOT be bound to `0.0.0.0` or mapped to external ports on the host. In `docker-compose.production.yml`:
```yaml
postgres:
  image: postgres:18-alpine
  networks:
    - pantone-net  # Internal bridge only
  # Notice: No 'ports:' section exposing 5432 to host
```

### PostgreSQL Performance Configuration
Recommended production parameters in `postgresql.conf`:
```ini
max_connections = 100
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 32MB
maintenance_work_mem = 512MB
min_wal_size = 1GB
max_wal_size = 4GB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
```

---

## 3. Persistent File Storage Architecture

Asset photos, barcode labels, and inspection proof attachments are stored on persistent host volumes mounted to `/var/data/pantone/uploads`.

### Directory Layout
```
/var/data/pantone/uploads/
└── tenants/
    ├── PANTONE-APP/
    │   ├── assets/
    │   ├── inspections/
    │   ├── maintenance/
    │   └── documents/
    └── PANTONE-GAR/
        ├── assets/
        ├── inspections/
        ├── maintenance/
        └── documents/
```

### Security Enforcement in Storage Service
1. **Path Traversal Protection:** Absolute paths are validated to ensure they cannot escape `/var/data/pantone/uploads`.
2. **Tenant Isolation:** Asset files belonging to Pantone Apparels cannot be read by users scoped to Pantone Garments.
3. **MIME Type Allowlist:** Restricted to `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `text/csv`.
4. **File Size Limit:** 10 MB per file maximum.

---

## 4. Production Security Checklist

- [x] Strict HTTPS required for all production API routes.
- [x] Cleartext traffic (`usesCleartextTraffic`) removed from Android production manifest.
- [x] Android network security config configured with strict system certificates.
- [x] Production Android release signed with rotated private keystore (`pantone-release-v2.keystore`).
- [x] Database port 5432 isolated within private Docker network.
- [x] Rate limiting active on `/api/v1/auth/login` and `/api/v1/auth/refresh`.
- [x] Helmet security headers active (CSP, HSTS, X-Frame-Options, X-Content-Type-Options).
- [x] CORS origin restricted to `https://fam.pantone.com` in production.
- [x] Error handling sanitizes stack traces and returns correlation `request_id`.
- [x] Automated database backup script with SHA-256 integrity verification.
- [x] Liveness (`/health/live`) and readiness (`/health/ready`) probes active.
