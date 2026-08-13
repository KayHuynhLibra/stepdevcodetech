# Game ops — per-game admin & APIs

Hướng dẫn vận hành từng trò trên SOFIA. Xu chơi = điểm ảo (`spendLane: "play"`). Không nạp/rút tiền thật.

Trong AdminDashboard: hub **Trò chơi** gom tab theo game; overview có **Check theo game**.

| Game | Page | Guest | Hub → tab | APIs chính | Mức xu / stake |
|------|------|-------|-----------|------------|----------------|
| Tarot | `GamePage` | OK | Trò chơi → Tarot · Inter (+ Vault/Traffic) | `/api/game/*`, Inter admin | stake presets server |
| Arcana | `ArcanaWheelPage` | OK (auth hoặc `x-guest-id`) | Trò chơi → Bánh xe Arcana | `/api/arcana-wheel/*`, `/api/mainadmin/arcana/*` | spin cost config |
| BoltPeak | `BoltPeakPage` | OK | Trò chơi → BoltPeak · BOLT% | Olympus routes + BOLT % | mức xu UI (không “Cược”) |
| Cờ cá ngựa | `LudoPage` | OK | Trò chơi → Cờ cá ngựa | Ludo admin APIs | mức xu / presets |
| Ô ăn quan | `OanQuanPage` | OK | Trò chơi → Ô ăn quan | `GET/POST /api/admin/oan-quan/rooms*` | STAKE_PRESETS client |
| HueRush | `UnoPage` | OK | Trò chơi → HueRush | `GET/POST /api/admin/uno/rooms*` | stake presets |
| Bói bài | `BoiBaiPage` | OK | Trò chơi → Bói bài / Lab (+ P+M) | Oracle CMS `/api/admin/oracle/*` | free / xu theo ritual |

## Chung

- Lobby: `GET /api/platform/games` + `GameLobby` (`coverUrl` optional).
- Shell: `GamePlayShell` / `GameChrome` + `VirtualPlayFooter` (18+ · xu ảo · `/responsible`).
- Registry admin: **Trò chơi → Games registry** — `pathSuffix`, `kind`, `vaultKey`, `coverUrl`, `nameVi`, status, sort, enabled.
- Assets: **Nội dung → P+M**; kho xu: **Kinh tế → Kho xu**.
- Thêm game mới: [`docs/GAME_MODULE.md`](../GAME_MODULE.md).

---

## Tarot

- **Admin:** Inter (can thiệp phòng), Vault (kho tarot), Traffic.
- **Context:** mở Inter/Traffic → tự `managedGame=tarot`.
- **Guest:** `/guest/:code/play` — balance guest session.
- **Copy:** không gợi nạp tiền thật; coupon nội bộ OK.

## Arcana (Bánh xe)

- **Guest:** route `/guest/:code/arcana`; API nhận token **hoặc** header `x-guest-id`; balance guest trong `arcanaWheelStore`.
- **Admin:** `ArcanaAdminPanel` — slots, RTP preview, spin log (`arcana_config`).
- **Context:** mở tab Arcana → tự `managedGame=arcana`.
- **Vault:** `vaultKey: arcana` khi bật kho riêng.

## BoltPeak (Olympus)

- **Admin:** tab BOLT% — Combo / Hũ&FS / Can thiệp.
- **Copy user:** “Mức xu” / “Mức”, không “Cược” / “Casino” trên UI.
- **Guest:** OK.

## Ludo

- **Admin:** tab Cờ cá ngựa (Phòng · Tiền bạc · Cosmetics).
- **Copy:** “Mức xu” / “Mức chơi”.
- **Guest:** OK.

## Ô ăn quan

- **Admin:** `OanQuanAdminPanel` — list phòng, stake/pot, force close.
- **API:**
  - `GET /api/admin/oan-quan/rooms` — admin hoặc mainadmin
  - `POST /api/admin/oan-quan/rooms/:id/close` — mainadmin
- **Store:** `oanQuanRoomStore.listAdmin` / `adminClose`.

## HueRush (UNO)

- **Admin:** `UnoAdminPanel` — rooms, close, bot fill / presets.
- **API:**
  - `GET /api/admin/uno/rooms`
  - `POST /api/admin/uno/rooms/:id/close`
- **Store:** `unoRoomStore`.

## Bói bài (Oracle)

- **Admin:** OracleAdminPanel — decks, spreads, timing, Lab (staff only).
- **Assets:** P+M → Bói (úp bài · nền · FX).
- **Roles tài liệu:** `tarot78` = Cards + Library (`oracle_cards`); `book78` = Library + Lab (`oracle_library`); `mainadmin` full.
- Seed local: `tarot78`, `book78`, `eco`, `audit`, `sgift`, `ring`, `pm`, `onl`, … (env `SEED_*_PASSWORD`).
- Caps: `games_registry`, `coupon_ops`, `oracle_cards`, `oracle_library`.
- **API:** `/api/admin/oracle/*` (cards vs library tách cap).
- **Player:** tabs Rút / Sổ / Hướng dẫn; disclaimer entertainment.
- Soft-delete card/spread: optional; ưu tiên `enabled` / archive.

## Platform registry

| Field | Ý nghĩa |
|-------|---------|
| `pathSuffix` | Segment URL (`play`, `arcana`, `uno`, …) |
| `kind` | `stake` \| `spin` \| `oracle` \| `other` |
| `vaultKey` | Kho nhà cái (null = không gắn) |
| `coverUrl` | Ảnh lobby (fallback `GameMark` nếu trống) |
| `status` | `live` \| `beta` \| `coming_soon` |
| `enabled` | Tắt khỏi lobby mà không xóa id |

## Compliance liên quan game

- Footer trên mọi game live.
- `termsAcceptedAt` trên user (register + `POST /api/auth/accept-terms`).
- Chi tiết pháp lý học tập: [`docs/study-us-compliance.md`](../study-us-compliance.md).
- Ma trận quyền: [`OPERATOR.md`](./OPERATOR.md).
