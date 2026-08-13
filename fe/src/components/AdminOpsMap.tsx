import { GAME_ADMIN_CHECK, type AdminTabId } from "./admin/adminHubs";

export type AdminOpsMapTab = AdminTabId;

const ROWS: {
  what: string;
  where: string;
  tab: AdminOpsMapTab;
  who: string;
}[] = [
  {
    what: "Tra cứu username · ID · IP · guest",
    where: "Người dùng → Tra cứu",
    tab: "tools",
    who: "main / audit",
  },
  {
    what: "User · bot · role · ban · mute · VIP",
    where: "Người dùng → User & Bot",
    tab: "users",
    who: "main / staff",
  },
  {
    what: "Ma trận role · showcase · gán primary/extra",
    where: "Người dùng → Roles",
    tab: "roles",
    who: "mainadmin",
  },
  {
    what: "Cấp / thu quyền Mod",
    where: "Người dùng → Mod",
    tab: "mod",
    who: "main / staff",
  },
  {
    what: "Level play · phần thưởng · set level user",
    where: "Người dùng → Level",
    tab: "level",
    who: "mainadmin",
  },
  {
    what: "Tu Tiên rank · cap · màu · benefit",
    where: "Người dùng → Tu Tiên",
    tab: "tutien",
    who: "main / tutien",
  },
  {
    what: "Xóa tài khoản vĩnh viễn",
    where: "Người dùng → Xóa acc",
    tab: "deleteAcc",
    who: "mainadmin",
  },
  {
    what: "BoltPeak combo · lightning · tier · pay mode",
    where: "Trò chơi → BOLT% → Combo",
    tab: "zeusPct",
    who: "mainadmin",
  },
  {
    what: "BoltPeak hũ · feed · FS · hold trigger",
    where: "Trò chơi → BOLT% → Hũ & FS",
    tab: "zeusPct",
    who: "mainadmin",
  },
  {
    what: "BoltPeak force FS · Hold · rage · ±xu player",
    where: "Trò chơi → BOLT% → Can thiệp",
    tab: "zeusPct",
    who: "mainadmin",
  },
  {
    what: "Ludo phòng live · đóng phòng",
    where: "Trò chơi → Cờ cá ngựa → Phòng",
    tab: "ludo",
    who: "mainadmin",
  },
  {
    what: "Ludo stake · giá · economy",
    where: "Trò chơi → Cờ cá ngựa → Tiền bạc",
    tab: "ludo",
    who: "mainadmin",
  },
  {
    what: "Ludo cosmetics bàn · quân",
    where: "Trò chơi → Cờ cá ngựa → Cosmetics",
    tab: "ludo",
    who: "mainadmin",
  },
  {
    what: "Ô ăn quan · rooms · force close",
    where: "Trò chơi → Ô ăn quan",
    tab: "oanQuan",
    who: "mainadmin",
  },
  {
    what: "HueRush · rooms · force close",
    where: "Trò chơi → HueRush",
    tab: "uno",
    who: "mainadmin",
  },
  {
    what: "Can thiệp Tarot · bias · signal vault",
    where: "Trò chơi → Tarot · Inter",
    tab: "inter",
    who: "main / inter",
  },
  {
    what: "Bánh xe Arcana · config spin",
    where: "Trò chơi → Bánh xe Arcana",
    tab: "arcana",
    who: "main / arcana_config",
  },
  {
    what: "CMS 78 lá · Library · Lab (theo role)",
    where: "Trò chơi → Bói bài / Lab",
    tab: "oracle",
    who: "main / tarot78 (cards) / book78 (library)",
  },
  {
    what: "Games registry · pathSuffix · cover · enabled",
    where: "Trò chơi → Games registry",
    tab: "games",
    who: "main / admin · games_registry",
  },
  {
    what: "Âm SFX (Tarot / BoltPeak / Arcana / Bói) + upload",
    where: "Nội dung → P+M → SFX",
    tab: "pm",
    who: "main / P+M",
  },
  {
    what: "Cosmetics Bói (úp bài · nền · FX)",
    where: "Nội dung → P+M → Bói",
    tab: "pm",
    who: "main / P+M",
  },
  {
    what: "Cover lobby · hero · symbol BoltPeak / Cờ cá ngựa",
    where: "Nội dung → P+M → Ảnh",
    tab: "pm",
    who: "main / P+M",
  },
  {
    what: "Kho xu · edge · ledger",
    where: "Kinh tế → Kho xu",
    tab: "vault",
    who: "main / eco",
  },
  {
    what: "Coupon ẩn · lịch sử dùng",
    where: "Kinh tế → Coupon ẩn",
    tab: "coupons",
    who: "main / eco · coupon_ops",
  },
  {
    what: "Mức xu tuỳ chọn · tất cả game",
    where: "Kinh tế → Mức xu",
    tab: "xuLevels",
    who: "mainadmin",
  },
  {
    what: "An ninh mạng · health · CORS · rate-limit",
    where: "Vận hành → Hệ thống",
    tab: "system",
    who: "main / staff_dashboard",
  },
  {
    what: "IP online · block · cụm",
    where: "Vận hành → IP",
    tab: "ips",
    who: "main / ip_audit",
  },
  {
    what: "IpWorld · theo quốc gia · proxy/hosting",
    where: "Vận hành → IpWorld",
    tab: "ipWorld",
    who: "main / ip_audit",
  },
  {
    what: "Chat config · filter · slow mode",
    where: "Vận hành → Chat",
    tab: "chat",
    who: "main / chat_config",
  },
  {
    what: "Voice room admin · ghế · mute",
    where: "Vận hành → Room",
    tab: "room",
    who: "main / mod",
  },
  {
    what: "Lưu lượng online · stake · edge (Tarot)",
    where: "Vận hành → Lưu lượng",
    tab: "traffic",
    who: "main / traffic_view",
  },
  {
    what: "Mã đăng ký · bắt buộc invite",
    where: "Vận hành → Đăng ký",
    tab: "invites",
    who: "main / invite_ops",
  },
  {
    what: "Góp ý ticket",
    where: "Inbox → Feedback",
    tab: "feedback",
    who: "main / staff_dashboard",
  },
  {
    what: "Mess 1–1 (+ ảnh)",
    where: "Inbox → Mess",
    tab: "mess",
    who: "main / staff_dashboard",
  },
  {
    what: "Catalog quà",
    where: "Inbox → Quà",
    tab: "gifts",
    who: "main / SGift",
  },
  {
    what: "Catalog nhẫn",
    where: "Inbox → Nhẫn",
    tab: "rings",
    who: "main / Ring",
  },
  {
    what: "Role rail cosmetic · labels · màu",
    where: "Inbox → RoleAD",
    tab: "rolead",
    who: "mainadmin",
  },
];

export function AdminOpsMap({
  visibleTabs,
  onGo,
}: {
  visibleTabs: Set<string> | string[];
  onGo: (tab: AdminOpsMapTab) => void;
}) {
  const vis = visibleTabs instanceof Set ? visibleTabs : new Set(visibleTabs);
  const rows = ROWS.filter((r) => vis.has(r.tab));
  const gameRows = GAME_ADMIN_CHECK.filter((g) =>
    g.tabs.some((t) => vis.has(t)),
  );

  if (rows.length === 0 && gameRows.length === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      {gameRows.length > 0 ? (
        <section className="app-panel space-y-2 p-3 sm:p-4">
          <div>
            <p className="play-heading text-sm">Check theo game</p>
            <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
              Hub Trò chơi — bấm tab chính để mở nhanh.
            </p>
          </div>
          <ul className="divide-y divide-[var(--wood-deep)]/10">
            {gameRows.map((g) => {
              const primary =
                g.tabs.find((t) => vis.has(t)) ?? g.tabs[0]!;
              return (
                <li
                  key={g.game}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-[var(--play-ink)]">
                      {g.game}
                      <span className="ml-1 font-normal text-[var(--play-muted)]">
                        {g.path}
                      </span>
                    </p>
                    <p className="text-[10px] text-[var(--play-muted)]">
                      {g.notes}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onGo(primary)}
                    className="shrink-0 rounded-full bg-white px-3 py-1 text-[10px] font-bold text-[var(--wood-deep)] ring-1 ring-[var(--wood-deep)]/20"
                  >
                    Mở ›
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {rows.length > 0 ? (
        <section className="app-panel space-y-2 p-3 sm:p-4">
          <div>
            <p className="play-heading text-sm">Bản đồ quản lí</p>
            <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
              Hub → mục — bấm để nhảy tới tab tương ứng.
            </p>
          </div>
          <ul className="divide-y divide-[var(--wood-deep)]/10">
            {rows.map((r) => (
              <li
                key={`${r.tab}-${r.what}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-[var(--play-ink)]">
                    {r.what}
                  </p>
                  <p className="text-[10px] text-[var(--play-muted)]">
                    {r.where} · {r.who}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onGo(r.tab)}
                  className="shrink-0 rounded-full bg-white px-3 py-1 text-[10px] font-bold text-[var(--wood-deep)] ring-1 ring-[var(--wood-deep)]/20"
                >
                  {r.where.split("→")[0]?.trim() ?? r.tab} ›
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
