import { FormEvent, useState } from "react";
import { api } from "../../../auth";

export type InviteRow = {
  code: string;
  maxUses: number;
  usedCount: number;
  enabled: boolean;
  note?: string;
  createdAt: number;
  createdBy: string;
};

export function InvitesAdminPanel({
  requireInvite,
  invites,
  onMsg,
  onReload,
}: {
  requireInvite?: boolean;
  invites: InviteRow[];
  onMsg: (s: string) => void;
  onReload: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ code: "", maxUses: "10", note: "" });

  const setRequireMode = async (enabled: boolean) => {
    setBusy(true);
    try {
      await api("/api/mainadmin/invites/require", {
        method: "POST",
        body: JSON.stringify({ enabled }),
      });
      onMsg(
        enabled
          ? "Đã BẬT bắt buộc mã thành viên khi đăng ký"
          : "Đã TẮT — đăng ký không cần mã mời",
      );
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi chế độ mã mời");
    } finally {
      setBusy(false);
    }
  };

  const randomCode = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 8; i++) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    setForm((f) => ({ ...f, code: out }));
  };

  const createInvite = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ ok: true; invite: InviteRow }>(
        "/api/mainadmin/invites",
        {
          method: "POST",
          body: JSON.stringify({
            code: form.code.trim() || undefined,
            maxUses: Number(form.maxUses),
            note: form.note.trim() || undefined,
          }),
        },
      );
      onMsg(`Đã tạo mã thành viên ${r.invite.code}`);
      setForm({ code: "", maxUses: "10", note: "" });
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi mã thành viên");
    } finally {
      setBusy(false);
    }
  };

  const toggleInvite = async (code: string, enabled: boolean) => {
    setBusy(true);
    try {
      await api("/api/mainadmin/invites/toggle", {
        method: "POST",
        body: JSON.stringify({ code, enabled }),
      });
      onMsg(enabled ? `Đã bật ${code}` : `Đã tắt ${code}`);
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi toggle mã");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="app-panel mt-4 border-2 border-[var(--wood-deep)]/25 p-3 sm:p-4">
        <p className="play-heading text-sm sm:text-base">
          Đăng ký · mã thành viên 8 ký tự
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--play-muted)]">
          Mainadmin / Eco bật–tắt tại đây.{" "}
          <strong className="text-[var(--play-ink)]">Bắt buộc</strong> =
          form đăng ký bắt nhập mã 8 ký tự.{" "}
          <strong className="text-[var(--play-ink)]">Tắt</strong> = đăng ký
          mở, không cần mã (vẫn tạo mã bên dưới để phát tay).
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void setRequireMode(true)}
            className={`min-w-[8.5rem] rounded-xl px-3 py-2.5 text-xs font-bold disabled:opacity-50 ${
              requireInvite !== false
                ? "bg-[var(--wood-deep)] text-[var(--gold-soft)] ring-2 ring-[var(--gold)]/50"
                : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
            }`}
          >
            Bắt buộc mã 8 ký tự
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void setRequireMode(false)}
            className={`min-w-[8.5rem] rounded-xl px-3 py-2.5 text-xs font-bold disabled:opacity-50 ${
              requireInvite === false
                ? "bg-emerald-700 text-white ring-2 ring-emerald-400/60"
                : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
            }`}
          >
            Tắt — đăng ký mở
          </button>
        </div>
        <p
          className={`mt-3 rounded-lg px-2.5 py-2 text-[11px] font-bold ${
            requireInvite !== false
              ? "bg-amber-50 text-amber-950 ring-1 ring-amber-200"
              : "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200"
          }`}
        >
          Trạng thái live:{" "}
          {requireInvite !== false
            ? "ĐANG bắt buộc mã thành viên khi đăng ký"
            : "Đăng ký MỞ — không bắt mã"}
        </p>
      </section>

      <section className="app-panel mt-4 p-3">
        <p className="play-heading text-sm">Tạo mã thành viên</p>
        <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
          Đúng 8 ký tự (A–Z / 0–9). Để trống mã → hệ thống random. Mỗi mã
          dùng được nhiều lần tới max.
        </p>
        <form onSubmit={(e) => void createInvite(e)} className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              value={form.code}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  code: e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 8),
                }))
              }
              placeholder="Mã 8 ký tự (tuỳ chọn)"
              maxLength={8}
              spellCheck={false}
              className="app-input !py-1.5 font-mono text-xs uppercase"
            />
            <button
              type="button"
              onClick={randomCode}
              disabled={busy}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20 disabled:opacity-45"
            >
              Random
            </button>
            <input
              value={form.maxUses}
              onChange={(e) =>
                setForm((f) => ({ ...f, maxUses: e.target.value }))
              }
              placeholder="Max lần dùng"
              type="number"
              min={1}
              max={1_000_000}
              className="app-input !w-28 !py-1.5 text-xs"
              required
            />
          </div>
          <input
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="Ghi chú (tuỳ chọn)"
            className="app-input !py-1.5 text-xs"
          />
          <button
            type="submit"
            disabled={busy || !form.maxUses.trim()}
            className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-45"
          >
            Tạo mã
          </button>
        </form>
      </section>

      <section className="app-panel mt-4 p-3">
        <p className="play-heading text-sm">Danh sách mã thành viên</p>
        <ul className="mt-3 space-y-2">
          {invites.length === 0 ? (
            <li className="text-xs text-[var(--play-muted)]">
              Chưa có mã — tạo mã trước khi mở đăng ký
            </li>
          ) : (
            invites.map((inv) => {
              const exhausted = inv.usedCount >= inv.maxUses;
              return (
                <li
                  key={inv.code}
                  className="rounded-lg bg-white/80 px-3 py-2 text-xs ring-1 ring-[var(--wood-deep)]/10"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold tracking-wide text-[var(--play-ink)]">
                        {inv.code}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
                        {inv.usedCount}/{inv.maxUses} lần
                        {exhausted ? " · hết lượt" : ""}
                        {inv.note ? ` · ${inv.note}` : ""}
                        {inv.createdBy ? ` · bởi ${inv.createdBy}` : ""}
                        {" · "}
                        {new Date(inv.createdAt).toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          inv.enabled && !exhausted
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {inv.enabled ? (exhausted ? "Hết" : "Bật") : "Tắt"}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleInvite(inv.code, !inv.enabled)}
                        className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20 disabled:opacity-45"
                      >
                        {inv.enabled ? "Tắt" : "Bật"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </>
  );
}
