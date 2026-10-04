# Pantone Fixed Asset Management System — Client Handover Document

## 1. System Release Summary

The Pantone Fixed Asset Management System (FAM) has been architected, hardened, and verified for production internet deployment. The system enables multi-company fixed asset tracking across **Pantone Apparels** and **Pantone Garments**, supporting web browsers and mobile Android devices over public internet, 4G/5G, and corporate networks.

### Production Endpoints
- **Web Application:** `https://fam.pantone.com/`
- **Mobile & REST API:** `https://fam.pantone.com/api/v1/`
- **Health Check Probe:** `https://fam.pantone.com/health`
- **Readiness Probe:** `https://fam.pantone.com/api/v1/health/ready`

---

## 2. Production Android Application Release

The mobile application has been built, hardened, and signed with the rotated production keystore.

### Release Artifact Details
- **Binary:** `Pantone-FAM-v1.0.0-release.apk`
- **Package Name:** `com.pantone.fam`
- **Version Code:** `1`
- **Version Name:** `1.0.0`
- **Minimum Android SDK:** 26 (Android 8.0 Oreo)
- **Target Android SDK:** 34 (Android 14)
- **File Size:** `26,651,376 bytes` (~25.4 MB)
- **SHA-256 Checksum:** `65494D9A5561F20F3A75978E6F0ED790BA87DB3C3F6CD6D467674F21FCE8ACEF`
- **Signature Verification:** APK Signature Scheme v2 (Verified via `apksigner`)
- **Certificate SHA-256:** `beb65b8660a1f854d8d0283d29f994ce05644a15bd43d06b57171fa6c87b338b`
- **Debuggable:** `false` (Strict production build)
- **Network Security:** Strict HTTPS enforced via `network_security_config.xml`. All cleartext HTTP traffic prohibited for production domains.

### Download Locations
- **Conversation Artifact:** [app-release.apk](file:///C:/Users/Adilj/.gemini/antigravity/brain/9c61a9cf-c528-4899-9951-492ed57a9a4b/app-release.apk)
- **Local Downloads Path:** `C:\Users\Adilj\Downloads\Pantone-FAM-v1.0.0-release.apk`

---

## 3. Client IT / DevOps Actions Required for Internet Go-Live

To make `https://fam.pantone.com` accessible globally across all client networks and mobile 4G/5G devices, the client IT infrastructure team must complete three standard external infrastructure actions:

### Step 1: DNS A-Record Configuration
Create an A-record in the authoritative DNS provider for `pantone.com`:
```
Hostname: fam.pantone.com
Type:     A
Value:    <PUBLIC_STATIC_IP_OF_YOUR_SERVER>
TTL:      300
```

### Step 2: Provision Cloud/Host Server
Deploy a Linux host (Ubuntu 22.04 LTS recommended) with Docker and Docker Compose installed:
```bash
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin
```

### Step 3: Run Production Docker Compose Stack
Clone or transfer the project files and launch the stack:
```bash
cd /opt/pantone-fam
docker compose -f docker-compose.production.yml up -d
docker exec -it pantone-backend-api npm run migrate
docker exec -it pantone-backend-api npm run seed
```

### Step 4: Issue TLS / SSL Certificate
Issue the production TLS certificate using Certbot:
```bash
sudo certbot certonly --webroot -w /var/www/certbot -d fam.pantone.com
docker exec pantone-reverse-proxy nginx -s reload
```

---

## 4. Default Seed Administrative Accounts & Credential Rotation

During the initial bootstrap seed (`npm run seed`), initial administrative accounts are generated. **The client security administrator MUST log in and rotate these passwords immediately upon first go-live:**

| Account Code | Initial Username | Role / Scope | Action Required |
| :--- | :--- | :--- | :--- |
| `COMMON_ADMIN` | `common_admin` | Global System Administrator | **Rotate password immediately** |
| `APPARELS_ADMIN` | `apparels_admin` | Company Admin (Pantone Apparels) | **Rotate password immediately** |
| `GARMENTS_ADMIN` | `garments_admin` | Company Admin (Pantone Garments) | **Rotate password immediately** |

---

## 5. Mobile Usage Instructions (Android)

1. Distribute `Pantone-FAM-v1.0.0-release.apk` to authorized company devices.
2. Install the APK (enable installation of company enterprise APKs if prompted).
3. Launch the app. The sign-in screen defaults directly to:
   ```
   https://fam.pantone.com/api/v1/
   ```
4. Users log in with their assigned corporate credentials.
5. The app communicates directly over HTTPS with the production domain, functioning seamlessly over corporate Wi-Fi, home Wi-Fi, and mobile carrier cellular data (4G/5G).
