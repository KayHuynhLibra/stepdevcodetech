# GAME_MODULE — thêm game vào SOFIAORE

Checklist khi thêm bàn mới vào nền tảng (scale ~50 game). **Không** sửa cả `AdminDashboard.tsx` chỉ để thêm một bàn.

## 1. Manifest (bắt buộc)

- Server seed / upsert trong `server/src/platformGamesStore.ts` (hoặc Admin tab **Games**).
- Client đọc qua `GET /api/platform/games` → `client/src/platform/games.ts`.
- Trường quan trọng:
  - `id`, `nameVi`, `blurb`, `status` (`live` | `beta` | `coming_soon`)
  - `pathSuffix` (vd `play`, `arcana`, `boi-bai`, `g/dice`)
  - `kind`, `vaultKey?`, `sort`, `enabled`
  - **`spendLane: "play"`** — mọi game chỉ tiêu **xu chơi**

## 2. Route + page

- Thêm route theo mẫu role hiện có trong `client/src/App.tsx`, hoặc Phase 1.5: `.../g/:gameId`.
- Helper: `gamePath(user, manifest)` từ `client/src/platform/games.ts`.
- `TableNav` / Lobby tự hiện từ registry — không hardcode nút.

## 3. Ví & vault

- Debit/credit chỉ qua `authStore.adjustBalance(userId, delta, { lane: "play", reason, gameId })`.
- **Không** trừ `social` / xu quà cho stake/spin.
- Vault nhà cái theo `vaultKey` trên manifest; gắn lane play.

## 4. MXH (không nằm trong registry game)

- Gift, gift-xu, ring, lixi voice → **`lane: "social"`** / `spendXu` / `giftXu`.
- Không auto-đổi play ↔ social.

## 5. Admin

- Bật/tắt / sort / `coming_soon`: tab **Games**.
- Grant xu: `/api/admin/adjust-balance` với `lane: "play" | "social"`.

## 6. Hợp đồng / TERMS

- Xu chơi ≠ xu quà; cả hai là điểm ảo, không tiền thật (xem `TERMS.md`).

## Stub coming_soon

Đủ để chứng minh scale: thêm manifest `status: "coming_soon"` (vd `dice`, `slots`) — **chưa** cần logic bàn.
