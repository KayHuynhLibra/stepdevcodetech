# Git / GitHub upload control

**Mục tiêu:** code + legal public được push; **player data, secrets, lab bảo mật, identity ops** không lên GitHub.

Chi tiết vận hành: xem [`LEGAL_SHIELD.md`](./LEGAL_SHIELD.md). File này là checklist **commit/push**.

---

## ĐƯỢC up (OK trên GitHub)

| Nhóm | Ví dụ |
|------|--------|
| Source app | `fe/src/**`, `be/src/**` (không gồm `be/data/`) |
| Assets game tĩnh | `fe/public/assets/**` (avatar, lobby SVG, oracle art…) |
| Legal công khai | `TERMS.md`, `PRIVACY.md`, `NOTICE.md`, `LEGAL.md`, `RESPONSIBLE.md` |
| Docs học / shield | `docs/LEGAL_SHIELD.md`, `docs/study-us-compliance.md`, `docs/GAME_MODULE.md`, `docs/admin/*` (không chứa secret) |
| Config mẫu | `.env.example`, `package.json`, `railway.toml`, `nixpacks.toml` |
| hackmyapp | **Chỉ** `local/hackmyapp/README.md` (+ `local/README.md`) |
| Layout | `be/`, `fe/`, `docs/`, `scripts/` |

---

## KHÔNG up (bắt buộc gitignore / local-only)

| Nhóm | Path / pattern | Lý do |
|------|----------------|--------|
| Player / production JSON | `be/data/**` | PII, balances, tokens, history |
| Secrets | `.env`, `.env.*` (trừ `.env.example`), `*.pem`, `*.key`, `*credentials*` | Auth / cloud keys |
| Build | `node_modules/`, `dist/`, `fe/dist/`, `*.tsbuildinfo` | Reproducible locally |
| Lab bảo mật | `local/hackmyapp/*` trừ README | Domain ops, checklist tấn công, logs |
| Notes nội bộ | `studying/`, `local/cybersecurity/`, `local/*` | Không public |
| Snapshot máy | `local/versions/`, `local/asset-backup/` | Dump local |
| IDE / agent | `.cursor/`, `agent-transcripts/` | Session cá nhân |
| Temp | `.tmp-img/`, `.tmp-*`, `*.log`, coverage | Rác |

---

## Trước mỗi `git push`

```
[ ] git status — không thấy be/data/*.json
[ ] không stage .env / key / pem
[ ] hackmyapp chỉ `local/hackmyapp/README.md` (lab vẫn ignored)
[ ] README / docs không dán domain cá nhân, bucket thật, token
[ ] không commit mật khẩu seed thật (chỉ tên biến SEED_* trong docs)
```

Lệnh kiểm nhanh (PowerShell):

```powershell
git status --short
git check-ignore -v be/data/users.json .env local/hackmyapp/01-PRIVACY-VA-THONG-BAO.md
git ls-files be/data   # phải trống
git ls-files local     # chỉ README (+ hackmyapp/README)```

---

## Sanitize identity (đã áp dụng policy)

User-facing legal **không** link GitHub cá nhân.  
README production dùng **placeholder** (`YOUR_DOMAIN`, `your-backup-bucket`) — không commit tên domain/bucket thật nếu muốn giảm lộ operator.
