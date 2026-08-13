import type { CSSProperties } from "react";
import { screenCornerForColor } from "./cosmeticsCatalog";

export type LudoCornerPlayer = {
  seat: number;
  color: string;
  displayName: string;
  isBot: boolean;
  userId?: string | null;
  avatar?: string | null;
  avatarFrame?: string | null;
  pawnDecorId?: string | null;
  connected?: boolean;
};

export type LudoCornerDie = {
  dieIndex: number;
  face: number;
};

export function LudoCornerAvatars({
  players,
  mySeat,
  turnSeat,
  facingColor,
  className = "",
  turnDice,
  selectedDieIndex = null,
  diceSelectable = false,
  onSelectDie,
  onSelectPlayer,
}: {
  players: LudoCornerPlayer[];
  mySeat?: number | null;
  turnSeat?: number | null;
  /** Viewer seat — place avatars at screen corners after facing (like 3D cam). */
  facingColor?: string | null;
  className?: string;
  /** Faces shown on the turn player’s corner (1 or 2 buttons). */
  turnDice?: LudoCornerDie[] | null;
  selectedDieIndex?: number | null;
  /** Dual mode: tap a face before picking a pawn. */
  diceSelectable?: boolean;
  onSelectDie?: (dieIndex: number) => void;
  onSelectPlayer?: (player: LudoCornerPlayer) => void;
}) {
  return (
    <div className={`ludo-corners ${className}`} aria-label="Người chơi góc bàn">
      {players.map((p) => {
        const corner = screenCornerForColor(p.color, facingColor);
        const isMe = mySeat != null && p.seat === mySeat;
        const isTurn = turnSeat != null && p.seat === turnSeat;
        const frame = p.avatarFrame || "frame-classic";
        const showDice = isTurn && turnDice && turnDice.length > 0;
        return (
          <div
            key={p.seat}
            className={`ludo-corner ludo-corner--${corner} ludo-corner--${p.color} ${
              isTurn ? "is-turn" : ""
            } ${isMe ? "is-me" : ""} ${p.isBot ? "is-bot" : ""} ${
              onSelectPlayer && !p.isBot && !isMe ? "is-giftable" : ""
            }`}
            data-social-user={p.userId || undefined}
            data-social-name={p.displayName}
            data-social-seat={p.seat}
            role={onSelectPlayer && !p.isBot && !isMe ? "button" : undefined}
            tabIndex={onSelectPlayer && !p.isBot && !isMe ? 0 : undefined}
            onClick={
              onSelectPlayer && !p.isBot && !isMe
                ? () => onSelectPlayer(p)
                : undefined
            }
            title={
              onSelectPlayer && !p.isBot && !isMe
                ? `Tặng quà · ${p.displayName}`
                : undefined
            }
          >
            <div
              className={`ludo-corner__avatar ${frame}`}
              style={
                {
                  "--ludo-corner-img": p.avatar
                    ? `url(${p.avatar})`
                    : undefined,
                } as CSSProperties
              }
            >
              {p.avatar ? (
                <img src={p.avatar} alt="" draggable={false} />
              ) : (
                <span className="ludo-corner__fallback">
                  {p.displayName.slice(0, 1)}
                </span>
              )}
            </div>
            <div className="ludo-corner__meta">
              {!isMe ? (
                <>
                  <span className="ludo-corner__name">{p.displayName}</span>
                  {p.isBot ? (
                    <span className="ludo-corner__badge">bot</span>
                  ) : null}
                </>
              ) : null}
              {showDice ? (
                <div
                  className={`ludo-corner__dice ${
                    turnDice!.length > 1 ? "is-dual" : "is-single"
                  }`}
                  role={diceSelectable ? "group" : undefined}
                  aria-label={
                    turnDice!.length > 1
                      ? "Chọn xúc xắc để đi"
                      : "Xúc xắc"
                  }
                >
                  {turnDice!.map((d) => {
                    const on =
                      selectedDieIndex != null &&
                      selectedDieIndex === d.dieIndex;
                    if (diceSelectable) {
                      return (
                        <button
                          key={`${d.dieIndex}-${d.face}`}
                          type="button"
                          className={`ludo-corner__die is-pick ${
                            on ? "is-on" : ""
                          }`}
                          onClick={() => onSelectDie?.(d.dieIndex)}
                          aria-pressed={on}
                          aria-label={`Xúc ${d.face}`}
                        >
                          {d.face}
                        </button>
                      );
                    }
                    return (
                      <span
                        key={`${d.dieIndex}-${d.face}`}
                        className="ludo-corner__die"
                        aria-label={`Xúc ${d.face}`}
                      >
                        {d.face}
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
