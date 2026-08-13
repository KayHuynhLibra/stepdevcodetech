# Transparency & legal-risk filter — SOFIA

**Not legal advice.** Bộ lọc nhu cầu vận hành để **minh bạch** và **giảm rủi ro pháp lý về sau**.  
Chạy lại trước mỗi release / push GitHub / đổi model kinh tế.

Liên quan: [`LEGAL_SHIELD.md`](./LEGAL_SHIELD.md) · [`GITHUB_UPLOAD.md`](./GITHUB_UPLOAD.md) · [`LEGAL.md`](../LEGAL.md) · [`study-us-compliance.md`](./study-us-compliance.md)

---

## 1. Nhu cầu đã chốt (product intent)

| Nhu cầu của bạn | Cách repo thể hiện | Minh bạch với ai |
|-----------------|--------------------|------------------|
| Giải trí điểm ảo, **không** tiền thật | TERMS §1 · `complianceCopy` · footer · gate 18+ | Người chơi + GitHub readers |
| Học / research / portfolio | README positioning · NOTICE | Cộng đồng / reviewer |
| Tách app rõ **be/** + **fe/** | Monorepo workspaces | Dev / operator |
| Study & lab **không** public | `studying/` · `local/` gitignore | Chỉ máy bạn |
| Không leak PII / secret | `be/data/` ignore · no `.env` | Player + GitHub AUP |
| Chồng lớp hợp đồng / privacy / IP | TERMS · PRIVACY · NOTICE · LEGAL_SHIELD | Người chơi + counsel |
| Không “lan man” app / bản cũ | Không `addons/` · không `local/versions` | Dev hygiene |

Nếu **một** nhu cầu đổi (vd. bán xu bằng USD) → **dừng ship**, thuê luật sư gaming US trước.

---

## 2. Ma trận up GitHub

### ĐƯỢC up

| Nhóm | Path |
|------|------|
| App | `be/src/**`, `fe/src/**`, `fe/public/assets/**` |
| Legal EN | `TERMS.md` `PRIVACY.md` `NOTICE.md` `LEGAL.md` `RESPONSIBLE.md` |
| Docs | `docs/**` |
| Config mẫu | `.env.example`, `package*.json`, `railway.toml`, `nixpacks.toml` |
| Scripts | `scripts/**`, `be/scripts/**` |
| Intro only | `studying/README.md`, `local/README.md`, `local/hackmyapp/README.md` |

### KHÔNG up

| Nhóm | Path |
|------|------|
| Player data | `be/data/**` |
| Secrets | `.env`, key, pem |
| Study / PDF | `studying/*` (trừ README) |
| Lab / tooling | `local/*` (trừ 2 README) |
| IDE | `.cursor/`, `.gitnexus/`, `AGENTS.md` |

---

## 3. Đã xử lý trong code (bản hiện tại)

```
[x] Xu ảo · không cash-in/out payment gateway
[x] ComplianceGate 18+ + termsAcceptedAt
[x] /terms /privacy /responsible + LEGAL pack
[x] VirtualPlayFooter: mọi lane chơi + GiftShop (+ GamePlayShell Uno/Oan)
[x] complianceCopy tập trung
[x] be/data + studying + local gitignore
[x] Xoá addons/ trùng live
[x] Xoá local/versions + asset-backup (bản update cũ)
[x] OlympusCasinoPage → BoltPeakPage
[x] Copy player «nạp xu» → «cộng xu ảo»
[x] Theme / CSS «Neon Casino» → «Neon Arcade»
[x] Soft admin BOLT% «cược» → «mức xu» (UI labels)
```

---

## 4. Còn lại ngoài code (operator)

| Ưu tiên | Việc |
|---------|------|
| **P0** | Không thêm bán xu / cashout / gift-card redeem |
| **P0** | Mỗi push: không stage `be/data`, `.env`, PDF studying |
| **P1** | Entity LLC + kênh support chính thức |
| **P1** | Quy trình Privacy request (Feedback → xóa/truy cập) |
| **P1** | Backup off-site verify + restore drill |
| **P2** | Counsel review arbitration / class waiver |
| **P3** | Asset tarot: chỉ art tự tạo / license rõ |

---

## 5. Red lines

1. Bán / đổi xu lấy tiền, crypto, thẻ quà.  
2. Quảng cáo thắng tiền thật / thu nhập từ chơi.  
3. Nhắm hoặc biết phục vụ dưới 18 (hoặc dưới 13).  
4. Thu SSN / thẻ thanh toán chưa viết lại Privacy + PCI.  
5. Public player dump, token, `.env`, PDF bản quyền.  
6. Claim “LEGAL_SHIELD = hợp pháp hóa đánh bạc”.

---

## 6. Checklist 60 giây trước `git push`

```
[ ] git status — không be/data/*.json, không .env
[ ] không PDF studying trong staged
[ ] local/ chỉ README (+ hackmyapp README)
[ ] README/docs không dán mật khẩu seed / token
[ ] User-facing: xu ảo · 18+ · không nạp/rút tiền thật
```

```powershell
git status --short
git check-ignore -v be/data/users.json .env studying/tarot78/pdfs/01.pdf
git ls-files be/data
git ls-files local
```

---

## 7. Deep audit snapshot (2026-08-12 — bản mới)

| Kiểm tra | Kết quả |
|----------|---------|
| Payment Stripe/PayPal/crypto | **Không có** |
| Data/secret/PDF tracked | **Không** |
| addons / local/versions | **Đã xoá** |
| BoltPeak page name | **`BoltPeakPage.tsx`** |
| Footer lanes + shop | **Có** |
| Copy «nạp xu» / «Neon Casino» player | **Đã thay** |
| LLC / privacy ops / backup | **P1 ngoài code** |

*Source of truth = `be/` + `fe/` hiện tại. Không giữ song song bản update cũ.*
