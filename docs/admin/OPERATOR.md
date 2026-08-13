# Operator guide — AdminDashboard

Ma trận **hub × tab × capability** cho vận hành SOFIA. Không thay thế `TERMS.md` / `PRIVACY.md`. Quyền thực tế = `role` + `extraRoles` + `staffGrantLevel` (xem `be/src/grants.ts`).

## Hub overview

| Hub | Tabs | Ai thấy (tóm tắt) |
|-----|------|-------------------|
| Tổng quan | overview | Staff / main / **onl** (chỉ overview); ẩn tutien/mod/sgift/ring/pm/tarot78/book78 |
| Người dùng | tools, users, **roles**, mod, level, tutien, deleteAcc | Theo capability; Roles = mainadmin |
| Kinh tế | xuLevels, vault, coupons | vault / `coupon_ops` — không trộn room game |
| **Trò chơi** | games, inter, arcana, zeusPct, ludo, oanQuan, uno, oracle | Theo game + registry; Inter/Arcana tự gắn `managedGame` |
| Nội dung | pm | `pm_assets` (SFX · cover · cosmetics Bói) |
| Vận hành | system, ips, **ipWorld**, chat, room, traffic, invites | staff_dashboard + caps tách |
| Inbox | feedback, mess, gifts, rings, rolead | staff_dashboard / gift / ring / mainadmin |

## Check theo game (Hub Trò chơi)

| Game | Tab chính | Cùng xem thêm |
|------|-----------|---------------|
| Tarot | inter | vault (managedGame=tarot), traffic, games |
| Arcana | arcana | vault (arcana), games |
| BoltPeak | zeusPct | games |
| Cờ cá ngựa | ludo | games |
| Ô ăn quan | oanQuan | games |
| HueRush | uno | games |
| Bói bài | oracle | pm (cosmetics), games |

Chi tiết API / guest: [`GAME_OPS.md`](./GAME_OPS.md). Overview có block **Check theo game** + **Bản đồ quản lí**.

## Tab × capability × CRUD

| Tab ID | Label | Capability / role | Đọc | Ghi | Ghi chú |
|--------|-------|-------------------|-----|-----|---------|
| overview | Tổng quan | staff_dashboard / main | snapshot | — | KPIs + checklist game |
| tools | Tra cứu | `tools_lookup` | lookup user | — | audit |
| users | User & Bot | mainadmin (+ staff list) | list | ban, balance, outcome… | Cẩn trọng chỉnh balance |
| mod | Mod | role `mod` / main | mute tools | mute | |
| level | Level | mainadmin | rewards | claim config | |
| tutien | Tu Tiên | `cultivation_manage` | ranks | charge / rank | |
| deleteAcc | Xóa acc | mainadmin | — | soft delete | Khớp PRIVACY delete workflow |
| vault | Kho xu | `vault_ops` | vault snap | inject / drain | Theo `managedGame` |
| inter | Tarot · Inter | `inter_control` | room mode | patch Inter | Mở tab → managedGame=tarot |
| coupons | Coupon ẩn | `coupon_ops` (eco/main) | list | create / toggle | Xu ảo nội bộ |
| zeusPct | BoltPeak · BOLT% | mainadmin | % | patch | RTP / Peak |
| ludo | Cờ cá ngựa | mainadmin | rooms / eco | close, presets | 3 panel liên kết |
| oanQuan | Ô ăn quan | mainadmin (UI); API admin/mainadmin | rooms | force close | |
| uno | HueRush | mainadmin | rooms | force close | |
| pm | P+M | `pm_assets` | assets | upload SFX/cover | Cover game → registry `coverUrl` |
| oracle | Bói bài / Lab | `oracle_manage` / `oracle_cards` / `oracle_library` | CMS + Library | tarot78=Cards+Library · book78=Library+Lab · main full |
| games | Games registry | `games_registry` (main/admin) | registry | pathSuffix, kind, vaultKey, coverUrl · `enabled: false` / `coming_soon` |
| roles | Roles | mainadmin | showcase + matrix + assign | Hub Người dùng |
| arcana | Bánh xe Arcana | `arcana_config` | config, spins | slots / RTP | Mở tab → managedGame=arcana |
| system | Hệ thống | staff_dashboard | health | limited | |
| ips | IP | `ip_audit` | history | block device | |
| ipWorld | IpWorld | `ip_audit` | geo by country | block/kick IP | không auto-ban cả nước |
| chat | Chat | `chat_config` | config | patch | |
| room | Room | `room_admin_tab` | rooms | lock / close | voice Room# |
| traffic | Lưu lượng | `traffic_view` | charts | — | Tarot; mở tab → managedGame=tarot |
| invites | Đăng ký | `invite_ops` | codes | create / require | |
| feedback | Feedback | staff_dashboard | inbox | reply / status | Privacy requests |
| mess | Mess | staff_dashboard | inbox | reply | |
| gifts | Quà | `gift_manage` | catalog | CRUD gift | social lane |
| rings | Nhẫn | `ring_manage` | catalog | CRUD | social lane |
| rolead | RoleAD | mainadmin | cosmetics | assign | nameColor / frames |

## Trách nhiệm tách rõ

- **Trò chơi** = vận hành từng lane chơi + registry.
- **Kinh tế** = mức xu / kho / coupon (không room).
- **Nội dung (P+M)** = file assets; sau upload gán `coverUrl` trên Games nếu cần.
- **Inter** = tune hành vi bàn Tarot, không phải editor xác suất từng lá.
- **Vault** = kho nhà cái theo `vaultKey` (tarot / arcana / gem…).

## Ops checklist (ngoài code)

- Backup S3: biến `BACKUP_S3_*` trong README — verify restore định kỳ.
- Privacy delete: `PRIVACY.md` + tab Feedback / deleteAcc.
- Entity / LLC trong Terms: ngoài scope code — cập nhật legal riêng.
- `termsAcceptedAt`: lưu trên user khi register hoặc `POST /api/auth/accept-terms` (ComplianceGate sau login).

Xem thêm per-game: [`GAME_OPS.md`](./GAME_OPS.md).
