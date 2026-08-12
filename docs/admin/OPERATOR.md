# Operator guide — AdminDashboard

Ma trận **hub × tab × capability** cho vận hành SOFIAORE. Không thay thế `TERMS.md` / `PRIVACY.md`. Quyền thực tế = `role` + `extraRoles` + `staffGrantLevel` (xem `server/src/grants.ts`).

## Hub overview

| Hub | Tabs | Ai thấy (tóm tắt) |
|-----|------|-------------------|
| Tổng quan | overview | Staff / main / **onl** (chỉ overview); ẩn tutien/mod/sgift/ring/pm/tarot78/book78 |
| Người dùng | tools, users, **roles**, mod, level, tutien, deleteAcc | Theo capability; Roles = mainadmin |
| Kinh tế | xuLevels, vault, inter, coupons, zeusPct, ludo, oanQuan, uno | vault/`coupon_ops` theo cap |
| Nội dung | pm, oracle, games, arcana | pm_assets / oracle_* / games_registry / arcana_config |
| Vận hành | system, ips, **ipWorld**, chat, room, traffic, invites | staff_dashboard + caps tách |
| Inbox | feedback, mess, gifts, rings, rolead | staff_dashboard / gift / ring / mainadmin |

## Tab × capability × CRUD

| Tab ID | Label | Capability / role | Đọc | Ghi | Ghi chú |
|--------|-------|-------------------|-----|-----|---------|
| overview | Tổng quan | staff_dashboard / main | snapshot | — | KPIs nhanh |
| tools | Tra cứu | `tools_lookup` | lookup user | — | audit |
| users | User & Bot | mainadmin (+ staff list) | list | ban, balance, outcome… | Cẩn trọng chỉnh balance |
| mod | Mod | role `mod` / main | mute tools | mute | |
| level | Level | mainadmin | rewards | claim config | |
| tutien | Tu Tiên | `cultivation_manage` | ranks | charge / rank | |
| deleteAcc | Xóa acc | mainadmin | — | soft delete | Khớp PRIVACY delete workflow |
| vault | Kho xu | `vault_ops` | vault snap | inject / drain | Theo `managedGame` |
| inter | Can thiệp Tarot | `inter_control` | room mode | patch Inter | Không CRUD probability rows |
| coupons | Coupon ẩn | `coupon_ops` (eco/main) | list | create / toggle | Xu ảo nội bộ |
| zeusPct | BOLT% / BoltPeak | mainadmin | % | patch | RTP / Peak |
| ludo | Cờ cá ngựa | mainadmin | rooms / eco | close, presets | 3 panel liên kết |
| oanQuan | Ô ăn quan | mainadmin (UI); API admin/mainadmin | rooms | force close | |
| uno | HueRush | mainadmin | rooms | force close | |
| pm | P+M | `pm_assets` | assets | upload SFX/cover | Cover game → registry `coverUrl` |
| oracle | Bói bài / Lab | `oracle_manage` / `oracle_cards` / `oracle_library` | CMS + Library | tarot78=Cards+Library · book78=Library+Lab · main full |
| games | Games | `games_registry` (main/admin) | registry | pathSuffix, kind, vaultKey, coverUrl · `enabled: false` / `coming_soon` |
| roles | Roles | mainadmin | showcase + matrix + assign | Hub Người dùng |
| arcana | Bánh xe | `arcana_config` (+ managedGame arcana) | config, spins | slots / RTP | Panel `ArcanaAdminPanel` |
| system | Hệ thống | staff_dashboard | health | limited | |
| ips | IP | `ip_audit` | history | block device | |
| ipWorld | IpWorld | `ip_audit` | geo by country | block/kick IP | không auto-ban cả nước |
| chat | Chat | `chat_config` | config | patch | |
| room | Room | `room_admin_tab` | rooms | lock / close | voice Room# |
| traffic | Lưu lượng | `traffic_view` | charts | — | Tarot managed |
| invites | Đăng ký | `invite_ops` | codes | create / require | |
| feedback | Feedback | staff_dashboard | inbox | reply / status | Privacy requests |
| mess | Mess | staff_dashboard | inbox | reply | |
| gifts | Quà | `gift_manage` | catalog | CRUD gift | social lane |
| rings | Nhẫn | `ring_manage` | catalog | CRUD | social lane |
| rolead | RoleAD | mainadmin | cosmetics | assign | nameColor / frames |

## Trách nhiệm tách rõ

- **Games** = registry manifest (path, kind, vault, cover, status).
- **P+M** = file assets (SFX, ảnh cover); sau upload gán `coverUrl` trên Games nếu cần.
- **Inter** = tune hành vi bàn Tarot, không phải editor xác suất từng lá.
- **Vault** = kho nhà cái theo `vaultKey` (tarot / arcana / gem…).

## Ops checklist (ngoài code)

- Backup S3: biến `BACKUP_S3_*` trong README — verify restore định kỳ.
- Privacy delete: `PRIVACY.md` + tab Feedback / deleteAcc.
- Entity / LLC trong Terms: ngoài scope code — cập nhật legal riêng.
- `termsAcceptedAt`: lưu trên user khi register hoặc `POST /api/auth/accept-terms` (ComplianceGate sau login).

Xem thêm per-game: [`GAME_OPS.md`](./GAME_OPS.md).
