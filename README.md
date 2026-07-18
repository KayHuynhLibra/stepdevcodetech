# Tarot Bet Demo

Realtime tarot betting demo (Vite + React client, Express + Socket.io server).

## Local development

```bash
npm install
npm run demo
```

- Client: http://localhost:5173  
- Server: http://localhost:3001  
- Seed accounts: `admin` / `admin123`, `demo` / `demo123`

## Production (Railway)

This app runs as **one Node service**: Express serves `/api`, Socket.io, and the built client from `client/dist`.

### 1. Deploy from GitHub

1. Open [Railway](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select `KayHuynhLibra/stepdevcodetech`
3. Railway uses [`railway.toml`](railway.toml):
   - Build: `npm ci && npm run build`
   - Start: `npm start`
4. Confirm the service listens on `PORT` (Railway sets this automatically)

### 2. Persist user data

`server/data/` is gitignored. Auth seeds `admin` / `demo` on first boot if `users.json` is missing.

To keep balances across redeploys:

1. Railway service → **Volumes** → add a volume
2. Mount path: `/app/server/data` (adjust if Railway’s app root differs; it should be the repo root)

### 3. Custom domain `stepdevcode.tech`

1. Service → **Settings** → **Networking** → **Custom Domain**
2. Add `stepdevcode.tech` (and `www.stepdevcode.tech` if needed)
3. Copy the DNS records Railway shows (usually a CNAME)

At your DNS provider (currently pointed at **GitHub Pages**):

1. **Remove** GitHub Pages A records for `@`:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
2. **Remove** the old `www` CNAME to `*.github.io` if present
3. **Add** the records Railway provides for the custom domain
4. Wait for DNS + Railway TLS to become active

Optional: in the GitHub repo → **Settings** → **Pages**, disable Pages so the old portfolio is no longer published on `*.github.io`.

### 4. Verify

- `https://stepdevcode.tech/health` → `{"ok":true,...}`
- Open the site, log in, place a bet (Socket.io same-origin)

## Scripts

| Script | Description |
|--------|-------------|
| `npm run demo` | Dev: server + Vite client |
| `npm run build` | Build client to `client/dist` |
| `npm start` | Production server (serves API + `client/dist`) |
