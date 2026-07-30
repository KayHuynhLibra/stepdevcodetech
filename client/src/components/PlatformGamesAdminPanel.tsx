import { useEffect, useState } from "react";
import { api } from "../auth";
import type { GameManifest, GameStatus } from "../platform/games";

type AdminSnap = {
  games: GameManifest[];
  updatedAt?: number;
};

export function PlatformGamesAdminPanel({
  main,
  onMsg,
}: {
  main: boolean;
  onMsg: (s: string) => void;
}) {
  const [data, setData] = useState<AdminSnap | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const r = await api<{ ok: true } & AdminSnap>("/api/admin/platform/games");
      setData({ games: r.games ?? [], updatedAt: r.updatedAt });
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi tải registry");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = async (
    id: string,
    body: Partial<{
      enabled: boolean;
      status: GameStatus;
      sort: number;
      blurb: string;
      nameVi: string;
    }>,
  ) => {
    if (!main) {
      onMsg("Chỉ mainadmin sửa registry");
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ ok: true } & AdminSnap>(
        "/api/admin/platform/games",
        {
          method: "POST",
          body: JSON.stringify({ id, ...body }),
        },
      );
      setData({ games: r.games ?? [], updatedAt: r.updatedAt });
      onMsg(`Đã cập nhật ${id}`);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi lưu");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="app-panel p-3">
      <p className="play-heading text-sm">Nền tảng / Games</p>
      <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
        Registry động — bật/tắt, sort, coming_soon. Game mới = manifest +
        module (xem docs/GAME_MODULE.md).
      </p>
      {busy && !data && (
        <p className="mt-2 text-xs text-[var(--play-muted)]">Đang tải…</p>
      )}
      <ul className="mt-3 space-y-2">
        {(data?.games ?? []).map((g) => (
          <li
            key={g.id}
            className="rounded-xl bg-white/70 px-3 py-2.5 text-xs ring-1 ring-[var(--wood-deep)]/10"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-[var(--play-ink)]">
                  {g.nameVi}{" "}
                  <span className="font-mono font-normal text-[var(--play-muted)]">
                    ({g.id})
                  </span>
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
                  {g.blurb || "—"} · /{g.pathSuffix} · lane={g.spendLane} ·
                  vault={g.vaultKey ?? "—"}
                </p>
              </div>
              <label className="flex items-center gap-1 text-[10px] font-semibold">
                <input
                  type="checkbox"
                  checked={g.enabled}
                  disabled={!main || busy}
                  onChange={(e) =>
                    void patch(g.id, { enabled: e.target.checked })
                  }
                />
                Hiện lobby
              </label>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <select
                className="app-input !py-1 !text-[11px]"
                value={g.status}
                disabled={!main || busy}
                onChange={(e) =>
                  void patch(g.id, {
                    status: e.target.value as GameStatus,
                  })
                }
              >
                <option value="live">live</option>
                <option value="beta">beta</option>
                <option value="coming_soon">coming_soon</option>
              </select>
              <input
                type="number"
                className="app-input w-20 !py-1 !text-[11px]"
                value={g.sort}
                disabled={!main || busy}
                onChange={(e) =>
                  void patch(g.id, {
                    sort: Math.floor(Number(e.target.value)) || 0,
                  })
                }
                title="Sort"
              />
              {main && (
                <input
                  className="app-input min-w-[12rem] flex-1 !py-1 !text-[11px]"
                  defaultValue={g.blurb}
                  key={`${g.id}-${g.blurb}`}
                  placeholder="Blurb"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== g.blurb) void patch(g.id, { blurb: v });
                  }}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
      {data?.updatedAt ? (
        <p className="mt-2 text-[10px] text-[var(--play-muted)]">
          Cập nhật: {new Date(data.updatedAt).toLocaleString("vi-VN")}
        </p>
      ) : null}
    </section>
  );
}
