# Game ops — per-game admin & APIs

Hướng dẫn vận hành từng trò trên SOFIAORE. Xu chơi = điểm ảo (`spendLane: "play"`). Không nạp/rút tiền thật.

| Game | Page | Guest | Admin tab | APIs chính | Mức xu / stake |
|------|------|-------|-----------|------------|----------------|
| Tarot | `GamePage` | OK | Inter, Vault, Traffic | `/api/game/*`, Inter admin | stake presets server |
| Arcana | `ArcanaWheelPage` | OK (auth hoặc `x-guest-id`) | Arcana (`arcana_config`) | `/api/arcana-wheel/*`, `/api/mainadmin/arcana/*` | spin cost config |
| BoltPeak | `OlympusCasinoPage` | OK | BOLT% (`zeusPct`) | Olympus routes + BOLT % | mức xu UI (không “Cược”) |
| Cờ cá ngựa | `LudoPage` | OK | Ludo (×3 panel) | Ludo admin APIs | mức xu / presets |
| Ô ăn quan | `OanQuanPage` | OK | oanQuan | `GET/POST /api/admin/oan-quan/rooms*` | STAKE_PRESETS client |
| HueRush | `UnoPage` | OK | uno | `GET/POST /api/admin/uno/rooms*` | stake presets |
| Bói bài | `BoiBaiPage` | OK | oracle | Oracle CMS `/api/admin/oracle/*` | free / xu theo ritual |

## Chung

- Lobby: `GET /api/platform/games` + `GameLobby` (`coverUrl` optional).
- Shell: `GamePlayShell` / `GameChrome` + `VirtualPlayFooter` (18+ · xu ảo · `/responsible`).
- Registry admin: tab **Games** — `pathSuffix`, `kind`, `vaultKey`, `coverUrl`, `nameVi`, status, sort, enabled.
- Thêm game mới: [`docs/GAME_MODULE.md`](../GAME_MODULE.md).

---

## Tarot

- **Admin:** Inter (can thiệp phòng), Vault (kho tarot), Traffic.
- **Guest:** `/guest/:code/play` — balance guest session.
- **Copy:** không gợi nạp tiền thật; coupon nội bộ OK.

## Arcana (Bánh xe)

- **Guest:** route `/guest/:code/arcana`; API nhận token **hoặc** header `x-guest-id`; balance guest trong `arcanaWheelStore`.
- **Admin:** `ArcanaAdminPanel` — slots, RTP preview, spin log (`arcana_config`).
- **Vault:** `vaultKey: arcana` khi bật kho riêng.

## Olympus

- **Admin:** tab ZeusPct — chỉnh % / RTP nhà cái.
- **Copy user:** “Mức xu” / “Mức”, không “Cược” / “Casino” trên UI.
- **Guest:** OK.

## Ludo

- **Admin:** tab Ludo (rooms + economy + liên kết cross-nav).
- **Copy:** “Mức xu” / “Mức chơi”.
- **Guest:** OK.

## Ô ăn quan

- **Admin:** `OanQuanAdminPanel` — list phòng, stake/pot, force close.
- **API:**
  - `GET /api/admin/oan-quan/rooms` — admin hoặc mainadmin
  - `POST /api/admin/oan-quan/rooms/:id/close` — mainadmin
- **Store:** `oanQuanRoomStore.listAdmin` / `adminClose`.

## UNO

- **Admin:** `UnoAdminPanel` — rooms, close, bot fill / presets.
- **API:**
  - `GET /api/admin/uno/rooms`
  - `POST /api/admin/uno/rooms/:id/close`
- **Store:** `unoRoomStore`.

## Bói bài (Oracle)

- **Admin:** OracleAdminPanel — decks, spreads, timing, Lab (staff only).
- **Roles tài liệu:** `tarot78` = Cards + Library (`oracle_cards`); `book78` = Library + Lab (`oracle_library`); `mainadmin` full.
- Seed local: `tarot78`, `book78`, `eco`, `audit`, `sgift`, `ring`, `pm`, `onl`, … (env `SEED_*_PASSWORD`).
- Caps mới: `games_registry`, `coupon_ops`, `oracle_cards`, `oracle_library`.
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
