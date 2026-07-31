import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, getStoredUser, type AuthUser } from "../auth";

export type MessMessage = {
  id: string;
  at: number;
  by: "user" | "staff";
  byUserId: string;
  byName: string;
  body?: string;
  imageUrl?: string;
};

export type MessThread = {
  id: string;
  userId: string;
  userName: string;
  userCode?: string;
  at: number;
  updatedAt: number;
  userReadAt: number;
  staffReadAt: number;
  messages: MessMessage[];
};

const READ_KEY = "sofiaore_mess_user_read_at";

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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Không đọc được ảnh"));
    reader.readAsDataURL(file);
  });
}

export function MessPopup({
  user,
}: {
  user: AuthUser | null | undefined;
}) {
  const me = user ?? getStoredUser();
  const canSee = !!me;
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<MessThread | null>(null);
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [readAt, setReadAt] = useState(loadReadAt);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (opts?: { markRead?: boolean }) => {
      if (!me) return;
      try {
        const qs = opts?.markRead ? "?markRead=1" : "";
        const r = await api<{
          ok: true;
          thread: MessThread;
          unreadStaff?: number;
        }>(`/api/mess/mine${qs}`);
        setThread(r.thread);
        if (opts?.markRead) {
          const lastStaff = [...(r.thread.messages ?? [])]
            .reverse()
            .find((m) => m.by === "staff");
          if (lastStaff) {
            saveReadAt(lastStaff.at);
            setReadAt(lastStaff.at);
          } else {
            const now = Date.now();
            saveReadAt(now);
            setReadAt(now);
          }
        }
      } catch (ex) {
        setErr(ex instanceof Error ? ex.message : "Không tải Mess");
      }
    },
    [me],
  );

  useEffect(() => {
    if (!canSee) return;
    void load();
    const t = window.setInterval(() => void load(), 45_000);
    return () => window.clearInterval(t);
  }, [canSee, load]);

  useEffect(() => {
    if (!open) return;
    void load({ markRead: true });
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const unread = useMemo(() => {
    if (!thread) return 0;
    return thread.messages.filter((m) => m.by === "staff" && m.at > readAt)
      .length;
  }, [thread, readAt]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!me || busy) return;
    if (!body.trim() && !preview) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ ok: true; thread: MessThread }>(
        "/api/mess/mine/message",
        {
          method: "POST",
          body: JSON.stringify({
            body: body.trim(),
            dataUrl: preview || undefined,
          }),
        },
      );
      setThread(r.thread);
      setBody("");
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Không gửi được");
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > 900_000) {
      setErr("Ảnh tối đa ~900KB");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setPreview(dataUrl);
      setErr(null);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Lỗi ảnh");
    }
  };

  if (!canSee) return null;

  return (
    <div className={`mess-pop${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className={`mess-pop__trigger ${open ? "is-open" : ""}`}
        aria-expanded={open}
        title="Mess · gửi tin / ảnh cho mainadmin"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Mess</span>
        {unread > 0 ? (
          <span className="mess-pop__badge" aria-label={`${unread} chưa đọc`}>
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="mess-pop__panel" role="dialog" aria-label="Mess">
          <div className="mess-pop__head">
            <p className="mess-pop__title">Mess → Mainadmin</p>
            <button
              type="button"
              className="mess-pop__x"
              onClick={() => setOpen(false)}
            >
              Đóng
            </button>
          </div>
          <div className="mess-pop__thread">
            {(thread?.messages ?? []).length === 0 ? (
              <p className="mess-pop__empty">
                Gửi tin hoặc ảnh — mainadmin sẽ trả lời tại đây.
              </p>
            ) : (
              thread!.messages.map((m) => (
                <div
                  key={m.id}
                  className={`mess-pop__bubble ${m.by === "user" ? "me" : "them"}`}
                >
                  <span className="mess-pop__meta">
                    {m.byName} · {formatWhen(m.at)}
                  </span>
                  {m.body ? <p>{m.body}</p> : null}
                  {m.imageUrl ? (
                    <a href={m.imageUrl} target="_blank" rel="noreferrer">
                      <img src={m.imageUrl} alt="" className="mess-pop__img" />
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </div>
          {err ? <p className="mess-pop__err">{err}</p> : null}
          {preview ? (
            <div className="mess-pop__preview">
              <img src={preview} alt="" />
              <button type="button" onClick={() => setPreview(null)}>
                Bỏ ảnh
              </button>
            </div>
          ) : null}
          <form className="mess-pop__form" onSubmit={(e) => void send(e)}>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              id="mess-file"
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            />
            <label htmlFor="mess-file" className="mess-pop__attach">
              Ảnh
            </label>
            <input
              className="mess-pop__input"
              value={body}
              maxLength={1500}
              placeholder="Nhắn mainadmin…"
              onChange={(e) => setBody(e.target.value)}
            />
            <button
              type="submit"
              className="mess-pop__send"
              disabled={busy || (!body.trim() && !preview)}
            >
              Gửi
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
