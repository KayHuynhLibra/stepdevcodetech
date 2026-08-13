# MASTER PROMPT — Bánh xe Arcana (SOFIA-TAROT)

Prompt chi tiết để Cursor/Claude mở rộng mini-game **Bánh xe Arcana** trong monorepo hiện có. **Không** tạo app Flutter/casino mới.

## 0. Bối cảnh bắt buộc

- Host app: **SOFIA-TAROT** (`fe/` React+Vite, `be/` Express+Socket.io, JSON data).
- UI tiếng Việt; theme jade / gold / wood / night.
- Hai bàn chơi độc lập; ví xu người chơi **chung**; **hai kho nhà cái riêng**.
- Cảm hứng layout “Vòng Quay Hệ Số” nhưng skin mystical Tarot — không copy casino.

---

## A. Isolation (1–15)

1. Bàn Tarot giữ nguyên route `/…/play` + `GamePage` + `game.ts`.
2. Bàn Arcana route `/…/arcana` + `ArcanaWheelPage` — file riêng.
3. Cấm gắn wheel overlay lên `GamePage`.
4. Cấm reuse `placeBet` / phase betting–revealing–payout.
5. Socket Tarot không emit state Arcana và ngược lại.
6. History spin: `arcana-spins.json` — không ghi `bets.json`.
7. Helper `arcanaPath(user)` cạnh `playPath()`.
8. Dashboard player: 2 CTA — “Vào bàn Tarot” / “Vào Bánh xe Arcana”.
9. Folder gợi ý: `be/src/arcanaWheelStore.ts`, `fe/src/pages/ArcanaWheelPage.tsx`.
10. Guest: P0 yêu cầu login để quay (có thể mở rộng sau).
11. Rời bàn Arcana không kick bàn Tarot.
12. Inter modes **chỉ** bàn Tarot.
13. Bots bàn Tarot không đặt cược Arcana.
14. Backup gồm `vault-arcana.json`, `arcana-wheel.json`, `arcana-spins.json`.
15. Acceptance: sau khi thêm Arcana, bàn Tarot vẫn chạy độc lập.

---

## B. Dual vault (16–30)

16. `vault.json` = **Kho Tarot** (stake/payout Tarot + coupon/grant/seize/admin_adjust).
17. `vault-arcana.json` = **Kho Arcana** (chỉ stake/payout/refund spin).
18. `VaultStore(fileName, label)` — 2 instance: `vaultTarot` / `vaultArcana`.
19. Alias `vaultStore === vaultTarot` để `game.ts` ít đổi.
20. Spin thắng: trừ `users.balance` stake → ghi Kho Arcana stake_in → RNG → nếu win cộng payout + payout_out Kho Arcana.
21. Không ghi spin vào `vault.json`.
22. API `/api/mainadmin/vault*` → Tarot.
23. API `/api/mainadmin/vault-arcana*` → Arcana (adjust/set only).
24. Grant/seize **không** qua Kho Arcana.
25. Overview mainadmin trả cả `vault` + `vaultArcana` + `arcanaStats`.
26. UI Kho theo game đã chọn — không gộp số 2 kho một màn.
27. Net house / edge tính riêng từng kho.
28. Ledger mỗi kho cap ~200 dòng.
29. Start balance mỗi kho mặc định 500_000 (file mới).
30. Audit action phân biệt `vault_adjust` vs `vault_arcana_adjust`.

---

## C. Mainadmin chọn game (31–45)

31. Thanh **Chọn game quản lý**: `tarot` | `arcana` (chỉ mainadmin).
32. Persist `localStorage` key `tarot_admin_managed_game`.
33. Tab Inter / Lưu lượng chỉ khi `tarot`.
34. Tab **Bánh xe** chỉ khi `arcana` (config + log spin).
35. Tab Kho đổi nhãn: “Kho Tarot” / “Kho Arcana”.
36. Tab User / Mod / Coupon / IP chung cả hai chế độ.
37. Coupon luôn gắn Kho Tarot — ghi chú trên UI.
38. `GET /api/mainadmin/games` liệt kê game + enabled.
39. `GET/PATCH /api/mainadmin/arcana/config` — enabled, stakeTiers, slots ratio/weight.
40. `GET /api/mainadmin/arcana/spins` — log admin.
41. Header admin: nút vào cả 2 bàn.
42. Role admin (không mainadmin): chơi được; không quản kho Arcana.
43. Overview stats Arcana: spinCount, winRate, houseEdgeXu.
44. Không áp Inter lên bánh xe.
45. Acceptance: đổi Chọn game → đúng kho + đúng tab.

---

## D. Gameplay bánh xe (46–70)

46. 8 ô = 8 Major Arcana (reuse art `/assets/cards/...`).
47. Hệ số mặc định: Ảo Thuật/Tư Tế 1:4; Nữ Hoàng/Hoàng Đế 1:5; Tình Nhân 1:10; Chiến Xa 1:15; Ngôi Sao 1:25; Mặt Trời 1:45.
48. Weight RNG admin chỉnh được (server).
49. Bet tiers mặc định 300 / 800 / 1500 / 3000.
50. Flow: chọn xu → chọn 1 lá → Quay số phận.
51. RNG **chỉ server** (`crypto.randomInt`); client animate theo `winId`.
52. Mỗi spin lưu `seed` + log.
53. Payout = stake × ratio nếu `pickId === winId`, else 0.
54. Header: avatar/code + số dư xu.
55. `CHUỖI VẬN >> N <<` (combo thắng/thua đơn giản).
56. History strip 8–12 kết quả gần nhất.
57. Grid 2×4 hoặc 4 cột chọn lá + hệ số.
58. Nút Quay disabled khi thiếu pick / bàn khóa / đang quay.
59. API `GET /api/arcana-wheel`, `POST /api/arcana-wheel/spin`, `GET /api/arcana-wheel/history`.
60. Rate limit spin (vd 30/phút/user).
61. Bàn có thể `enabled: false` từ admin.
62. Sync balance về `localStorage` tarot_user sau spin.
63. Emit `balanceUpdate` nếu user đang socket bàn Tarot.
64. Animation flash slots ~60FPS cảm giác, không random kết quả client.
65. Error popup/retry rõ tiếng Việt.
66. Không AdMob / OAuth / IAP ở P0.
67. Không gem/diamond — chỉ xu (+ Vé Vận Mệnh optional P1).
68. Theme CSS vars hiện có — không neon casino.
69. Mobile-first trong `AppShell`.
70. Acceptance: quay 1 lần đổi `vault-arcana.json`, **không** đổi `vault.json` balance từ spin.

---

## E. Chất lượng & deliverables (71–100)

71. Unit-friendly: tách `pickWeighted` / config validate.
72. Lint/format theo repo.
73. README nêu 2 bàn + 2 kho + backup files.
74. Docs này giữ sync với code MVP.
75. Không yêu cầu APK/IPA — Web + Express.
76. Feature-first modules, không Flutter/Riverpod.
77. SOLID: store riêng, API mỏng.
78. Demo seed: dùng account `demo` hiện có.
79. Skeleton/loading khi fetch config.
80. Ban user → không quay được.
81. Không đủ xu → lỗi rõ.
82. Stake không thuộc stakeTiers → reject.
83. pickId invalid → reject.
84. Admin sửa ratio/weight từng lá, lưu ngay.
85. Admin xem seed trong log (anti-dispute nhẹ).
86. Perf: page Arcana không load socket game Tarot.
87. Accessibility: contrast đủ trên nút cược.
88. Localization P0: VI only.
89. Dark mystical sẵn có; light mode không bắt buộc.
90. Security: JWT/bearer hiện có; HTTPS prod.
91. Offline: không hỗ trợ quay offline.
92. Version force-update: ngoài scope P0.
93. Onboarding/tutorial: optional P2.
94. Jackpot global: optional P2 (từ Kho Arcana).
95. Auto/Fast spin: optional P1.
96. Mission/daily free spin: optional P1.
97. Clan/chat/friend mới: không làm.
98. Scale 100k–1M: ghi chú tương lai (Redis/DB) — JSON đủ demo.
99. Deliverable P0: dual vault + `/arcana` playable + mainadmin game switch + docs.
100. **Yêu cầu cuối:** UI độc quyền cảm hứng Tarot; mã build được; bàn Tarot không bị phá; 2 kho sổ sách tách bạch.

---

## Acceptance checklist P0

- [ ] `vault-arcana.json` tạo khi boot
- [ ] Spin ghi Kho Arcana, không đụng số dư Kho Tarot (trừ ví user)
- [ ] Mainadmin chọn game → Kho/tab đúng
- [ ] Player vào `/player/:code/arcana` chơi được
- [ ] `/play` Tarot vẫn hoạt động
- [ ] `npx tsc -p server` / `npx tsc -p client` pass
