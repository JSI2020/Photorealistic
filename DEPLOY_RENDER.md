# Deploy on Render (step-by-step)

Your code is already on GitHub: https://github.com/JSI2020/Photorealistic

If Render only shows an old repo (e.g. `fsp`), Render’s GitHub App does **not** have permission to see `Photorealistic` yet.

## A) Give Render access to this repo (required)

1. Open: https://github.com/settings/installations  
   (or: https://github.com/apps/render/installations/new )
2. Find **Render** → click **Configure**
3. Under **Repository access**:
   - either choose **All repositories**, or
   - **Only select repositories** → add **Photorealistic**
4. Click **Save**

## B) Create the Web Service on Render

1. Open: https://dashboard.render.com
2. **New +** → **Web Service**
3. Connect GitHub if asked
4. Select repo **Photorealistic** → **Connect**
5. Settings:
   - **Name:** `sketch-photoreal` (anything you like)
   - **Language / Runtime:** **Docker** (uses the repo `Dockerfile`)
   - **Branch:** `main`
   - **Instance type:** Free or Starter
6. **Add disk** (important for SQLite gallery):
   - Name: `photoreal-data`
   - Mount path: `/data`
   - Size: `1 GB`
7. **Environment variables** (Environment tab):

| Key | Value |
|---|---|
| `FAL_KEY` | your fal key |
| `DEEPSEEK_API_KEY` | your DeepSeek key |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` |
| `SITE_PASSWORD` | `847291` |
| `DATABASE_URL` | `file:/data/photoreal.db` |
| `USD_PKR_RATE` | `278` |

8. Click **Create Web Service** / **Deploy**
9. Wait for the build (first deploy can take several minutes)
10. Open the `.onrender.com` URL → unlock with **`847291`**

## Optional: Blueprint

If you prefer: **New +** → **Blueprint** → pick `Photorealistic` → it reads `render.yaml` from the repo. You still must set secret env vars (`FAL_KEY`, `DEEPSEEK_API_KEY`, `SITE_PASSWORD`).
