# Git / GitHub upload control

**Mục tiêu:** code + legal public được push; **player data, secrets, lab bảo mật, identity ops** không lên GitHub.

Chi tiết vận hành: xem [`LEGAL_SHIELD.md`](./LEGAL_SHIELD.md). File này là checklist **commit/push**.

---

## ĐƯỢC up (OK trên GitHub)

| Nhóm | Ví dụ |
|------|--------|
| Source app | `client/src/**`, `server/src/**` (không gồm `server/data/`) |
| Assets game tĩnh | `client/public/assets/**` (avatar, lobby SVG, oracle art…) |
| Legal công khai | `TERMS.md`, `PRIVACY.md`, `NOTICE.md`, `LEGAL.md`, `RESPONSIBLE.md` |
| Docs học / shield | `docs/LEGAL_SHIELD.md`, `docs/study-us-compliance.md`, `docs/GAME_MODULE.md`, `docs/admin/*` (không chứa secret) |
| Config mẫu | `.env.example`, `package.json`, `railway.toml`, `nixpacks.toml` |
| Addons mã nguồn | `addons/olympus-sofiaore/**` |
| hackmyapp | **Chỉ** `hackmyapp/README.md` |

---

## KHÔNG up (bắt buộc gitignore / local-only)

| Nhóm | Path / pattern | Lý do |
|------|----------------|--------|
| Player / production JSON | `server/data/**` | PII, balances, tokens, history |
| Secrets | `.env`, `.env.*` (trừ `.env.example`), `*.pem`, `*.key`, `*credentials*` | Auth / cloud keys |
| Build | `node_modules/`, `dist/`, `client/dist/`, `*.tsbuildinfo` | Reproducible locally |
| Lab bảo mật | `hackmyapp/*` trừ README | Domain ops, checklist tấn công, logs |
| Notes nội bộ | `studying/`, `cybersecurity/` | Không public |
| Snapshot máy | `version 1/`, `version 2/`, `version 3/`, `.asset-backup/` | Dump local |
| IDE / agent | `.cursor/`, `agent-transcripts/` | Session cá nhân |
| Temp | `.tmp-img/`, `.tmp-*`, `*.log`, coverage | Rác |

---

## Trước mỗi `git push`

```
[ ] git status — không thấy server/data/*.json
[ ] không stage .env / key / pem
[ ] hackmyapp chỉ README (các file lab vẫn ignored)
[ ] README / docs không dán domain cá nhân, bucket thật, token
[ ] không commit mật khẩu seed thật (chỉ tên biến SEED_* trong docs)
```

Lệnh kiểm nhanh (PowerShell):

```powershell
git status --short
git check-ignore -v server/data/users.json .env hackmyapp/01-PRIVACY-VA-THONG-BAO.md
git ls-files server/data   # phải trống
```

---

## Sanitize identity (đã áp dụng policy)

User-facing legal **không** link GitHub cá nhân.  
README production dùng **placeholder** (`YOUR_DOMAIN`, `your-backup-bucket`) — không commit tên domain/bucket thật nếu muốn giảm lộ operator.
