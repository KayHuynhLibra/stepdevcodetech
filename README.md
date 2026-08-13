# SOFIA — Tarot educational / research demo

Realtime tarot / wheel **web demo** (Vite + React FE, Express + Socket.io BE) built for **học tập và nghiên cứu (learning & research)**: full-stack practice, realtime game loops, admin tooling, and compliance-copy patterns.

> **Educational / research only.** This is a fictional study project—not a real casino, bank, or licensed gambling service. **No real-money** deposits, withdrawals, or currency conversion. In-app **xu** are virtual points with **no cash value**.
>
> **Do not steal this codebase for illicit use.** Learning forks with attribution are fine; copying the repo to run illegal gambling, scams, or to strip authorship is **forbidden** — see [`NOTICE.md`](./NOTICE.md) and [`TERMS.md`](./TERMS.md) (Acceptable use · IP · DMCA).

## Repo layout

| Folder | Role |
|--------|------|
| **`be/`** | Backend — Express + Socket.io + JSON data (`be/data/`) |
| **`fe/`** | Frontend — Vite + React (`fe/dist` production build) |
| **`studying/`** | Tài liệu học tập **riêng** — local only, không deploy |
| **`docs/`** | Operator / game ops (trong repo) |
| **`scripts/`** | Redeploy / tiện ích root |
| **`local/`** | Tooling & lab máy bạn (hackmyapp, cybersecurity, version snapshots…) |

npm workspaces: `be` · `fe`. Ứng dụng chỉ nằm trong **`be/`** + **`fe/`** (không giữ bản app song song ngoài 2 folder này).

## Important (GitHub / learners / operators)

| | |
|--|--|
| **Purpose** | Learning, study, research, portfolio / code review — **not** commercial real-money gambling |
| **Source code** | View/learn OK · **No theft** for illicit deployment, fraud, or stripping authorship ([`NOTICE.md`](./NOTICE.md)) |
| **Currency** | In-app **xu** = virtual points only — **no cash value**, no real-money deposit/withdraw in this codebase |
| **Age** | **18+** (see in-app gate + [`TERMS.md`](./TERMS.md)) |
| **Not** | Licensed U.S. real-money gambling, money transmitter, or crypto cashout |
| **Governing law (ToS default)** | United States of America — see [`TERMS.md`](./TERMS.md) (arbitration · class waiver) |
| **Compliance pack** | **GitHub (canonical EN):** [`TERMS.md`](./TERMS.md) · [`PRIVACY.md`](./PRIVACY.md) · [`RESPONSIBLE.md`](./RESPONSIBLE.md) · [`NOTICE.md`](./NOTICE.md) · [`LEGAL.md`](./LEGAL.md) — **separate from** in-app bilingual summaries at `/terms` `/privacy` `/responsible` |
| **Study (US ops)** | [`docs/study-us-compliance.md`](./docs/study-us-compliance.md) — checklist học tập, copy an toàn |
| **Operator** | [`docs/admin/OPERATOR.md`](./docs/admin/OPERATOR.md) · [`docs/admin/GAME_OPS.md`](./docs/admin/GAME_OPS.md) |
| **Transparency filter** | [`docs/TRANSPARENCY_FILTER.md`](./docs/TRANSPARENCY_FILTER.md) — sàng lọc up GitHub + red lines pháp lý |

This is **not legal advice**. Forks that add real-money payments or cash prizes must get U.S. counsel and licensing review before offering the service.

**Do not commit** `be/data/*.json`, `.env`, or player dumps (GitHub AUP / privacy / classroom ethics).

## Local development

```bash
npm install
npm run demo
```

- FE (Vite): http://localhost:5173  
- BE (API): http://localhost:3001  
- Dev seed accounts (not created in production without env): `mainadmin` / `mainadmin123`, `admin` / `admin123`, `demo` / `demo123`

Static assets live only under `fe/public/` (Vite). Do not add a root `public/` folder.

## Production (Railway)

This app runs as **one Node service**: Express serves `/api`, Socket.io, and the built FE from `fe/dist`.

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

Mount a volume at **`/app/be/data`** (đổi từ `/app/server/data` sau khi tách folder).

> **Live Railway:** sau khi deploy layout mới, **đổi mount path volume** sang `/app/be/data` (hoặc migrate data vào path mới) — nếu quên, app nhìn folder trống.

### Backup data

**Local (cùng volume — không cứu volume corrupt):**

```bash
npm run backup:data
# → be/data/backups/YYYYMMDD-HHMMSS/
```

**Off-site (S3 / Cloudflare R2) — bắt buộc cho thảm họa:**

1. Tạo bucket R2 (Cloudflare → R2 → Create bucket) hoặc S3.
2. Tạo API token có quyền Object Read/Write.
3. Railway Variables (web service **và** cron service nếu tách):

```env
BACKUP_S3_BUCKET=your-backup-bucket
BACKUP_S3_ACCESS_KEY_ID=...
BACKUP_S3_SECRET_ACCESS_KEY=...
BACKUP_S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
BACKUP_S3_REGION=auto
BACKUP_S3_PREFIX=sofia-data
BACKUP_KEEP_REMOTE=14
```

4. Chạy thử: `npm run backup:offsite` → object `sofia-data/<stampUtc>/*.json` trên bucket.

5. **Railway Cron** (khuyến nghị):
   - New service → cùng repo → **Cron** schedule `0 3 * * *` (03:00 UTC mỗi ngày)
   - Start command: `node be/scripts/backup-offsite.mjs`
   - **Mount cùng Volume** vào path chứa `be/data` (giống web service)
   - Copy các env `BACKUP_S3_*` sang cron service

6. Restore drill: tải folder stamp từ R2 → dừng web → copy `*.json` vào `be/data/` → start → `GET /health` `ready=true`.

Keep at least: `users.json`, `vault.json`, `vault-arcana.json`, `tokens.json`, `history.json`, `coupons.json`, `inter.json`, `audit.json`.

### Scale migrate (÷10) — one-shot

Production `npm start` runs `migrate-scale-div10.mjs --auto` before the server boots: if balances still look like the old ×10 scale (and no marker file), it divides money fields by 10 once.

Manual:

```bash
npm run migrate:scale10
# or: node be/scripts/migrate-scale-div10.mjs --force
```

Writes marker `be/data/migrate-scale-div10.done`.

### Custom domains

Gắn domain của **operator** trên Railway (Dashboard → Domains). Dùng placeholder trong docs công khai — không commit domain/DNS thật nếu muốn giảm lộ identity:

1. Thêm custom domain trên host; lấy CNAME/ALIAS / TXT verify từ Railway.
2. Trỏ DNS theo hướng dẫn dashboard (không dùng GitHub Pages A records nếu site đã chuyển sang app).
3. Đợi TLS → verify `https://YOUR_DOMAIN/health` → `{"ok":true,...}`.

Chi tiết up/không up GitHub: [`docs/GITHUB_UPLOAD.md`](./docs/GITHUB_UPLOAD.md).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run demo` | Dev: BE + Vite FE |
| `npm run build` | Build FE to `fe/dist` |
| `npm start` | Production BE (serves API + `fe/dist`) |
| `npm run migrate:scale10` | One-shot ÷10 money migrate on `be/data` |
| `npm run backup:data` | Copy `be/data/*.json` → `be/data/backups/<stamp>/` |
| `npm run install:all` | npm install |

## Tài liệu kiến trúc & design system

Bản đồ triển khai, design system, UI pattern catalog, routing, API/Socket, data JSON: [`studying/README.md`](./studying/README.md) (local — ngoài BE/FE, không deploy).
