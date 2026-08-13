import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../auth";
import type { MessThread } from "./MessPopup";

export function MessAdminPanel({
  onMsg,
  onUnread,
}: {
  onMsg: (s: string) => void;
  onUnread?: (n: number) => void;
}) {
  const [threads, setThreads] = useState<MessThread[]>([]);
  const [unread, setUnread] = useState(0);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const qs = new URLSearchParams({ q: query.trim() });
      const r = await api<{
        ok: true;
        unreadCount: number;
        threads: MessThread[];
      }>(`/api/mainadmin/mess?${qs.toString()}`);
      setThreads(r.threads ?? []);
      setUnread(r.unreadCount ?? 0);
      onUnread?.(r.unreadCount ?? 0);
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi tải Mess");
    } finally {
      setBusy(false);
    }
  }, [query, onMsg, onUnread]);

  useEffect(() => {
    void load();
  }, [load]);

  const openThread = async (id: string) => {
    setActiveId(id);
    setReply("");
    setPreview(null);
    try {
      const r = await api<{ ok: true; thread: MessThread }>(
        `/api/mainadmin/mess/${encodeURIComponent(id)}`,
      );
      setThreads((prev) =>
        prev.map((t) => (t.id === r.thread.id ? r.thread : t)),
      );
      await load();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi mở Mess");
    }
  };

  const replyMess = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeId || busy) return;
    if (!reply.trim() && !preview) return;
    setBusy(true);
    try {
      const r = await api<{ ok: true; thread: MessThread }>(
        `/api/mainadmin/mess/${encodeURIComponent(activeId)}/message`,
        {
          method: "POST",
          body: JSON.stringify({
            body: reply.trim(),
            dataUrl: preview || undefined,
          }),
        },
      );
      setThreads((prev) =>
        prev.map((t) => (t.id === r.thread.id ? r.thread : t)),
      );
      setReply("");
      setPreview(null);
      onMsg("Đã trả lời Mess");
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi gửi Mess");
    } finally {
      setBusy(false);
    }
  };

  const active = threads.find((t) => t.id === activeId);

  return (
    <section className="app-panel mt-4 space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="play-heading text-sm">Mess</p>
          <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
            Tin / ảnh 1–1 · staff_dashboard / mainadmin · chưa đọc: {unread}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/20 disabled:opacity-45"
        >
          Làm mới
        </button>
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Lọc user / mã…"
        className="app-input w-full !py-1.5 text-xs"
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto">
          {threads.length === 0 ? (
            <li className="rounded-lg bg-white/70 px-2.5 py-3 text-[11px] text-[var(--play-muted)]">
              {busy ? "Đang tải…" : "Chưa có Mess."}
            </li>
          ) : (
            threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => void openThread(t.id)}
                  className={`w-full rounded-lg px-2.5 py-2 text-left text-[11px] ring-1 ${
                    activeId === t.id
                      ? "bg-[var(--wood-deep)] text-[var(--cream)]"
                      : "bg-white/75 ring-[var(--wood-deep)]/10"
                  }`}
                >
                  <p className="font-bold">{t.userName}</p>
                  <p className="opacity-80">
                    {t.userCode ?? t.userId} ·{" "}
                    {new Date(t.updatedAt).toLocaleString("vi-VN")} ·{" "}
                    {t.messages.length} tin
                  </p>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="rounded-lg bg-white/75 p-3 ring-1 ring-[var(--wood-deep)]/10">
          {!active ? (
            <p className="text-[11px] text-[var(--play-muted)]">
              Chọn hội thoại để trả lời.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="play-heading text-sm">
                {active.userName}
                {active.userCode ? ` · ${active.userCode}` : ""}
              </p>
              <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                {active.messages.map((m) => (
                  <li
                    key={m.id}
                    className={`rounded-md px-2 py-1.5 text-[11px] ${
                      m.by === "staff"
                        ? "bg-[var(--wood-deep)]/10"
                        : "bg-white ring-1 ring-[var(--wood-deep)]/8"
                    }`}
                  >
                    <p className="text-[9px] font-bold uppercase opacity-60">
                      {m.byName} · {new Date(m.at).toLocaleString("vi-VN")}
                    </p>
                    {m.body ? <p className="mt-0.5">{m.body}</p> : null}
                    {m.imageUrl ? (
                      <a href={m.imageUrl} target="_blank" rel="noreferrer">
                        <img
                          src={m.imageUrl}
                          alt=""
                          className="mt-1 max-h-32 rounded-md"
                        />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
              {preview ? (
                <div className="flex items-center gap-2">
                  <img
                    src={preview}
                    alt=""
                    className="h-14 w-14 rounded object-cover"
                  />
                  <button
                    type="button"
                    className="text-[10px] font-bold"
                    onClick={() => setPreview(null)}
                  >
                    Bỏ ảnh
                  </button>
                </div>
              ) : null}
              <form
                className="flex flex-wrap gap-1.5"
                onSubmit={(e) => void replyMess(e)}
              >
                <label className="rounded-full bg-white px-2.5 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15">
                  Ảnh
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const reader = new FileReader();
                      reader.onload = () =>
                        setPreview(String(reader.result ?? ""));
                      reader.readAsDataURL(f);
                    }}
                  />
                </label>
                <input
                  className="app-input min-w-0 flex-1 !py-1.5 text-xs"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Trả lời…"
                  maxLength={1500}
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-45"
                >
                  Gửi
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
