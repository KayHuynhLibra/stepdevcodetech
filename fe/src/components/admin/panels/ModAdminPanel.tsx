import { formatXu } from "../../../cards";
import {
  parseXuFromDetail,
  xuHitLevel,
  xuHitRowClass,
  XU_HIGHLIGHT_HUGE,
  XU_HIGHLIGHT_LARGE,
} from "../../../xuHighlight";

type AuditRow = {
  id: string;
  actorName: string;
  action: string;
  targetName?: string;
  detail?: string;
  at: number;
};

type ReportRow = {
  id: string;
  reporterName: string;
  targetName: string;
  text: string;
  status: "open" | "done";
};

export function ModAdminPanel({
  audit,
  reports,
  onMarkReport,
}: {
  audit: AuditRow[];
  reports: ReportRow[];
  onMarkReport: (id: string, status: "open" | "done") => void | Promise<void>;
}) {
  return (
    <>
      <section className="app-panel mt-4 p-3 sm:p-4">
        <p className="play-heading text-sm">Audit log</p>
        <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
          Thao tác staff gần đây (Inter, VIP, ban, vault…). Khoanh vàng ≥{" "}
          {formatXu(XU_HIGHLIGHT_LARGE)} · đỏ ≥ {formatXu(XU_HIGHLIGHT_HUGE)}.
        </p>
        <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto sm:max-h-80">
          {audit.length === 0 && (
            <li className="text-[11px] text-[var(--play-muted)]">
              Chưa có bản ghi
            </li>
          )}
          {audit.map((a) => {
            const amt = parseXuFromDetail(a.detail);
            const hit = xuHitLevel(amt);
            return (
              <li
                key={a.id}
                className={`rounded-lg bg-white/70 px-2 py-1.5 text-[11px] ring-1 ring-[var(--wood-deep)]/10 ${xuHitRowClass(hit)}`}
                title={
                  hit !== "normal" ? `Số lớn: ${formatXu(amt)}` : undefined
                }
              >
                <span className="font-semibold text-[var(--play-ink)]">
                  {a.actorName}
                </span>{" "}
                · {a.action}
                {a.targetName ? ` → ${a.targetName}` : ""}
                {a.detail ? (
                  <>
                    {" · "}
                    <span className="xu-hit__amt">{a.detail}</span>
                  </>
                ) : null}
                {hit !== "normal" && (
                  <span className="ml-1 text-[9px] font-extrabold uppercase opacity-80">
                    {hit === "huge" ? "RẤT LỚN" : "LỚN"}
                  </span>
                )}
                <span className="block text-[10px] text-[var(--play-muted)]">
                  {new Date(a.at).toLocaleString("vi-VN")}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="app-panel mt-4 p-3 sm:p-4">
        <p className="play-heading text-sm">Báo cáo chat</p>
        <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto sm:max-h-80">
          {reports.length === 0 && (
            <li className="text-[11px] text-[var(--play-muted)]">
              Chưa có báo cáo
            </li>
          )}
          {reports.map((r) => (
            <li
              key={r.id}
              className="rounded-lg bg-white/70 px-2 py-1.5 text-[11px] ring-1 ring-[var(--wood-deep)]/10"
            >
              <p>
                <span className="font-semibold">{r.reporterName}</span> báo{" "}
                <span className="font-semibold">{r.targetName}</span>
                {r.status === "done" ? " · xong" : " · mở"}
              </p>
              <p className="text-[var(--play-ink)]">“{r.text}”</p>
              <div className="mt-1 flex gap-1">
                <button
                  type="button"
                  className="rounded-full bg-[var(--wood-deep)] px-2 py-0.5 text-[10px] font-bold text-white"
                  onClick={() =>
                    void onMarkReport(
                      r.id,
                      r.status === "done" ? "open" : "done",
                    )
                  }
                >
                  {r.status === "done" ? "Mở lại" : "Đánh dấu xong"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
