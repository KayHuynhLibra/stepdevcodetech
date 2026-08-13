# GAME_MODULE — thêm game vào SOFIA

Checklist khi thêm bàn mới vào nền tảng (scale ~50 game). **Không** sửa cả `AdminDashboard.tsx` chỉ để thêm một bàn.

## 1. Manifest (bắt buộc)

- Server seed / upsert trong `be/src/platformGamesStore.ts` (hoặc Admin tab **Games**).
- Client đọc qua `GET /api/platform/games` → `fe/src/platform/games.ts`.
- Trường quan trọng:
  - `id`, `nameVi`, `blurb`, `status` (`live` | `beta` | `coming_soon`)
  - `pathSuffix` (vd `play`, `arcana`, `boi-bai`, `g/dice`)
  - `kind`, `vaultKey?`, `sort`, `enabled`
  - **`spendLane: "play"`** — mọi game chỉ tiêu **xu chơi**

## 2. Route + page

- Thêm route theo mẫu role hiện có trong `fe/src/App.tsx`, hoặc Phase 1.5: `.../g/:gameId`.
- Helper: `gamePath(user, manifest)` từ `fe/src/platform/games.ts`.
- `TableNav` / Lobby tự hiện từ registry — không hardcode nút.

## 3. Ví & vault

- Debit/credit stake chỉ qua `authStore.adjustBalance(userId, delta, { lane: "play", reason, gameId })`.
- **Không** trừ `social` / xu quà cho stake/spin.
- Vault nhà cái theo `vaultKey` trên manifest; gắn lane play.

## 3b. Gem (Kim Cương) — tách xu

- Ví riêng: `user.gemBalance` · `authStore.adjustGem` / `spendGem` / `giftGem`.
- **Không** auto-đổi Gem ↔ xu chơi ↔ xu quà.
- **Dùng cho:** skin / cosmetic shop (Ludo bàn · UNO lá úp/nỉ · frame/pawn) · tặng Gem (`POST /api/auth/gift-gem`).
- **Không dùng** cho stake/spin bàn chơi.
- Shop: `priceGem` + `payWith: "gem"` (helper `resolveShopPay` trong `gem.ts`) · giảm giá Quý tộc (`applyNobilityShopPay`).
- Admin: `/api/admin/adjust-gem` · vault Gem.
- Lifetime: `gemSpentLifetime` tăng khi `spendGem` / `giftGem` (sender); admin trừ **không** giảm lifetime.

## 3c. VIP · Quý tộc · Tu Tiên (tách nhau)

| Hệ | Nguồn | Stake | Shop Gem | Chat bay | Giảm phí chat | Voice |
|----|--------|-------|----------|----------|---------------|-------|
| **VIP 1–5** | ván / `vipGranted` (floor VIP3) | **Có** (mul 1.1–2.0) | Không | Có (≥1) | Có | Có |
| **Quý tộc 1–6** | `gemSpentLifetime` | **Không** | Giảm giá + `minNobility` | Không (gate) | Có | Có |
| **Tu Tiên** | admin rank + phí duy trì xu | Trần tutien | Không | Không | Có | Có |

- Chat fee = cộng % VIP + Quý tộc + Tu Tiên (cap 80%).
- Voice priority = `max(VIP, Quý tộc, Tu Tiên)`.
- Code: `vipTiers.ts` · `nobilityRanks.ts` · `statusBenefits.ts`.

## 4. MXH (không nằm trong registry game)

- Gift xu, gift-xu, ring, lixi voice → **`lane: "social"`** / `spendXu` / `giftXu` (max có thể boost theo Quý tộc).
- Tặng Gem → `giftGem` (không đụng xu; cộng lifetime Quý tộc; fly overlay).
- Không auto-đổi play ↔ social ↔ gem.

## 5. Admin

- Bật/tắt / sort / `coming_soon`: tab **Games**.
- Grant xu: `/api/admin/adjust-balance` với `lane: "play" | "social"`.

## 6. Hợp đồng / TERMS

- Xu chơi ≠ xu quà; cả hai là điểm ảo, không tiền thật (xem `TERMS.md`).

## Stub coming_soon

Đủ để chứng minh scale: thêm manifest `status: "coming_soon"` (vd `dice`, `slots`) — **chưa** cần logic bàn.
