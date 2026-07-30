# Deploy on Render

## Recommended: Node Web Service (not Docker)

Docker builds have been failing on Render. Use the **Node** runtime instead.

### 1) If the service already exists as Docker
- Settings → **Delete** the Docker service (or create a new one)
- Or: Settings → change to connect the repo again as Node

### 2) Create service
1. https://dashboard.render.com → **New +** → **Web Service**
2. Connect repo **Photorealistic**
3. Settings:
   - **Runtime:** `Node`
   - **Branch:** `main`
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm run start`
   - **Instance:** Free or Starter
4. **Disk:**
   - Mount path: `/data`
   - Size: 1 GB
5. **Environment:**

```
NODE_VERSION=20
NODE_OPTIONS=--max-old-space-size=4096
DATABASE_URL=file:/data/photoreal.db
USD_PKR_RATE=278
SITE_PASSWORD=847291
FAL_KEY=...your fal key...
DEEPSEEK_API_KEY=...your deepseek key...
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

6. Deploy → open the `.onrender.com` URL → unlock with **847291**

### If only `fsp` shows in the repo list
Grant Render access to Photorealistic:  
https://github.com/settings/installations → **Render** → **Configure** → add **Photorealistic**
