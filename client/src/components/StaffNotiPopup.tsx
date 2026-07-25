import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  getStoredUser,
  isMainAdmin,
  isStaff,
  type AuthUser,
} from "../auth";

export type StaffNotiEntry = {
  id: string;
  at: number;
  byUserId: string;
  byName: string;
  title: string;
  body: string;
  pinned?: boolean;
};

export type StaffAuditEntry = {
  id: string;
  at: number;
  actorId: string;
  actorName: string;
  action: string;
  targetId?: string;
  targetName?: string;
  detail?: string;
};

const READ_KEY = "sofiaore_staff_noti_read_at";

function loadReadAt(): number {
  try {
    const n = Number(localStorage.getItem(READ_KEY) ?? 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function saveReadAt(at: number) {
  try {
    localStorage.setItem(READ_KEY, String(at));
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

interface StaffNotiPopupProps {
  user: AuthUser | null | undefined;
}

export function StaffNotiPopup({ user }: StaffNotiPopupProps) {
  const staffUser = user ?? getStoredUser();
  /** Mọi user đăng nhập đọc Noti; guest không hiện. */
  const canSee = !!staffUser;
  const canAudit = isStaff(staffUser);
  const canCompose = isMainAdmin(staffUser);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"noti" | "audit">("noti");
  const [notis, setNotis] = useState<StaffNotiEntry[]>([]);
  const [audits, setAudits] = useState<StaffAuditEntry[]>([]);
  const [readAt, setReadAt] = useState(loadReadAt);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const unread = useMemo(
    () => notis.filter((n) => n.at > readAt).length,
    [notis, readAt],
  );

  const loadNoti = useCallback(async () => {
    if (!canSee) return;
    try {
      const r = await api<{
        ok: true;
        entries: StaffNotiEntry[];
      }>("/api/staff/noti");
      setNotis(r.entries ?? []);
    } catch {
      /* keep previous */
    }
  }, [canSee]);

  const loadAudit = useCallback(async () => {
    if (!canAudit) return;
    try {
      const r = await api<{
        ok: true;
        entries: StaffAuditEntry[];
      }>("/api/staff/audit-feed");
      setAudits(r.entries ?? []);
    } catch {
      /* keep previous */
    }
  }, [canAudit]);

  useEffect(() => {
    if (!canSee) return;
    void loadNoti();
  }, [canSee, loadNoti]);

  useEffect(() => {
    if (!canAudit && tab === "audit") setTab("noti");
  }, [canAudit, tab]);

  useEffect(() => {
    if (!open) return;
    void loadNoti();
    if (tab === "audit" && canAudit) void loadAudit();
  }, [open, tab, loadNoti, loadAudit, canAudit]);

  useEffect(() => {
    if (!open || notis.length === 0) return;
    const latest = notis.reduce((m, n) => Math.max(m, n.at), 0);
    if (latest > readAt) {
      saveReadAt(latest);
      setReadAt(latest);
    }
  }, [open, notis, readAt]);

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

  const post = async (e: FormEvent) => {
    e.preventDefault();
    if (!canCompose || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ ok: true; entries: StaffNotiEntry[] }>(
        "/api/staff/noti",
        {
          method: "POST",
          body: JSON.stringify({ title, body }),
        },
      );
      setNotis(r.entries ?? []);
      setTitle("");
      setBody("");
      const latest = (r.entries ?? []).reduce((m, n) => Math.max(m, n.at), 0);
      if (latest > 0) {
        saveReadAt(latest);
        setReadAt(latest);
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Không đăng được");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!canCompose || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ ok: true; entries: StaffNotiEntry[] }>(
        `/api/staff/noti/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      setNotis(r.entries ?? []);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Không xóa được");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="staff-noti" ref={rootRef}>
      <button
        type="button"
        className={`staff-noti__trigger ${open ? "is-open" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Thông báo"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="staff-noti__trigger-label">Noti</span>
        {unread > 0 && (
          <span className="staff-noti__badge" aria-label={`${unread} chưa đọc`}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="staff-noti__panel"
          role="dialog"
          aria-label="Thông báo"
        >
          <div className="staff-noti__head">
            <p className="staff-noti__title">Thông báo</p>
            <button
              type="button"
              className="staff-noti__close"
              onClick={() => setOpen(false)}
            >
              Đóng
            </button>
          </div>

          {canAudit && (
            <div className="staff-noti__tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "noti"}
                className={`staff-noti__tab ${tab === "noti" ? "is-active" : ""}`}
                onClick={() => setTab("noti")}
              >
                Noti
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "audit"}
                className={`staff-noti__tab ${tab === "audit" ? "is-active" : ""}`}
                onClick={() => {
                  setTab("audit");
                  void loadAudit();
                }}
              >
                Nhật ký
              </button>
            </div>
          )}

          <div className="staff-noti__body">
            {tab === "noti" && (
              <>
                {canCompose && (
                  <form className="staff-noti__compose" onSubmit={post}>
                    <p className="staff-noti__compose-label">
                      Đăng thông báo cho mọi người chơi
                    </p>
                    <input
                      className="staff-noti__input"
                      placeholder="Tiêu đề"
                      value={title}
                      maxLength={80}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                    <textarea
                      className="staff-noti__textarea"
                      placeholder="Nội dung người chơi sẽ thấy…"
                      value={body}
                      maxLength={2000}
                      rows={3}
                      onChange={(e) => setBody(e.target.value)}
                      required
                    />
                    <button
                      type="submit"
                      className="staff-noti__submit"
                      disabled={busy}
                    >
                      {busy ? "Đang gửi…" : "Đăng Noti"}
                    </button>
                  </form>
                )}

                {err && <p className="staff-noti__err">{err}</p>}

                {notis.length === 0 ? (
                  <p className="staff-noti__empty">Chưa có thông báo</p>
                ) : (
                  <ul className="staff-noti__list">
                    {notis.map((n) => (
                      <li
                        key={n.id}
                        className={`staff-noti__card ${
                          n.at > readAt ? "is-new" : ""
                        }`}
                      >
                        <div className="staff-noti__card-top">
                          <span className="staff-noti__when">
                            {formatWhen(n.at)}
                          </span>
                          <span className="staff-noti__by">{n.byName}</span>
                          {canCompose && (
                            <button
                              type="button"
                              className="staff-noti__del"
                              disabled={busy}
                              onClick={() => void remove(n.id)}
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                        <p className="staff-noti__card-title">{n.title}</p>
                        <p className="staff-noti__card-body">{n.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {tab === "audit" && (
              <>
                {audits.length === 0 ? (
                  <p className="staff-noti__empty">Chưa có nhật ký</p>
                ) : (
                  <ul className="staff-noti__list">
                    {audits.map((a) => (
                      <li key={a.id} className="staff-noti__card staff-noti__card--audit">
                        <div className="staff-noti__card-top">
                          <span className="staff-noti__when">
                            {formatWhen(a.at)}
                          </span>
                          <span className="staff-noti__by">{a.actorName}</span>
                        </div>
                        <p className="staff-noti__card-title">{a.action}</p>
                        {(a.targetName || a.detail) && (
                          <p className="staff-noti__card-body">
                            {[a.targetName, a.detail].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
