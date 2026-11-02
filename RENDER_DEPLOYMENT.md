# Render Deployment Guide — FHC Branch One Archive System

This repository includes a native **Render Blueprint (`render.yaml`)** to enable automated 1-click Infrastructure-as-Code deployment on [Render](https://render.com).

---

## 1. Automated 1-Click Deployment with Render Blueprint (`render.yaml`)

Because this repository contains a `render.yaml` blueprint file, Render automatically provisions:
- The **Node.js Web Service**
- Auto-generated cryptographically secure `JWT_SECRET`
- Persistent Disk mounted at `/data` (1 GB) for preserving physical archive JSON database records across deploys
- Continuous deployment configuration (`npm install && npm run build` -> `npm start`)
- Automated health monitoring mapped to `/api/health`

### To Deploy using Blueprint:
1. Push this repository to your **GitHub** or **GitLab** account:
   ```bash
   git add .
   git commit -m "Add Render Blueprint configuration"
   git push origin main
   ```
2. Log in to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** in the top navigation bar and select **Blueprint**.
4. Connect your repository.
5. Render will automatically parse `render.yaml` and display the proposed resources:
   - **Service Name:** `fhc-branch-one-archive`
   - **Environment:** `production`
   - **Auto-generated Secret:** `JWT_SECRET`
   - **Attached Disk:** `archive-data` (`/data`)
6. Click **Apply**. Render will build and deploy your application automatically.

---

## 2. Blueprint Specification (`render.yaml`)

The repository includes the following `render.yaml`:

```yaml
services:
  - type: web
    name: fhc-branch-one-archive
    runtime: node
    plan: starter
    region: frankfurt
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /api/health
    disk:
      name: archive-data
      mountPath: /data
      sizeGB: 1
    envVars:
      - key: NODE_ENV
        value: production
      - key: JWT_SECRET
        generateValue: true
      - key: MONGODB_URI
        sync: false
      - key: APP_URL
        sync: false
```

> **Note on Free Tier:** Persistent Disks require a paid instance plan (`starter` or higher). If you wish to deploy on Render's **Free Web Service tier**, you can remove the `disk` section and connect an external free MongoDB database (such as MongoDB Atlas M0) by adding `MONGODB_URI` in your Render Environment settings.

---

## 3. Environment Variables Reference

| Key | Managed By | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `render.yaml` | Set to `production`. |
| `JWT_SECRET` | `render.yaml` (`generateValue: true`) | Render auto-generates a secure 256-bit secret. |
| `PORT` | Render Runtime | Render automatically injects and binds this port (e.g. `10000`). |
| `MONGODB_URI` | User / Optional | External MongoDB connection string. If omitted, the app uses the persistent embedded store on the `/data` disk. |
| `APP_URL` | User / Optional | Your public URL (e.g., `https://fhc-branch-one-archive.onrender.com`). |

---

## 4. Built-in Institutional Seed Accounts

Once deployed, you can immediately log in using the initial institutional credentials:

| Role | Username | Default Password | Clearance Level |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin` | `Admin@ET2026!` | Full administrative access |
| **Archive Officer** | `officer.almaz` | `User@ET2026!` | Archival check-in, check-out & barcodes |
| **Department Manager** | `manager.berhanu` | `User@ET2026!` | Approval & requisition reviews |
| **Public Employee** | `employee.selam` | `User@ET2026!` | File loan requests & returns |
| **Federal Auditor** | `auditor.dawit` | `User@ET2026!` | Archival audit logs & chain of custody |

> **Security Reminder:** After initial sign-in, navigate to **User Accounts** or **Settings & RBAC** to update passwords for production security.
