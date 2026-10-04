# PANTONE FAM — ZERO-COST FREE-TIER INTERNET DEPLOYMENT GUIDE

This guide provides the complete, field-tested instructions to deploy the entire **Pantone Fixed Asset Management System** to the public internet at **\$0.00 / month** using verified free-tier cloud platforms.

---

## 1. Zero-Cost Production Architecture

```
[ Android Mobile Device ]                           [ Web Browsers ]
 (Cellular 4G/5G / Remote Wi-Fi)                 (Remote Workstations / Anywhere)
                │                                                │
                │ HTTPS                                          │ HTTPS
                │                                                ▼
                │                                   ┌─────────────────────────┐
                │                                   │    VERCEL HOBBY TIER    │
                │                                   │     Next.js 14 Web      │
                │                                   │ https://<app>.vercel.app│
                │                                   └────────────┬────────────┘
                │                                                │
                │                                                │ Rewrites /api/v1/*
                ▼                                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RENDER FREE WEB SERVICE                           │
│                      Node.js 20+ / Express API Service                      │
│                    https://pantone-fam-api.onrender.com                     │
│                        - HOST=0.0.0.0, PORT=10000                           │
│                        - TRUST_PROXY=true                                   │
│                        - CORS_ORIGIN=https://<app>.vercel.app               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
        ┌──────────────────────────────┴──────────────────────────────┐
        ▼                                                             ▼
┌──────────────────────────────┐                       ┌──────────────────────────────┐
│   SUPABASE / NEON POSTGRES   │                       │      SUPABASE STORAGE /      │
│   Free Managed PostgreSQL    │                       │        CLOUDFLARE R2         │
│  - Storage: 500 MB (Free)    │                       │   Persistent Object Storage  │
│  - SSL Required (DB_SSL=true)│                       │  - Company-isolated buckets  │
│  - Migrations 001-009        │                       │  - MIME allowlist            │
└──────────────────────────────┘                       └──────────────────────────────┘
```

---

## 2. Monthly Cost Breakdown

| Component | Provider & Tier | Cost | Limits / Quotas |
| :--- | :--- | :--- | :--- |
| **Database** | Supabase Free / Neon Free | **\$0.00** | 500 MB database, pooled connections, SSL |
| **Backend API** | Render Free Web Service | **\$0.00** | 750 free instance hours/month, 512 MB RAM |
| **Frontend Web** | Vercel Hobby Tier | **\$0.00** | Unlimited serverless invocations, 100 GB bandwidth |
| **File Storage** | Supabase Storage Free Tier | **\$0.00** | 1 GB bucket storage |
| **SSL/TLS Certificates** | Vercel & Render Automated | **\$0.00** | Wildcard / SNI Let's Encrypt certificates |
| **Total Cost** | — | **\$0.00 / mo** | 100% Genuine Free Tier |

---

## 3. Step-by-Step Deployment Instructions

### STEP 1: Provision Free PostgreSQL Database (Supabase or Neon)

1. Go to [https://supabase.com](https://supabase.com) (or [https://neon.tech](https://neon.tech)) and sign up for a free account (no credit card required).
2. Create a new project:
   - Project Name: `pantone-fam`
   - Database Password: *(Generate a strong 24-character password and record it)*
   - Region: Select region closest to your users (e.g., `AWS eu-central-1` or `AWS ap-south-1`).
3. Under **Project Settings -> Database -> Connection string -> URI**, copy your connection string:
   ```
   postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```

### STEP 2: Run Database Migrations & Seed Data

From your local machine, run migrations against the remote database:

```powershell
# Set remote database connection string
$env:DATABASE_URL = "postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"
$env:DB_SSL = "true"

# Navigate to backend and apply migrations
cd backend
npm run migrate

# Seed initial enterprise roles, permissions, and administrators
npm run seed
```

All 9 migrations (001–009) will apply automatically to the cloud PostgreSQL cluster.

---

### STEP 3: Deploy Backend API on Render (Free Tier)

1. Push your repository to a GitHub repository (e.g. `https://github.com/your-username/pantone-fam`).
2. Log into [https://render.com](https://render.com) and click **New + -> Web Service**.
3. Connect your GitHub repository:
   - **Name:** `pantone-fam-api`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
4. Add Environment Variables in the Render dashboard:
   - `NODE_ENV`: `production`
   - `HOST`: `0.0.0.0`
   - `DATABASE_URL`: *(Your Supabase connection string from Step 1)*
   - `DB_SSL`: `true`
   - `TRUST_PROXY`: `true`
   - `JWT_SECRET`: *(Generate 64 random characters)*
   - `JWT_EXPIRES_IN`: `15m`
   - `JWT_REFRESH_SECRET`: *(Generate 64 random characters)*
   - `JWT_REFRESH_EXPIRES_IN`: `7d`
   - `CORS_ORIGIN`: `*` *(or update with your Vercel URL once deployed in Step 4)*
5. Click **Create Web Service**.
   - Render will build and deploy the API, providing a public HTTPS URL:
   - Example: `https://pantone-fam-api.onrender.com`

---

### STEP 4: Deploy Frontend Web App on Vercel (Free Tier)

1. Log into [https://vercel.com](https://vercel.com) and click **Add New... -> Project**.
2. Select your GitHub repository:
   - **Root Directory:** `frontend`
   - **Framework Preset:** `Next.js`
3. Add Environment Variables:
   - `NEXT_PUBLIC_API_URL`: `/api/v1`
   - `INTERNAL_BACKEND_URL`: `https://pantone-fam-api.onrender.com`
4. Click **Deploy**.
   - Vercel will build the 41 routes and publish your web application:
   - Example: `https://pantone-fam.vercel.app`
5. *(Optional)* Return to Render and update `CORS_ORIGIN`:
   ```
   CORS_ORIGIN=https://pantone-fam.vercel.app
   ```

---

### STEP 5: Connect Android Application

1. Open the **Pantone FAM** Android app.
2. On the Login screen, click **"Configure Server"**.
3. Enter your live Render backend URL:
   ```
   https://pantone-fam-api.onrender.com/api/v1/
   ```
4. Click **"Save Server"**.
5. Log in with your enterprise credentials:
   - **Common Admin:** `common_admin` / `PantoneAdmin#2026!`
   - **Apparels Admin:** `apparels_admin` / `ApparelsAdmin#2026!`
   - **Garments Admin:** `garments_admin` / `GarmentsAdmin#2026!`

Alternatively, update `android/app/build.gradle.kts` release config with `https://pantone-fam-api.onrender.com/api/v1/` and compile a dedicated APK.

---

## 4. Free-Tier Limitations & Operational Realities

| Platform | Free-Tier Behavior | Operational Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| **Render** | Spins down after 15 minutes of inactivity | First request after idle takes 50–70s (cold start) | Acceptable for testing/staging. Use a free monitoring ping (e.g., UptimeRobot) every 14 mins to keep warm if desired. |
| **Supabase** | Free project pauses after 7 days without traffic | Database unreachable until unpaused in dashboard | Single click unpause in Supabase dashboard. |
| **Vercel** | Edge functions limited to 10s execution time | Very large CSV/XLSX exports might approach limit | Current exports complete in <500ms; well within limits. |
| **File Storage** | Render ephemeral filesystem wipes local `/uploads` on redeploy | Uploaded attachments lost upon container restart | Use Supabase Storage bucket for permanent asset attachments. |

---

## 5. Transition to Full Production Architecture

When migrating to a paid dedicated virtual machine (e.g. AWS EC2, DigitalOcean, Hetzner):
1. Point your domain A-record `fam.pantone.com` to the server public IP.
2. Deploy the included `docker-compose.production.yml` with Nginx reverse proxy.
3. Cold starts disappear completely, and database storage is unlimited.
