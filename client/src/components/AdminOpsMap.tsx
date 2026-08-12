import type { AdminTabId } from "./admin/adminHubs";

export type AdminOpsMapTab = AdminTabId;

const ROWS: {
  what: string;
  where: string;
  tab: AdminOpsMapTab;
  who: string;
}[] = [
  {
    what: "Tra cứu username · ID · IP · guest",
    where: "Tra cứu",
    tab: "tools",
    who: "main / audit",
  },
  {
    what: "User · bot · role · ban · mute · VIP",
    where: "User & Bot",
    tab: "users",
    who: "main / staff",
  },
  {
    what: "Cấp / thu quyền Mod",
    where: "Mod",
    tab: "mod",
    who: "main / staff",
  },
  {
    what: "Level play · phần thưởng · set level user",
    where: "Level",
    tab: "level",
    who: "mainadmin",
  },
  {
    what: "Tu Tiên rank · cap · màu · benefit",
    where: "Tu Tiên",
    tab: "tutien",
    who: "main / tutien",
  },
  {
    what: "Xóa tài khoản vĩnh viễn",
    where: "Xóa acc",
    tab: "deleteAcc",
    who: "mainadmin",
  },
  {
    what: "Kho xu · edge · ledger",
    where: "Kho xu",
    tab: "vault",
    who: "main / eco",
  },
  {
    what: "Can thiệp Tarot · bias · signal vault",
    where: "Can thiệp Tarot",
    tab: "inter",
    who: "main / inter",
  },
  {
    what: "Coupon ẩn · lịch sử dùng",
    where: "Coupon ẩn",
    tab: "coupons",
    who: "main / eco · coupon_ops",
  },
  {
    what: "Mức xu tuỳ chọn · tất cả game",
    where: "Mức xu",
    tab: "xuLevels",
    who: "mainadmin",
  },
  {
    what: "BoltPeak combo · lightning · tier · pay mode",
    where: "Kinh tế → BOLT% → Combo",
    tab: "zeusPct",
    who: "mainadmin",
  },
  {
    what: "BoltPeak hũ · feed · FS · hold trigger",
    where: "Kinh tế → BOLT% → Hũ & FS",
    tab: "zeusPct",
    who: "mainadmin",
  },
  {
    what: "BoltPeak force FS · Hold · rage · ±xu player",
    where: "Kinh tế → BOLT% → Can thiệp",
    tab: "zeusPct",
    who: "mainadmin",
  },
  {
    what: "Ludo phòng live · đóng phòng",
    where: "Ludo → Phòng",
    tab: "ludo",
    who: "mainadmin",
  },
  {
    what: "Ludo stake · giá · economy",
    where: "Ludo → Tiền bạc",
    tab: "ludo",
    who: "mainadmin",
  },
  {
    what: "Ludo cosmetics bàn · quân",
    where: "Ludo → Cosmetics",
    tab: "ludo",
    who: "mainadmin",
  },
  {
    what: "Ô ăn quan · rooms · force close",
    where: "Ô ăn quan",
    tab: "oanQuan",
    who: "mainadmin",
  },
  {
    what: "HueRush · rooms · force close",
    where: "HueRush",
    tab: "uno",
    who: "mainadmin",
  },
  {
    what: "Âm SFX (Tarot / BoltPeak / Arcana / Bói) + upload",
    where: "P+M → SFX",
    tab: "pm",
    who: "main / P+M",
  },
  {
    what: "Cosmetics Bói (úp bài · nền · FX)",
    where: "P+M → Bói",
    tab: "pm",
    who: "main / P+M",
  },
  {
    what: "Cover lobby · hero · symbol BoltPeak / Cờ cá ngựa",
    where: "P+M → Ảnh",
    tab: "pm",
    who: "main / P+M",
  },
  {
    what: "CMS 78 lá · Library · Lab (theo role)",
    where: "Bói bài / Lab",
    tab: "oracle",
    who: "main / tarot78 (cards) / book78 (library)",
  },
  {
    what: "Games registry · pathSuffix · cover · enabled",
    where: "Games",
    tab: "games",
    who: "main / admin · games_registry",
  },
  {
    what: "Ma trận role · showcase · gán primary/extra",
    where: "Roles",
    tab: "roles",
    who: "mainadmin",
  },
  {
    what: "Bánh xe Arcana · config spin",
    where: "Bánh xe",
    tab: "arcana",
    who: "main / arcana_config",
  },
  {
    what: "An ninh mạng · health · CORS · rate-limit",
    where: "Hệ thống",
    tab: "system",
    who: "main / staff_dashboard",
  },
  {
    what: "IP online · block · cụm",
    where: "IP",
    tab: "ips",
    who: "main / ip_audit",
  },
  {
    what: "IpWorld · theo quốc gia · proxy/hosting",
    where: "IpWorld",
    tab: "ipWorld",
    who: "main / ip_audit",
  },
  {
    what: "Chat config · filter · slow mode",
    where: "Chat",
    tab: "chat",
    who: "main / chat_config",
  },
  {
    what: "Voice room admin · ghế · mute",
    where: "Room",
    tab: "room",
    who: "main / mod",
  },
  {
    what: "Lưu lượng online · stake · edge",
    where: "Lưu lượng",
    tab: "traffic",
    who: "main / traffic_view",
  },
  {
    what: "Mã đăng ký · bắt buộc invite",
    where: "Đăng ký",
    tab: "invites",
    who: "main / invite_ops",
  },
  {
    what: "Góp ý ticket",
    where: "Feedback",
    tab: "feedback",
    who: "main / staff_dashboard",
  },
  {
    what: "Mess 1–1 (+ ảnh)",
    where: "Mess",
    tab: "mess",
    who: "main / staff_dashboard",
  },
  {
    what: "Catalog quà",
    where: "Quà",
    tab: "gifts",
    who: "main / SGift",
  },
  {
    what: "Catalog nhẫn",
    where: "Nhẫn",
    tab: "rings",
    who: "main / Ring",
  },
  {
    what: "Role rail cosmetic · labels · màu",
    where: "RoleAD",
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

  if (rows.length === 0) return null;

  return (
    <section className="app-panel mt-4 space-y-2 p-3 sm:p-4">
      <div>
        <p className="play-heading text-sm">Bản đồ quản lí</p>
        <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
          Mọi tính năng staff — bấm để nhảy tới hub/tab tương ứng.
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
  );
}
