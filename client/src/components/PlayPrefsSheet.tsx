import { BottomSheet } from "./BottomSheet";
import {
  usePlayPrefs,
  type AudioChannel,
  type SymbolStripMode,
} from "../hooks/usePlayPrefs";

const CHANNELS: {
  id: Exclude<AudioChannel, "master">;
  label: string;
  hint: string;
}[] = [
  { id: "ui", label: "Giao diện", hint: "Click / nút chung" },
  { id: "tarot", label: "Tarot / Arcana", hint: "Xáo · lật · thắng" },
  { id: "olympus", label: "Olympus", hint: "Quay · sấm · thắng" },
];

/**
 * Cài âm + hiển thị dùng chung — mở từ header bàn, không chôn trong từng game.
 */
export function PlayPrefsSheet({
  open,
  onClose,
  tone = "light",
}: {
  open: boolean;
  onClose: () => void;
  /** Olympus dùng dark shell */
  tone?: "light" | "dark";
}) {
  const {
    prefs,
    setVolume,
    toggleChannelMute,
    toggleMasterMute,
    patch,
  } = usePlayPrefs();

  return (
    <BottomSheet
      open={open}
      title="Âm thanh & hình"
      onClose={onClose}
      heightClass="max-h-[88vh]"
      backdropClass={tone === "dark" ? "bg-black/70" : undefined}
      shellClass={
        tone === "dark"
          ? "bg-[#1a0e2e] text-[#fff4e6] ring-[rgba(245,197,66,0.45)]"
          : ""
      }
    >
      <div className="space-y-4 text-sm">
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">Master</p>
              <p className="text-[11px] opacity-60">Tắt / mở toàn bộ SFX</p>
            </div>
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-xs font-bold ring-1 ring-current/30"
              onClick={toggleMasterMute}
            >
              {prefs.masterMuted ? "Đã tắt" : "Bật"}
            </button>
          </div>
          <label className="block">
            <span className="mb-1 flex justify-between text-[11px] opacity-70">
              <span>Âm lượng chung</span>
              <span>{prefs.volumes.master}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={prefs.volumes.master}
              disabled={prefs.masterMuted}
              onChange={(e) => setVolume("master", Number(e.target.value))}
              className="w-full accent-[var(--jade,#3db8a0)]"
            />
          </label>
        </section>

        <section className="space-y-3 border-t border-current/15 pt-3">
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">
            Từng phần
          </p>
          {CHANNELS.map((ch) => (
            <div key={ch.id}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{ch.label}</p>
                  <p className="text-[11px] opacity-60">{ch.hint}</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg px-2.5 py-1 text-[11px] font-bold ring-1 ring-current/30"
                  onClick={() => toggleChannelMute(ch.id)}
                >
                  {prefs.muted[ch.id] ? "Tắt" : "Âm"}
                </button>
              </div>
              <label className="block">
                <span className="mb-1 flex justify-between text-[11px] opacity-70">
                  <span>Volume</span>
                  <span>{prefs.volumes[ch.id]}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={prefs.volumes[ch.id]}
                  disabled={prefs.masterMuted || prefs.muted[ch.id]}
                  onChange={(e) => setVolume(ch.id, Number(e.target.value))}
                  className="w-full accent-[var(--jade,#3db8a0)]"
                />
              </label>
            </div>
          ))}
        </section>

        <section className="space-y-2 border-t border-current/15 pt-3">
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">
            Hình ảnh
          </p>
          <p className="text-[11px] opacity-65">
            Hàng biểu tượng luôn hiện cạnh bàn — không ẩn trong menu phụ.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["icons", "Icon"],
                ["labels", "Icon + tên"],
                ["off", "Ẩn"],
              ] as [SymbolStripMode, string][]
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ring-1 ${
                  prefs.symbolStrip === mode
                    ? "bg-current/15 ring-current/50"
                    : "ring-current/25 opacity-80"
                }`}
                onClick={() => patch({ symbolStrip: mode })}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="mt-2 flex items-start gap-2 text-[12px]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={prefs.reduceFx}
              onChange={(e) => patch({ reduceFx: e.target.checked })}
            />
            <span>
              Giảm FX ngoài deck
              <span className="mt-0.5 block text-[11px] opacity-60">
                Olympus: sấm / flash chỉ trên lưới ô, không phủ cả màn.
              </span>
            </span>
          </label>
        </section>
      </div>
    </BottomSheet>
  );
}
