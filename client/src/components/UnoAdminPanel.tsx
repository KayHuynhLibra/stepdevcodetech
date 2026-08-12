import { useCallback, useEffect, useState } from "react";
import { api } from "../auth";

type AdminRoom = {
  roomId: string;
  status: string;
  stake?: number;
  pot?: number;
  fillBots?: boolean;
  playerCount?: number;
  turnSeat?: number;
  lastEvent?: string | null;
  updatedAt?: number;
  seats?: {
    seat: number;
    displayName: string;
    isBot: boolean;
    connected?: boolean;
  }[];
};

export function UnoAdminPanel({
  main,
  onMsg,
}: {
  main: boolean;
  onMsg: (s: string) => void;
}) {
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [presets, setPresets] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api<{
        ok: true;
        rooms: AdminRoom[];
        stakePresets?: number[];
      }>("/api/admin/uno/rooms");
      setRooms(r.rooms || []);
      setPresets(r.stakePresets || []);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi tải phòng HueRush");
    } finally {
      setBusy(false);
    }
  }, [onMsg]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeRoom = async (id: string) => {
    if (!main) {
      onMsg("Chỉ mainadmin đóng phòng");
      return;
    }
    if (!window.confirm(`Đóng phòng ${id}?`)) return;
    setBusy(true);
    try {
      await api(`/api/admin/uno/rooms/${id}/close`, { method: "POST" });
      onMsg(`Đã đóng ${id}`);
      await load();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi đóng phòng");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="app-panel mt-3 space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="play-heading text-sm">HueRush · Quản trị</p>
          <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
            Phòng live · mức xu presets:{" "}
            {presets.length
              ? presets.map((p) => p.toLocaleString("vi-VN")).join(" / ")
              : "0 / 500 / 1000 / 5000"}
          </p>
        </div>
        <button
          type="button"
          className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
          disabled={busy}
          onClick={() => void load()}
        >
          Làm mới
        </button>
      </div>
      <ul className="max-h-96 space-y-1.5 overflow-y-auto">
        {!rooms.length ? (
          <li className="text-[11px] text-[var(--play-muted)]">
            Không có phòng gần đây.
          </li>
        ) : (
          rooms.map((r) => (
            <li
              key={r.roomId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1.5 text-[11px] ring-1 ring-[var(--wood-deep)]/10"
            >
              <div className="min-w-0">
                <p className="font-bold text-[var(--play-ink)]">
                  {r.roomId}{" "}
                  <span className="font-normal text-[var(--play-muted)]">
                    · {r.status}
                    {r.fillBots ? " · fill bots" : " · PvP"}
                  </span>
                </p>
                <p className="text-[10px] text-[var(--play-muted)]">
                  Mức {(r.stake ?? 0).toLocaleString("vi-VN")} · hũ{" "}
                  {(r.pot ?? 0).toLocaleString("vi-VN")}
                  {r.seats?.length
                    ? ` · ${r.seats.length} ghế: ${r.seats
                        .map((s) => s.displayName)
                        .join(", ")}`
                    : ""}
                </p>
              </div>
              {main && r.status !== "finished" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void closeRoom(r.roomId)}
                  className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-900 ring-1 ring-rose-200 disabled:opacity-45"
                >
                  Đóng
                </button>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
