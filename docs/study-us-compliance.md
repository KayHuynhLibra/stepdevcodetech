# US compliance study — SOFIA (learning / operators)

**Not legal advice.** Tài liệu học tập cho người vận hành hoặc fork repo khi deploy tại **Hoa Kỳ**. Đọc kèm [`LEGAL.md`](../LEGAL.md), [`TERMS.md`](../TERMS.md), [`PRIVACY.md`](../PRIVACY.md).

---

## 1. Mô hình an toàn của repo này

Xem thêm bản đồ chồng lớp: [`LEGAL_SHIELD.md`](./LEGAL_SHIELD.md).

| Nguyên tắc | Trạng thái trong code |
|------------|----------------------|
| Xu ảo, không cash value | `TERMS.md` §1, copy UI `complianceCopy.ts` |
| Không nạp/rút tiền thật | Không Stripe/PayPal trong codebase · Privacy feature-creep lock |
| 18+ gate + evidence | `ComplianceGate.tsx`, `compliance.ts` v5, `termsAcceptedAt` |
| Terms + Privacy + Responsible | `/terms`, `/privacy`, `/responsible` |
| Chồng lớp tranh chấp | Informal → FAA arbitration → class waiver → US venue |
| Kill-switch / no vested xu | `TERMS.md` §9 |
| Bói bài = entertainment | `/responsible`, oracle disclaimers |
| Không leak player data | `.gitignore` `be/data/` |

**Giữ nguyên các dòng trên** nếu muốn giảm rủi ro UIGEA + luật đánh bạc bang.

---

## 2. Rủi ro chính khi “go live” ở Mỹ

### A. Nhận thức “casino” (marketing)

Dù xu ảo, FTC và consumer protection vẫn quan tâm **copy gây hiểu lầm**.

| Tránh (user-facing) | Dùng thay |
|---------------------|-----------|
| casino, đánh bạc, nhà cái, chọn bàn (lobby) | giải trí, chơi, spin, **chọn trò chơi** |
| cược, bet (tiếng Việt) | mức chơi, xu mỗi lượt |
| thắng tiền, rút tiền | thắng xu ảo |
| jackpot (nếu quá nhấn mạnh) | hũ / thưởng ảo (OK nếu kèm disclaimer) |

**Đã chỉnh (2026-08):** Olympus UI, Oan Quan, lobby copy, SFX label “Arcade”.

Tên file nội bộ (`BoltPeakPage`, `stakeStore`) có thể giữ từ vựng kỹ thuật — **không hiện “casino” cho user**.

### B. Thêm tiền thật sau này

Chỉ cần **một** trong các hành vi sau → **dừng, thuê luật sư gaming (federal + state)** trước khi ship:

- Bán xu bằng USD
- Đổi xu lấy gift card / crypto / tiền mặt
- Sweepstakes “mua thêm entry”
- Secondary market cho xu

### C. Privacy (COPPA / CCPA / state laws)

- `PRIVACY.md` đã có khung CCPA + COPPA 13+
- Operator cần quy trình **xóa/truy cập** qua Feedback
- Không commit `be/data/*.json`
- Backup S3: giới hạn quyền, mã hóa

### D. UGC (chat / voice)

- Có report + ban — cần **người duyệt** định kỳ
- Terms §5 acceptable use
- DMCA contact qua Feedback (`TERMS.md` §8)

### E. Bói bài / tarot

- Luôn disclaimer: không thay tư vấn y tế / pháp lý / tài chính
- Không claim “chắc chắn”, “chữa bệnh”
- PDF nguồn: kiểm tra bản quyền ảnh/nội dung

---

## 3. Checklist trước public

```
[x] /terms /privacy /responsible live
[x] ComplianceGate trên guest play + lobby user (localStorage ack)
[x] Footer xu ảo trên lobby + mọi game live (Tarot/Arcana/Olympus/Ludo/Uno/OanQuan/Bói)
[x] Copy user-facing: Cược → Mức xu / Mức chơi (Ludo, Olympus, lobby)
[x] termsAcceptedAt trên server (register + POST /api/auth/accept-terms)
[x] Docs operator: docs/admin/OPERATOR.md + GAME_OPS.md
[ ] Entity pháp nhân (LLC) + contact support
[ ] Privacy request workflow (ops)
[ ] Backup off-site verify (BACKUP_S3_*)
[ ] Luật sư review arbitration clause (bang bạn chọn)
```

**Đã chỉnh thêm (2026-08-12):** VirtualPlayFooter toàn game; Ludo/Olympus «Cược» → «Mức xu»; complianceCopy centralized; `termsAcceptedAt`; admin docs.

---

## 4. Trong app (đường dẫn code)

| Mục | File |
|-----|------|
| Copy chung | `fe/src/complianceCopy.ts` |
| Footer UI | `fe/src/components/VirtualPlayFooter.tsx` |
| Gate 18+ | `fe/src/components/ComplianceGate.tsx` |
| Trang pháp lý | `fe/src/pages/LegalPage.tsx` |
| Chơi có trách nhiệm | `/responsible` |
| Maintainer checklist | `LEGAL.md` |
| Operator matrix | `docs/admin/OPERATOR.md` |
| Per-game ops | `docs/admin/GAME_OPS.md` |

---

## 5. Học thêm (không thay luật sư)

- **UIGEA** — cược internet liên quan tiền/tín dụng (31 U.S.C. §§ 5361–5367)
- **COPPA** — trẻ dưới 13 (15 U.S.C. §§ 6501–6506)
- **CCPA/CPRA** — California privacy rights
- **FTC Act** — deceptive advertising
- Problem gambling (tiền thật): **1-800-522-4700** / ncpgambling.org

---

## 6. Lab bảo mật local

Folder `local/hackmyapp/` (README tracked, chi tiết local gitignored): self-test health/TLS/rate-limit — xem [`local/hackmyapp/README.md`](../local/hackmyapp/README.md).

---

*Cập nhật: 2026-08-12 · SOFIA educational / research positioning*
