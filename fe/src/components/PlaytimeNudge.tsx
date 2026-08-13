import { Link } from "react-router-dom";
import { formatDuration, type PlaytimeNudgeInfo } from "../playtime";

interface PlaytimeNudgeProps {
  nudge: PlaytimeNudgeInfo;
  menuHref: string;
  onContinue: () => void;
}

export function PlaytimeNudge({
  nudge,
  menuHref,
  onContinue,
}: PlaytimeNudgeProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Đóng"
        onClick={onContinue}
      />
      <div
        className="sheet-shell relative z-[1] mx-3 mb-[max(1rem,env(safe-area-inset-bottom))] w-full max-w-sm animate-[sheet-up_0.18s_ease-out] overflow-hidden rounded-2xl px-4 pb-4 pt-5 ring-1 ring-[var(--jade)]/40 sm:mb-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby="playtime-nudge-title"
      >
        <p className="text-center text-[10px] font-bold uppercase tracking-wide text-[var(--jade-soft)]/80">
          Nhắc thời gian chơi
        </p>
        <h2
          id="playtime-nudge-title"
          className="font-display mt-1 text-center text-lg font-bold text-[var(--jade-soft)]"
        >
          {nudge.title}
        </h2>
        <p className="mt-2 text-center text-xs leading-relaxed text-white/70">
          {nudge.message}
        </p>
        <p className="mt-3 text-center text-[11px] text-white/45">
          Phiên này {formatDuration(nudge.sessionMs)} · Hôm nay{" "}
          {formatDuration(nudge.dayMs)}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onContinue}
            className="app-btn-primary"
          >
            Tiếp tục chơi
          </button>
          <Link
            to={menuHref}
            onClick={onContinue}
            className="app-btn-secondary text-center"
          >
            Về menu / nghỉ
          </Link>
        </div>
      </div>
    </div>
  );
}
