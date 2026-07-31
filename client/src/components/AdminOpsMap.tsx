export type AdminOpsMapTab =
  | "pm"
  | "oracle"
  | "games"
  | "feedback"
  | "mess"
  | "gifts"
  | "rings"
  | "vault"
  | "rolead";

const ROWS: {
  what: string;
  where: string;
  tab: AdminOpsMapTab;
  who: string;
}[] = [
  {
    what: "Âm SFX (Tarot / Olympus / Arcana / Bói) + upload",
    where: "P+M → SFX",
    tab: "pm",
    who: "main / P+M",
  },
  {
    what: "Cosmetics Bói (úp bài · nền · FX)",
    where: "P+M → Cosmetics Bói",
    tab: "pm",
    who: "main / P+M",
  },
  {
    what: "Cover lobby · hero bàn",
    where: "P+M",
    tab: "pm",
    who: "main / P+M",
  },
  {
    what: "Bộ bài / Lab lá (deck · tags)",
    where: "Bói bài / Lab",
    tab: "oracle",
    who: "main / oracle_manage",
  },
  {
    what: "Bật/tắt lane Games",
    where: "Games",
    tab: "games",
    who: "main / staff",
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
    where: "Gifts",
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
    what: "Kho xu / edge",
    where: "Vault",
    tab: "vault",
    who: "main / eco",
  },
  {
    what: "Role rail cosmetic",
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
          Âm / ảnh / inbox / catalog nằm tab nào — bấm để nhảy tới.
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
