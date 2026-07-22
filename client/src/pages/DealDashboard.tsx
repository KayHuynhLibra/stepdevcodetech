import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatXu } from "../cards";
import { AppShell } from "../components/AppShell";
import { IdentityBadge } from "../components/IdentityBadge";
import {
  api,
  clearSession,
  getStoredUser,
  getToken,
  homePath,
  isBalanceOperator,
  playPath,
  saveSession,
  type AuthUser,
} from "../auth";

type LookupUser = {
  id: string;
  username: string;
  code: string;
  balance: number;
  role: string;
};

/**
 * Dashboard Deal — chỉ cộng/trừ xu ảo (không Inter / không staff full).
 */
export default function DealDashboard() {
  const nav = useNavigate();
  const [me, setMe] = useState<AuthUser | null>(() => getStoredUser());
  const [bootErr, setBootErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<LookupUser[]>([]);
  const [selected, setSelected] = useState<LookupUser | null>(null);
  const [delta, setDelta] = useState("100");
  const [guestCode, setGuestCode] = useState("");
  const [guestDelta, setGuestDelta] = useState("100");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const logout = () => {
    clearSession();
    nav("/login", { replace: true });
  };

  const refreshMe = useCallback(async () => {
    try {
      const r = await api<{ ok: true; user: AuthUser }>("/api/auth/me");
      if (r.user.role !== "deal" && !isBalanceOperator(r.user)) {
        nav(homePath(r.user), { replace: true });
        return;
      }
      if (r.user.role !== "deal") {
        // admin/main có balance_ops nhưng home khác — chỉ deal dùng trang này
        nav(homePath(r.user), { replace: true });
        return;
      }
      setMe(r.user);
      const token = getToken();
      if (token) saveSession(token, r.user);
      setBootErr(null);
    } catch (e) {
      setBootErr(e instanceof Error ? e.message : "Không tải được phiên");
      clearSession();
      nav("/login", { replace: true });
    }
  }, [nav]);

  useEffect(() => {
    if (!getToken()) {
      nav("/login", { replace: true });
      return;
    }
    void refreshMe();
  }, [nav, refreshMe]);

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
      if (r.users.length === 0) setMsg("Không tìm thấy người chơi");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi tra cứu");
    } finally {
      setBusy(false);
    }
  };

  const applyUserDelta = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setMsg("Chọn người chơi trước");
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
        setMe(r.user);
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
      setMsg(
        err instanceof Error
          ? err.message
          : "Lỗi khách (cần đang online bàn Tarot)",
      );
    } finally {
      setBusy(false);
    }
  };

  if (bootErr) {
    return (
      <AppShell center>
        <p className="text-sm text-red-600">{bootErr}</p>
        <button type="button" className="app-btn-primary mt-3" onClick={logout}>
          Đăng nhập lại
        </button>
      </AppShell>
    );
  }

  if (!me) {
    return (
      <AppShell center>
        <p className="text-sm text-[var(--play-muted)]">Đang tải Deal…</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth="md">
      <header className="admin-header">
        <div className="admin-header__bar">
          <p className="admin-header__title">Deal</p>
          <button
            type="button"
            onClick={logout}
            className="app-btn-ghost admin-header__exit"
          >
            Thoát
          </button>
        </div>
        <IdentityBadge user={me} showPath={false} />
      </header>

      <p className="play-heading mt-3 text-lg">Deal — chỉnh xu ảo</p>
      <p className="mt-1 text-xs text-[var(--play-muted)]">
        Chỉ cộng/trừ xu (điểm giải trí). Không đụng Inter / kho / IP.
      </p>
      <p className="mt-2 text-xs">
        <Link to={playPath(me)} className="font-bold text-[var(--wood-deep)] underline">
          Vào bàn chơi ›
        </Link>
      </p>

      {msg && (
        <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs text-[var(--play-ink)] ring-1 ring-black/10">
          {msg}
        </p>
      )}

      <section className="app-panel mt-4 p-3">
        <p className="play-heading text-sm">Tra cứu người chơi</p>
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
            placeholder="Số xu (+/-)"
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
        <p className="play-heading text-sm">Khách đang chơi (mã G…)</p>
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
              placeholder="Số xu (+/-)"
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
    </AppShell>
  );
}
