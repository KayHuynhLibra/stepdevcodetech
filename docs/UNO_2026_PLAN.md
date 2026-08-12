# HueRush — kế hoạch module bài 4 màu (SOFIAORE)

> Module bài **HueRush** (original brand) · luật kiểu bài màu phổ thông · REST + polling  
> **Không** dùng thương hiệu bên thứ ba trên UI / docs công khai.

---

## Luật chơi (chuẩn)

| Hạng mục | Chi tiết |
|----------|----------|
| Bộ bài | **112 lá** / bộ (+2 Wild + +2 Wild+4) |
| Màu | Đỏ · Vàng · Lá · Lam |
| Số | 0–9 (mỗi số 2 lá, trừ 0 chỉ 1 lá/màu) |
| Hành động | Skip · Reverse · +2 (mỗi màu 2 lá) |
| Wild | Wild đổi màu · Wild +4 · **chồng +2/+4** |
| Người chơi | **2–10** (5+ dùng 2–3 bộ bài) |
| Chia bài | 7 lá/người |
| Lá úp đầu | Không được là Wild +4 |
| Thắng | Hết bài trước |
| Rush | Gọi khi còn 1–2 lá · **quên = +2 lá** · đối thủ bắt trong 4s |
| Hướng | Reverse đảo chiều; 2 người = Skip |
| Rút | Không có lá hợp lệ → rút 1 (hoặc chịu +2/+4) |
| Cược | 0 / 500 / 1000 / 5000 xu chơi (lane `play`) |

---

## Giao diện

| Vùng | Mô tả |
|------|--------|
| Lobby | Chọn Vs Bot / PvP · số người 2–4 · mức xu · join mã phòng |
| Bàn | Nỉ xanh · lá úp/rút · đối thủ (số lá) · tay bài cuộn ngang |
| Màu active | Pill màu đang hiệu lực |
| Wild picker | 4 nút màu khi chơi Wild/+4 |
| FX | flash đánh · shake rút · wobble Skip/Reverse · rainbow Wild · confetti thắng |
| SFX | move · draw · win (qua `useSfx`) |
| Mobile | Lá thu nhỏ <480px · tay bài scroll snap |

---

## Kiến trúc file

```
server/src/unoEngine.ts       — luật thuần
server/src/unoRoomStore.ts    — phòng, bot, tick, economy
server/src/unoRoutes.ts       — REST API
client/src/pages/UnoPage.tsx
client/src/platform/uno/
  UnoBoard.tsx · UnoCardFace.tsx · types.ts · uno.css
```

API: `GET/POST /api/uno/rooms`, `play`, `draw`, `color`, `uno`, `reconnect`

---

## 20 mục AUTO (tích hợp tự chạy)

| # | Mục | Trạng thái | File / hành vi |
|---|-----|------------|----------------|
| 1 | Manifest server | ✅ | `platformGamesStore.ts` — id `uno`, sort 26 |
| 2 | Manifest client fallback | ✅ | `games.ts` |
| 3 | Lobby tone + glyph | ✅ | `gameTones.ts` — đỏ UNO |
| 4 | Cover lobby SVG | ✅ | `public/assets/lobby/uno.svg` |
| 5 | Lazy chunk + prefetch | ✅ | `lazyGames.tsx` |
| 6 | Routes tất cả role + guest | ✅ | `App.tsx` |
| 7 | navActiveFromPath | ✅ | `games.ts` → `uno` |
| 8 | Engine 108 lá + deal | ✅ | `unoEngine.ts` |
| 9 | Room store persist JSON | ✅ | `data/uno-rooms.json` |
| 10 | Mount routes server | ✅ | `index.ts` → `mountUnoRoutes` |
| 11 | **autoStart + fillBots** | ✅ | Tạo phòng bot → chơi ngay |
| 12 | **Bot tick 900ms** | ✅ | `tickAll()` AI đánh/rút |
| 13 | **Turn timeout 25s** | ✅ | Hết giờ → auto đánh/rút + strike |
| 14 | **Poll 1.8s / 4s hidden** | ✅ | `UnoPage.tsx` |
| 15 | **Economy stake/pot** | ✅ | `adjustBalance` lane play |
| 16 | **FX theo sự kiện** | ✅ | `uno.css` + `fxPulse` |
| 17 | **SFX move/draw/win** | ✅ | `useSfx` + media presets |
| 18 | **Wild color auto (bot/timeout)** | ✅ | `seatColor()` fallback |
| 19 | **playMediaPresets gameId** | ✅ | `uno` trong store + hook |
| 20 | **Unit test engine** | ✅ | `unoEngine.test.ts` |

> Chạy test: `cd server && npm test -- unoEngine`

---

## Chế độ chơi

| Mode | Mô tả |
|------|--------|
| Vs Bot | 1 người + bot lấp đến `playerCount` · `autoStart: true` |
| PvP | Chủ tạo phòng · người join ghế trống · host Start |
| Guest | Free, không cược xu |
| Đăng nhập | Cược xu chơi · thắng bot ×1.8 stake |

---

## Hiệu ứng client (FX map)

| Sự kiện server | Class FX |
|----------------|----------|
| Đánh lá | `uno-fx--play` |
| Rút bài | `uno-fx--draw` |
| Skip | `uno-fx--skip` |
| Reverse | `uno-fx--reverse` |
| Wild / +4 | `uno-fx--wild` |
| Thắng ván | `uno-fx--win` |

---

## Mở rộng v2 (đã triển khai)

- ✅ Chồng +2/+4 (house rule)
- ✅ Phạt quên UNO +2 lá + nút bắt
- ✅ 5–10 người (multi-deck)
- ✅ Shop cosmetic lá úp + nỉ bàn (`/api/uno/shop`)

## Mở rộng sau

- Socket thay polling
- Admin panel economy UNO
