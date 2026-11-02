# Vercel Deployment Guide — FHC Branch One Archive System

This guide explains how to deploy the **FHC Branch One Archive System** (React + Express Serverless API) on **[Vercel](https://vercel.com)**.

---

## 1. Project Architecture on Vercel

The application is structured to run smoothly on Vercel's edge network:
- **Frontend SPA**: Built with Vite and served statically through Vercel's global CDN (`dist/`).
- **Backend API**: The Express API endpoints are exported as a serverless function via `api/index.ts`, configured in `vercel.json`.
- **Database**: Because Vercel serverless functions have a read-only, ephemeral filesystem, **MongoDB Atlas** is recommended for persistent document storage in production. If `MONGODB_URI` is not provided, the serverless function operates with the embedded seed database in memory.

---

## 2. Quick Deploy Instructions

### Option A: Deploy via GitHub / GitLab (Recommended)

1. **Push your repository** to GitHub, GitLab, or Bitbucket:
   ```bash
   git add .
   git commit -m "Configure Vercel deployment with vercel.json and api/index.ts"
   git push origin main
   ```

2. **Log in to Vercel**:
   Go to [https://vercel.com](https://vercel.com) and click **"Add New..."** → **"Project"**.

3. **Import your repository**:
   Select your repository from the list.

4. **Verify Build & Output Settings**:
   Vercel will automatically detect Vite:
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build` *(or leave default `vite build`)*
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

5. **Configure Environment Variables**:
   Under **Environment Variables**, add:
   | Key | Recommended Value | Description |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | Production environment flag |
   | `JWT_SECRET` | *(Generate a secure random string)* | Cryptographic key for JWT session verification |
   | `MONGODB_URI` | `mongodb+srv://<user>:<password>@cluster.mongodb.net/fhc_archive` | Connection string to MongoDB Atlas for persistence |

6. **Click "Deploy"**:
   Vercel will build the frontend assets, bundle the `/api` serverless handler, and provide your live URL (e.g. `https://fhc-branch-one-archive.vercel.app`).

---

### Option B: Deploy via Vercel CLI

If you prefer deploying directly from your terminal:

1. Install the Vercel CLI globally:
   ```bash
   npm install -g vercel
   ```

2. Log in and deploy:
   ```bash
   vercel
   ```

3. To deploy to production:
   ```bash
   vercel --prod
   ```

---

## 3. Configuration Files Included

### `vercel.json`
Configures request routing so `/api/*` routes execute the serverless Express function and all other routes fall back to `/index.html` for client-side React navigation:

```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index.ts"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### `api/index.ts`
Exports the Express application as a serverless handler, initializing the database connection with warm-instance caching.

---

## 4. Default Seed Administrative Accounts

Once deployed, the database initializes with the following default accounts:

| Role | Username | Password | Clearance |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin` | `Admin@ET2026!` | Institutional Admin |
| **Archive Officer** | `officer.almaz` | `User@ET2026!` | Barcodes & Records |
| **Department Manager** | `manager.berhanu` | `User@ET2026!` | Approval Requests |
| **Public Employee** | `employee.selam` | `User@ET2026!` | File Borrowing |
| **Federal Auditor** | `auditor.dawit` | `User@ET2026!` | Chain of Custody Audit |

---

## 5. Verification Checklist

- [ ] Visit `https://<your-project>.vercel.app/api/health` to confirm the serverless function responds with `{ "status": "ok" }`.
- [ ] Log in with `admin` / `Admin@ET2026!`.
- [ ] Verify documents, borrow requests, and physical location coordinates load.
- [ ] Check Vercel **Function Logs** in the project dashboard if you need to debug API invocations.
