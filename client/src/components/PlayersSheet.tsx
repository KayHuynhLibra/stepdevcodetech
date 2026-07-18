import type { OnlinePlayerPublic } from "../cards";

interface PlayersSheetProps {
  open: boolean;
  players: OnlinePlayerPublic[];
  onClose: () => void;
  onSelectPlayer: (p: OnlinePlayerPublic) => void;
}

export function PlayersSheet({
  open,
  players,
  onClose,
  onSelectPlayer,
}: PlayersSheetProps) {
  if (!open) return null;

  const humans = players.filter((p) => !p.isBot);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div className="relative z-10 mb-0 flex max-h-[75vh] w-full max-w-md flex-col rounded-t-2xl bg-[#0f1728] px-4 pb-5 pt-4 text-white shadow-xl ring-1 ring-white/10 sm:mb-0 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-display text-base text-[var(--gold-soft)]">
              Đang trong phòng
            </p>
            <p className="text-[11px] text-white/50">
              {humans.length} người · chạm avatar xem info
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80"
          >
            Đóng
          </button>
        </div>

        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
          {humans.length === 0 && (
            <li className="py-8 text-center text-sm text-white/40">
              Chưa có ai trong phòng
            </li>
          )}
          {humans.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelectPlayer(p)}
                className="flex w-full items-center gap-2.5 rounded-xl bg-white/5 px-2.5 py-2 text-left ring-1 ring-white/8 transition active:scale-[0.99]"
              >
                <img
                  src={p.avatar || "/assets/ui/avatar-default.png"}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/20"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white/95">
                    {p.name}
                  </p>
                  <p className="text-[10px] text-white/45">
                    {p.code ? `ID ${p.code}` : "Khách"}
                  </p>
                </div>
                <span className="rounded-full bg-[#1a8fd4]/25 px-2 py-0.5 text-[10px] font-bold text-[#d6f0ff]">
                  USER
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
