import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, getStoredUser, type AuthUser } from "../auth";
import { brandLsGet, brandLsSet } from "../brand";

export type FeedbackKind = "report" | "suggest" | "contact";
export type FeedbackStatus = "open" | "replied" | "closed";

export type FeedbackMessage = {
  id: string;
  at: number;
  by: "user" | "staff";
  byUserId: string;
  byName: string;
  body: string;
};

export type FeedbackTicket = {
  id: string;
  at: number;
  updatedAt: number;
  kind: FeedbackKind;
  status: FeedbackStatus;
  userId: string;
  userName: string;
  userCode?: string;
  subject: string;
  messages: FeedbackMessage[];
};

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

const READ_MAP_KEY = "sofia_feedback_read_map";

function loadReadMap(): Record<string, number> {
  try {
    const raw = brandLsGet(READ_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveReadMap(map: Record<string, number>) {
  try {
    brandLsSet(READ_MAP_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function formatWhen(at: number): string {
  try {
    return new Date(at).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function lastStaffAt(t: FeedbackTicket): number {
  let max = 0;
  for (const m of t.messages) {
    if (m.by === "staff" && m.at > max) max = m.at;
  }
  return max;
}

interface FeedbackPopupProps {
  user: AuthUser | null | undefined;
}

export function FeedbackPopup({ user }: FeedbackPopupProps) {
  const me = user ?? getStoredUser();
  const canSee = !!me;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"compose" | "inbox">("compose");
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [readMap, setReadMap] = useState(loadReadMap);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [kind, setKind] = useState<FeedbackKind>("suggest");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => tickets.find((t) => t.id === activeId) ?? null,
    [tickets, activeId],
  );

  const unread = useMemo(() => {
    let n = 0;
    for (const t of tickets) {
      const staffAt = lastStaffAt(t);
      if (staffAt <= 0) continue;
      const seen = readMap[t.id] ?? 0;
      if (staffAt > seen) n += 1;
    }
    return n;
  }, [tickets, readMap]);

  const loadMine = useCallback(async () => {
    if (!canSee) return;
    try {
      const r = await api<{ ok: true; tickets: FeedbackTicket[] }>(
        "/api/feedback/mine",
      );
      setTickets(r.tickets ?? []);
    } catch {
      /* keep */
    }
  }, [canSee]);

  useEffect(() => {
    if (!canSee) return;
    void loadMine();
  }, [canSee, loadMine]);

  useEffect(() => {
    if (!open) return;
    void loadMine();
  }, [open, loadMine]);

  useEffect(() => {
    if (!open || !active) return;
    const staffAt = lastStaffAt(active);
    if (staffAt <= 0) return;
    setReadMap((prev) => {
      const cur = prev[active.id] ?? 0;
      if (staffAt <= cur) return prev;
      const next = { ...prev, [active.id]: staffAt };
      saveReadMap(next);
      return next;
    });
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!canSee) return null;

  const submitNew = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ ok: true; ticket: FeedbackTicket }>("/api/feedback", {
        method: "POST",
        body: JSON.stringify({ kind, subject, body }),
      });
      setTickets((prev) => [r.ticket, ...prev.filter((t) => t.id !== r.ticket.id)]);
      setSubject("");
      setBody("");
      setTab("inbox");
      setActiveId(r.ticket.id);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Không gửi được");
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!active || busy || active.status === "closed") return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ ok: true; ticket: FeedbackTicket }>(
        `/api/feedback/${encodeURIComponent(active.id)}/message`,
        {
          method: "POST",
          body: JSON.stringify({ body: reply }),
        },
      );
      setTickets((prev) =>
        prev.map((t) => (t.id === r.ticket.id ? r.ticket : t)),
      );
      setReply("");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Không gửi được");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`feedback-noti${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className={`feedback-noti__trigger ${open ? "is-open" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Góp ý / Liên hệ mainadmin"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="feedback-noti__trigger-label">Góp ý</span>
        {unread > 0 && (
          <span className="feedback-noti__badge" aria-label={`${unread} chưa đọc`}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="feedback-noti__panel"
          role="dialog"
          aria-label="Góp ý liên hệ"
        >
          <div className="feedback-noti__head">
            <p className="feedback-noti__title">Góp ý / Liên hệ</p>
            <button
              type="button"
              className="feedback-noti__close"
              onClick={() => setOpen(false)}
            >
              Đóng
            </button>
          </div>

          <div className="feedback-noti__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "compose"}
              className={`feedback-noti__tab ${tab === "compose" ? "is-active" : ""}`}
              onClick={() => {
                setTab("compose");
                setActiveId(null);
              }}
            >
              Gửi mới
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "inbox"}
              className={`feedback-noti__tab ${tab === "inbox" ? "is-active" : ""}`}
              onClick={() => setTab("inbox")}
            >
              Hộp thư{unread > 0 ? ` (${unread})` : ""}
            </button>
          </div>

          <div className="feedback-noti__body">
            {err && <p className="feedback-noti__err">{err}</p>}

            {tab === "compose" && (
              <form className="feedback-noti__compose" onSubmit={submitNew}>
                <p className="feedback-noti__compose-label">Gửi tới mainadmin</p>
                <div className="feedback-noti__kinds">
                  {(Object.keys(KIND_LABEL) as FeedbackKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      className={`feedback-noti__kind ${kind === k ? "is-active" : ""}`}
                      onClick={() => setKind(k)}
                    >
                      {KIND_LABEL[k]}
                    </button>
                  ))}
                </div>
                <input
                  className="feedback-noti__input"
                  placeholder="Tiêu đề"
                  value={subject}
                  maxLength={80}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
                <textarea
                  className="feedback-noti__textarea"
                  placeholder="Nội dung báo cáo / đề xuất / liên hệ…"
                  value={body}
                  maxLength={2000}
                  rows={4}
                  onChange={(e) => setBody(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  className="feedback-noti__submit"
                  disabled={busy}
                >
                  {busy ? "Đang gửi…" : "Gửi góp ý"}
                </button>
              </form>
            )}

            {tab === "inbox" && !active && (
              <>
                {tickets.length === 0 ? (
                  <p className="feedback-noti__empty">Chưa có góp ý nào</p>
                ) : (
                  <ul className="feedback-noti__list">
                    {tickets.map((t) => {
                      const staffAt = lastStaffAt(t);
                      const isNew =
                        staffAt > 0 && staffAt > (readMap[t.id] ?? 0);
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            className={`feedback-noti__card feedback-noti__card--btn ${
                              isNew ? "is-new" : ""
                            }`}
                            onClick={() => setActiveId(t.id)}
                          >
                            <div className="feedback-noti__card-top">
                              <span className="feedback-noti__when">
                                {formatWhen(t.updatedAt)}
                              </span>
                              <span className="feedback-noti__chip">
                                {KIND_LABEL[t.kind]}
                              </span>
                              <span className="feedback-noti__chip feedback-noti__chip--status">
                                {STATUS_LABEL[t.status]}
                              </span>
                            </div>
                            <p className="feedback-noti__card-title">{t.subject}</p>
                            <p className="feedback-noti__card-body">
                              {t.messages[t.messages.length - 1]?.body ?? ""}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}

            {tab === "inbox" && active && (
              <div className="feedback-noti__thread">
                <button
                  type="button"
                  className="feedback-noti__back"
                  onClick={() => setActiveId(null)}
                >
                  ← Danh sách
                </button>
                <div className="feedback-noti__card-top">
                  <span className="feedback-noti__chip">
                    {KIND_LABEL[active.kind]}
                  </span>
                  <span className="feedback-noti__chip feedback-noti__chip--status">
                    {STATUS_LABEL[active.status]}
                  </span>
                </div>
                <p className="feedback-noti__card-title">{active.subject}</p>
                <ul className="feedback-noti__msgs">
                  {active.messages.map((m) => (
                    <li
                      key={m.id}
                      className={`feedback-noti__msg ${
                        m.by === "staff" ? "is-staff" : "is-user"
                      }`}
                    >
                      <div className="feedback-noti__card-top">
                        <span className="feedback-noti__by">
                          {m.by === "staff" ? "Mainadmin" : m.byName}
                        </span>
                        <span className="feedback-noti__when">
                          {formatWhen(m.at)}
                        </span>
                      </div>
                      <p className="feedback-noti__card-body">{m.body}</p>
                    </li>
                  ))}
                </ul>
                {active.status === "closed" ? (
                  <p className="feedback-noti__empty">
                    Ticket đã đóng — tạo góp ý mới nếu cần.
                  </p>
                ) : (
                  <form className="feedback-noti__compose" onSubmit={sendReply}>
                    <textarea
                      className="feedback-noti__textarea"
                      placeholder="Trả lời thêm…"
                      value={reply}
                      maxLength={2000}
                      rows={3}
                      onChange={(e) => setReply(e.target.value)}
                      required
                    />
                    <button
                      type="submit"
                      className="feedback-noti__submit"
                      disabled={busy}
                    >
                      {busy ? "Đang gửi…" : "Gửi tin"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
