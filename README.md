# Tarot Demo

Realtime tarot  demo (Vite + React client, Express + Socket.io server).

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

Mainadmin / admin mới seed được **bắt đổi mật khẩu**. Production: không seed bằng fallback; nếu `SEED_*` trùng `mainadmin123` / `admin123` thì bỏ qua. Acc staff còn MK mặc định sẽ bị gắn `mustChangePassword` khi boot / login.

### Persist user data

Mount a volume at `/app/server/data`.

### Backup data

Copy all `server/data/*.json` into a timestamped folder:

```bash
npm run backup:data
# → server/data/backups/YYYYMMDD-HHMMSS/
```

On Railway, run this before risky deploys, or schedule a cron that executes the same command / snapshots the volume. Keep `users.json`, `vault.json`, `vault-arcana.json`, `arcana-wheel.json`, `arcana-spins.json`, `tokens.json`, `tebs.json`, `coupons.json`, `inter.json`, `history.json`, `audit.json`, `reports.json`, `guest-ips.json`.

### Scale migrate (÷10) — one-shot

Production `npm start` runs `migrate-scale-div10.mjs --auto` before the server boots: if balances still look like the old ×10 scale (and no marker file), it divides money fields by 10 once.

Manual:

```bash
npm run migrate:scale10
# or: node server/scripts/migrate-scale-div10.mjs --force
```

Writes marker `server/data/migrate-scale-div10.done`.

### Custom domains

**Live hiện tại:** `https://stepkay.codes` — verify `https://stepkay.codes/health` → `{"ok":true,...}`.

**`stepdevcode.tech` (nếu muốn dùng):** Railway custom domain phải gắn sẵn. Tại DNS host (Orderbox / registrar):

1. **Remove** GitHub Pages A records for `@` (`185.199.108.153` … `185.199.111.153`) and any `www` → `*.github.io` CNAME.
2. **Add** Railway records (check dashboard → Domains):
   - CNAME/ALIAS for `@` / `www` → target Railway shows (vd. `*.up.railway.app`)
   - TXT `_railway-verify` với giá trị Railway hiện
3. Wait for DNS + TLS. Verify: `https://stepdevcode.tech/health` → `{"ok":true,...}`

Optional: disable GitHub Pages on the repo so the old portfolio is not published.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run demo` | Dev: server + Vite client |
| `npm run build` | Build client to `client/dist` |
| `npm start` | Production server (serves API + `client/dist`) |
| `npm run migrate:scale10` | One-shot ÷10 money migrate on `server/data` |
| `npm run backup:data` | Copy `server/data/*.json` → `server/data/backups/<stamp>/` |
| `npm run install:all` | npm install |

## Tài liệu kiến trúc & design system

Bản đồ triển khai, design system, **UI pattern catalog (sơ đồ)**, routing, API/Socket, data JSON và checklist phát triển tính năng: [studying/README.md](studying/README.md) (cập nhật 20/07/2026).
