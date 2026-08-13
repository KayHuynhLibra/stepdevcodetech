import { useCallback, useEffect, useState } from "react";
import { api } from "../auth";
import { LudoCosmeticsAdmin } from "./LudoCosmeticsAdmin";
import { LudoEconomyAdmin } from "./LudoEconomyAdmin";

type AdminRoom = {
  roomId: string;
  status: string;
  themeId?: string;
  diceMode?: number;
  stake?: number;
  pot?: number;
  phase?: string;
  turnSeat?: number;
  lastEvent?: string | null;
  updatedAt?: number;
  players?: {
    seat: number;
    color: string;
    displayName: string;
    isBot: boolean;
    connected?: boolean;
  }[];
};

export function LudoAdminPanel({
  canEdit,
  main,
  onMsg,
}: {
  canEdit: boolean;
  main: boolean;
  onMsg: (s: string) => void;
}) {
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [busy, setBusy] = useState(false);
  const [sub, setSub] = useState<"rooms" | "money" | "cosmetics">("rooms");

  const loadRooms = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api<{ ok: true; rooms: AdminRoom[] }>(
        "/api/admin/ludo/rooms",
      );
      setRooms(r.rooms || []);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi tải phòng Ludo");
    } finally {
      setBusy(false);
    }
  }, [onMsg]);

  useEffect(() => {
    if (sub === "rooms") void loadRooms();
  }, [sub, loadRooms]);

  const closeRoom = async (id: string) => {
    if (!main) {
      onMsg("Chỉ mainadmin đóng phòng");
      return;
    }
    if (!window.confirm(`Đóng phòng ${id}?`)) return;
    setBusy(true);
    try {
      await api(`/api/admin/ludo/rooms/${id}/close`, { method: "POST" });
      onMsg(`Đã đóng ${id}`);
      await loadRooms();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi đóng phòng");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="app-panel mt-3 space-y-3 p-3 sm:p-4">
      <div>
        <p className="play-heading text-sm">Ludo · Quản trị</p>
        <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
          Phòng live · tiền bạc (stake/giá) · cosmetics bàn/quân — mainadmin đầy
          đủ.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: "rooms" as const, label: "Phòng live" },
            { id: "money" as const, label: "Tiền bạc" },
            { id: "cosmetics" as const, label: "Cosmetics" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
              sub === t.id
                ? "bg-[var(--wood-deep)] text-white"
                : "bg-white ring-1 ring-[var(--wood-deep)]/15"
            }`}
            onClick={() => setSub(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === "rooms" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold">
              {rooms.length} phòng gần đây
            </p>
            <button
              type="button"
              className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15"
              disabled={busy}
              onClick={() => void loadRooms()}
            >
              Tải lại
            </button>
          </div>
          <div className="max-h-[28rem] space-y-1.5 overflow-y-auto">
            {rooms.length === 0 ? (
              <p className="text-[11px] text-[var(--play-muted)]">
                Chưa có phòng.
              </p>
            ) : (
              rooms.map((r) => (
                <div
                  key={r.roomId}
                  className="rounded-xl bg-white/80 px-2.5 py-2 text-[11px] ring-1 ring-[var(--wood-deep)]/10"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-bold">{r.roomId}</span>
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold uppercase">
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
                    {r.themeId || "classic"} · xúc {r.diceMode || 1} · stake{" "}
                    {r.stake ?? 0} · pot {r.pot ?? 0} · phase {r.phase}
                  </p>
                  <p className="mt-0.5 truncate text-[10px]">
                    {(r.players || [])
                      .map(
                        (p) =>
                          `${p.displayName}${p.isBot ? " (bot)" : ""} [${p.color}]`,
                      )
                      .join(" · ") || "—"}
                  </p>
                  {r.lastEvent ? (
                    <p className="mt-0.5 truncate text-[10px] opacity-70">
                      {r.lastEvent}
                    </p>
                  ) : null}
                  {r.status !== "finished" && main ? (
                    <button
                      type="button"
                      disabled={busy || !canEdit}
                      className="mt-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-red-700 ring-1 ring-red-200 disabled:opacity-40"
                      onClick={() => void closeRoom(r.roomId)}
                    >
                      Đóng phòng
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {sub === "money" ? (
        <LudoEconomyAdmin canEdit={main} onMsg={onMsg} />
      ) : null}

      {sub === "cosmetics" ? (
        <LudoCosmeticsAdmin canEdit={canEdit} onMsg={onMsg} />
      ) : null}

      <details className="rounded-xl bg-white/70 px-3 py-2 text-[11px] ring-1 ring-[var(--wood-deep)]/10">
        <summary className="cursor-pointer font-bold">
          Tiêu chuẩn màu &amp; chi tiết (2D / 3D)
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] leading-relaxed text-[var(--play-muted)]">
          <li>
            Ghế tuyệt đối: đỏ <code>#c62828</code> · lá <code>#2e7d32</code> ·
            vàng <code>#f9a825</code> · xanh <code>#1565c0</code> — khung góc
            không đổi theo “bạn”.
          </li>
          <li>
            Nền bàn = khối procedural (không PNG full-board). GLB chỉ khi URL
            kết thúc <code>.glb/.gltf</code>.
          </li>
          <li>
            Theme garden / neon / frost: track + yardFloor + rim đồng bộ trong{" "}
            <code>themeMaterials</code>; quân cùng màu chuồng.
          </li>
          <li>
            3D lỗi chunk/WebGL → tự hiện nút chuyển 2D (không kẹt “Đang tải”).
          </li>
          <li>
            Cosmetics P+M: palette không đè skin phòng; themeBoards chỉ override
            model, không ảnh phủ.
          </li>
        </ul>
      </details>
    </section>
  );
}
