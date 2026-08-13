import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../auth";
import type {
  FeedbackKind,
  FeedbackStatus,
  FeedbackTicket,
} from "./FeedbackPopup";

const KIND_LABEL: Record<FeedbackKind, string> = {
  report: "Báo cáo",
  suggest: "Đề xuất",
  contact: "Liên hệ",
};

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  open: "Mở",
  replied: "Đã trả lời",
  closed: "Đóng",
};

export function FeedbackAdminPanel({
  onMsg,
  onOpenCount,
}: {
  onMsg: (s: string) => void;
  onOpenCount?: (n: number) => void;
}) {
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">(
    "all",
  );
  const [kindFilter, setKindFilter] = useState<FeedbackKind | "all">("all");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const qs = new URLSearchParams({
        status: statusFilter,
        kind: kindFilter,
        q: query.trim(),
      });
      const r = await api<{
        ok: true;
        openCount: number;
        tickets: FeedbackTicket[];
      }>(`/api/mainadmin/feedback?${qs.toString()}`);
      setTickets(r.tickets ?? []);
      setOpenCount(r.openCount ?? 0);
      onOpenCount?.(r.openCount ?? 0);
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi tải Feedback");
    } finally {
      setBusy(false);
    }
  }, [statusFilter, kindFilter, query, onMsg, onOpenCount]);

  useEffect(() => {
    void load();
  }, [load]);

  const replyTicket = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeId || busy) return;
    setBusy(true);
    try {
      const r = await api<{ ok: true; ticket: FeedbackTicket }>(
        `/api/feedback/${encodeURIComponent(activeId)}/message`,
        {
          method: "POST",
          body: JSON.stringify({ body: reply }),
        },
      );
      setTickets((prev) =>
        prev.map((t) => (t.id === r.ticket.id ? r.ticket : t)),
      );
      setReply("");
      onMsg("Đã trả lời góp ý");
      await load();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi trả lời");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: FeedbackStatus) => {
    setBusy(true);
    try {
      const r = await api<{ ok: true; ticket: FeedbackTicket }>(
        `/api/mainadmin/feedback/${encodeURIComponent(id)}/status`,
        {
          method: "POST",
          body: JSON.stringify({ status }),
        },
      );
      setTickets((prev) =>
        prev.map((t) => (t.id === r.ticket.id ? r.ticket : t)),
      );
      onMsg(`Đã đặt trạng thái: ${STATUS_LABEL[status]}`);
      await load();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi cập nhật trạng thái");
    } finally {
      setBusy(false);
    }
  };

  const active = tickets.find((t) => t.id === activeId);

  return (
    <section className="app-panel mt-4 space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="play-heading text-sm">Feedback / Liên hệ</p>
          <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
            Inbox góp ý · staff_dashboard / mainadmin · Open: {openCount}.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20 disabled:opacity-45"
        >
          Làm mới
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as FeedbackStatus | "all")
          }
          className="app-input !w-auto !py-1.5 text-xs"
        >
          <option value="all">Mọi trạng thái</option>
          <option value="open">Mở</option>
          <option value="replied">Đã trả lời</option>
          <option value="closed">Đóng</option>
        </select>
        <select
          value={kindFilter}
          onChange={(e) =>
            setKindFilter(e.target.value as FeedbackKind | "all")
          }
          className="app-input !w-auto !py-1.5 text-xs"
        >
          <option value="all">Mọi loại</option>
          <option value="report">Báo cáo</option>
          <option value="suggest">Đề xuất</option>
          <option value="contact">Liên hệ</option>
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Lọc user / mã / tiêu đề…"
          className="app-input min-w-[10rem] flex-1 !py-1.5 text-xs"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto">
          {tickets.length === 0 ? (
            <li className="rounded-lg bg-white/70 px-2.5 py-3 text-[11px] text-[var(--play-muted)] ring-1 ring-[var(--wood-deep)]/10">
              {busy ? "Đang tải…" : "Không có ticket khớp bộ lọc."}
            </li>
          ) : (
            tickets.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(t.id);
                    setReply("");
                  }}
                  className={`w-full rounded-lg px-2.5 py-2 text-left text-[11px] ring-1 ${
                    activeId === t.id
                      ? "bg-[var(--wood-deep)] text-[var(--cream)] ring-[var(--wood-deep)]"
                      : "bg-white/75 text-[var(--play-ink)] ring-[var(--wood-deep)]/10"
                  }`}
                >
                  <p className="font-bold">
                    {t.subject}{" "}
                    <span className="font-normal opacity-80">
                      · {KIND_LABEL[t.kind]} · {STATUS_LABEL[t.status]}
                    </span>
                  </p>
                  <p className="mt-0.5 opacity-80">
                    {t.userName}
                    {t.userCode ? ` · ${t.userCode}` : ""} ·{" "}
                    {new Date(t.updatedAt).toLocaleString("vi-VN")}
                  </p>
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="rounded-lg bg-white/75 p-3 ring-1 ring-[var(--wood-deep)]/10">
          {!active ? (
            <p className="text-[11px] text-[var(--play-muted)]">
              Chọn một ticket để xem thread và trả lời.
            </p>
          ) : (
            <div className="space-y-2">
              <div>
                <p className="play-heading text-sm">{active.subject}</p>
                <p className="text-[10px] text-[var(--play-muted)]">
                  {KIND_LABEL[active.kind]} · {STATUS_LABEL[active.status]} ·{" "}
                  {active.userName}
                  {active.userCode ? ` · ${active.userCode}` : ""}
                </p>
              </div>
              <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                {active.messages.map((m) => (
                  <li
                    key={m.id}
                    className={`rounded-lg px-2 py-1.5 text-[11px] ring-1 ${
                      m.by === "staff"
                        ? "bg-sky-50 ring-sky-200/80"
                        : "bg-white ring-[var(--wood-deep)]/10"
                    }`}
                  >
                    <p className="text-[10px] font-bold text-[var(--play-muted)]">
                      {m.by === "staff" ? "Staff" : m.byName} ·{" "}
                      {new Date(m.at).toLocaleString("vi-VN")}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-[var(--play-ink)]">
                      {m.body}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-1.5">
                {active.status !== "closed" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setStatus(active.id, "closed")}
                    className="rounded-full bg-rose-800 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-45"
                  >
                    Đóng ticket
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setStatus(active.id, "open")}
                    className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-[10px] font-bold text-[var(--cream)] disabled:opacity-45"
                  >
                    Mở lại
                  </button>
                )}
              </div>
              {active.status !== "closed" ? (
                <form onSubmit={(e) => void replyTicket(e)} className="space-y-1.5">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    required
                    placeholder="Trả lời người chơi…"
                    className="app-input w-full text-xs"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-full bg-[var(--wood-deep)] px-4 py-2 text-xs font-bold text-[var(--cream)] disabled:opacity-45"
                  >
                    {busy ? "Đang gửi…" : "Gửi trả lời"}
                  </button>
                </form>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
