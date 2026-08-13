import { api } from "../../../auth";

type ChatConfig = {
  noCost?: number;
  vipCost?: number;
  saintCost?: number;
  updatedBy?: string;
  updatedAt?: number;
};

type ReportRow = {
  id: string;
  reporterName: string;
  targetName: string;
  text: string;
  status: "open" | "done";
};

export function ChatAdminPanel({
  chatConfig,
  reports = [],
  onMsg,
  onSaved,
  onMarkReport,
}: {
  chatConfig?: ChatConfig | null;
  reports?: ReportRow[];
  onMsg: (s: string) => void;
  onSaved?: () => void | Promise<void>;
  onMarkReport?: (id: string, status: "open" | "done") => void | Promise<void>;
}) {
  return (
    <section className="app-panel mt-4 p-3 sm:p-4">
      <p className="play-heading text-sm">Giá chat phòng Tarot</p>
      <p className="mt-1 text-[11px] text-[var(--play-muted)]">
        No = khung chat · VIP = bay marquee (cần VIP) · Saint = toàn màn +
        CD 45s. Lịch sử khung chat reset mỗi ngày (UTC).
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-[11px] font-semibold text-[var(--play-muted)]">
          No (xu / tin)
          <input
            id="mainadmin-chat-no-cost"
            type="number"
            min={1}
            max={100000}
            step={1}
            defaultValue={chatConfig?.noCost ?? 10}
            className="app-input mt-1 w-full !py-1.5 text-sm tabular-nums"
          />
        </label>
        <label className="text-[11px] font-semibold text-[var(--play-muted)]">
          VIP (xu / tin)
          <input
            id="mainadmin-chat-vip-cost"
            type="number"
            min={1}
            max={100000}
            step={1}
            defaultValue={chatConfig?.vipCost ?? 50}
            className="app-input mt-1 w-full !py-1.5 text-sm tabular-nums"
          />
        </label>
        <label className="text-[11px] font-semibold text-[var(--play-muted)]">
          Saint (xu / tin)
          <input
            id="mainadmin-chat-saint-cost"
            type="number"
            min={100}
            max={1000000}
            step={100}
            defaultValue={chatConfig?.saintCost ?? 10_000}
            className="app-input mt-1 w-full !py-1.5 text-sm tabular-nums"
          />
        </label>
      </div>
      <button
        type="button"
        className="app-btn-primary mt-4 !w-auto !px-4 !py-2 !text-xs"
        onClick={async () => {
          const noEl = document.getElementById(
            "mainadmin-chat-no-cost",
          ) as HTMLInputElement | null;
          const vipEl = document.getElementById(
            "mainadmin-chat-vip-cost",
          ) as HTMLInputElement | null;
          const saintEl = document.getElementById(
            "mainadmin-chat-saint-cost",
          ) as HTMLInputElement | null;
          try {
            await api("/api/mainadmin/chat-config", {
              method: "POST",
              body: JSON.stringify({
                noCost: Number(noEl?.value),
                vipCost: Number(vipEl?.value),
                saintCost: Number(saintEl?.value),
              }),
            });
            onMsg("Đã lưu giá chat No / VIP / Saint");
            await onSaved?.();
          } catch (err) {
            onMsg(err instanceof Error ? err.message : "Lỗi cấu hình chat");
          }
        }}
      >
        Lưu giá chat
      </button>
      {chatConfig?.updatedBy ? (
        <p className="mt-2 text-[10px] text-[var(--play-muted)]">
          Cập nhật lần cuối: {chatConfig.updatedBy}
          {chatConfig.updatedAt
            ? ` · ${new Date(chatConfig.updatedAt).toLocaleString("vi-VN")}`
            : ""}
        </p>
      ) : null}
      {onMarkReport ? (
        <section className="mt-4 border-t border-[var(--wood-deep)]/12 pt-3">
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
      ) : null}
    </section>
  );
}
