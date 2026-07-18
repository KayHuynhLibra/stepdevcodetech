# Tarot Bet Demo

Realtime tarot betting demo (Vite + React client, Express + Socket.io server).

## Local development

```bash
npm install
npm run demo
```

- Client: http://localhost:5173  
- Server: http://localhost:3001  
- Dev seed accounts (not created in production without env): `mainadmin` / `mainadmin123`, `admin` / `admin123`, `demo` / `demo123`

Static assets live only under `client/public/` (Vite). Do not add a root `public/` folder.

## Production (Railway)

This app runs as **one Node service**: Express serves `/api`, Socket.io, and the built client from `client/dist`.

### Environment variables

| Variable | Purpose |
|----------|---------|
| `SEED_MAINADMIN_PASSWORD` | Create `mainadmin` on first boot (required in prod if account missing) |
| `SEED_ADMIN_PASSWORD` | Create `admin` |
| `SEED_DEMO_PASSWORD` | Create `demo` |
| `SEED_COUPON_TRUEVIBE` | Optional coupon code to seed (prod has no hardcoded coupon codes) |
| `SEED_COUPON_TRUEVIBE_AMOUNT` | Amount for that coupon (default 50000) |
| `TOKEN_TTL_MS` | Auth token lifetime (default 7 days) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (empty = reflect request origin / same-origin deploy) |

Mainadmin is prompted to **change password on first login**.

### Persist user data

Mount a volume at `/app/server/data`.

### Scale migrate (÷10) — one-shot

If Railway volume still has pre-scale balances:

```bash
# Railway shell / one-off
npm run migrate:scale10
# or: node server/scripts/migrate-scale-div10.mjs
```

Writes marker `server/data/migrate-scale-div10.done`. Use `--force` only if you intentionally re-scale.

### Custom domain `stepdevcode.tech`

Railway custom domain should already be attached. At your DNS host (Orderbox / registrar):

1. **Remove** GitHub Pages A records for `@` (`185.199.108.153` … `185.199.111.153`) and any `www` → `*.github.io` CNAME.
2. **Add** Railway records (check dashboard → Domains):
   - CNAME/ALIAS for `@` / `www` → `jvqxrffr.up.railway.app` (or the target Railway shows)
   - TXT `_railway-verify` with the value Railway shows (run `railway domain` / check Domains UI)
3. Wait for DNS + TLS. Verify: `https://stepdevcode.tech/health` → `{"ok":true,...}`

Optional: disable GitHub Pages on the repo so the old portfolio is not published.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run demo` | Dev: server + Vite client |
| `npm run build` | Build client to `client/dist` |
| `npm start` | Production server (serves API + `client/dist`) |
| `npm run migrate:scale10` | One-shot ÷10 money migrate on `server/data` |
