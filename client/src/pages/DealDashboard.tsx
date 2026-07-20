import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { formatXu } from "../cards";
import { AppShell } from "../components/AppShell";
import {
  getStoredUser,
  getToken,
  playPath,
  saveSession,
  type AuthUser,
  api,
} from "../auth";

type LookupUser = {
  id: string;
  username: string;
  code: string;
  balance: number;
  role: string;
};

export default function DealDashboard() {
  const me = getStoredUser();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<LookupUser[]>([]);
  const [selected, setSelected] = useState<LookupUser | null>(null);
  const [delta, setDelta] = useState("100");
  const [guestCode, setGuestCode] = useState("");
  const [guestDelta, setGuestDelta] = useState("100");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async (e?: FormEvent) => {
    e?.preventDefault();
    const term = q.trim();
    if (!term) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ ok: true; users: LookupUser[] }>(
        `/api/deal/lookup?q=${encodeURIComponent(term)}`,
      );
      setHits(r.users);
      setSelected(r.users[0] ?? null);
      if (r.users.length === 0) setMsg("Không tìm thấy user");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi tra cứu");
    } finally {
      setBusy(false);
    }
  };

  const applyUserDelta = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setMsg("Chọn user trước");
      return;
    }
    const d = Number(delta);
    if (!Number.isFinite(d) || d === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ ok: true; user: AuthUser }>(
        "/api/admin/adjust-balance",
        {
          method: "POST",
          body: JSON.stringify({ userId: selected.id, delta: d }),
        },
      );
      setSelected((prev) =>
        prev && prev.id === r.user.id
          ? { ...prev, balance: r.user.balance }
          : prev,
      );
      setHits((rows) =>
        rows.map((u) =>
          u.id === r.user.id ? { ...u, balance: r.user.balance } : u,
        ),
      );
      if (me?.id === r.user.id) {
        const token = getToken();
        if (token) saveSession(token, r.user);
      }
      setMsg(
        `Đã cập nhật ${r.user.username} → ${formatXu(r.user.balance)} xu`,
      );
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi chỉnh xu");
    } finally {
      setBusy(false);
    }
  };

  const applyGuestDelta = async (e: FormEvent) => {
    e.preventDefault();
    const code = guestCode.trim().toUpperCase();
    const d = Number(guestDelta);
    if (!code || !Number.isFinite(d) || d === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{
        ok: true;
        balance: number;
        name: string;
        guestCode?: string;
      }>("/api/admin/guest/adjust-balance", {
        method: "POST",
        body: JSON.stringify({ guestCode: code, delta: d }),
      });
      setMsg(
        `Khách ${r.name}${r.guestCode ? ` (${r.guestCode})` : ""} → ${formatXu(r.balance)} xu`,
      );
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi khách (cần online bàn Tarot)");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-md px-4 py-6">
        <p className="play-heading text-lg">Deal — chỉnh xu</p>
        <p className="mt-1 text-xs text-[var(--play-muted)]">
          Chỉ cộng/trừ xu user và khách đang ở bàn Tarot.
        </p>
        {me && (
          <p className="mt-2 text-xs">
            Xin chào <span className="font-bold">{me.username}</span> ·{" "}
            <Link to={playPath(me)} className="text-[var(--wood-deep)] underline">
              Vào bàn chơi
            </Link>
          </p>
        )}

        {msg && (
          <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs text-[var(--play-ink)] ring-1 ring-black/10">
            {msg}
          </p>
        )}

        <section className="app-panel mt-4 p-3">
          <p className="play-heading text-sm">Tra cứu user</p>
          <form onSubmit={search} className="mt-2 flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Username hoặc ID"
              className="app-input flex-1"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-[var(--wood-deep)] px-3 text-xs font-bold text-white disabled:opacity-50"
            >
              Tìm
            </button>
          </form>
          {hits.length > 0 && (
            <select
              value={selected?.id ?? ""}
              onChange={(e) => {
                const u = hits.find((h) => h.id === e.target.value);
                setSelected(u ?? null);
              }}
              className="app-input mt-2"
            >
              {hits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} · ID {u.code} ({formatXu(u.balance)} xu)
                </option>
              ))}
            </select>
          )}
          <form onSubmit={applyUserDelta} className="mt-2 flex gap-2">
            <input
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="Delta (+/-)"
              className="app-input flex-1"
            />
            <button
              type="submit"
              disabled={busy || !selected}
              className="rounded-xl bg-[var(--gold)] px-3 text-xs font-bold text-[#1a1208] disabled:opacity-50"
            >
              Cập nhật
            </button>
          </form>
        </section>

        <section className="app-panel mt-4 p-3">
          <p className="play-heading text-sm">Khách Tarot (guest code)</p>
          <form onSubmit={applyGuestDelta} className="mt-2 space-y-2">
            <input
              value={guestCode}
              onChange={(e) => setGuestCode(e.target.value)}
              placeholder="GXXXXXXX"
              className="app-input w-full"
            />
            <div className="flex gap-2">
              <input
                value={guestDelta}
                onChange={(e) => setGuestDelta(e.target.value)}
                placeholder="Delta"
                className="app-input flex-1"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-[var(--wood-deep)] px-3 text-xs font-bold text-white disabled:opacity-50"
              >
                Cập nhật
              </button>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
