import type { CSSProperties } from "react";
import { UnoCardFace, UnoDrawStack, UnoHandFan } from "./UnoCardFace";
import type { UnoColor, UnoPlayer, UnoRoom } from "./types";
import { COLOR_LABEL } from "./types";

/**
 * Map opponents around table slots (relative to "me" at bottom).
 * Slots: top | top-left | top-right | left | right | mid-left | mid-right …
 */
function seatSlotClass(
  opponentIndex: number,
  opponentCount: number,
): string {
  if (opponentCount === 1) return "uno-slot--top";
  if (opponentCount === 2) {
    return opponentIndex === 0 ? "uno-slot--left" : "uno-slot--right";
  }
  if (opponentCount === 3) {
    return ["uno-slot--left", "uno-slot--top", "uno-slot--right"][
      opponentIndex
    ]!;
  }
  // 4+ opponents: ring around top half
  const slots = [
    "uno-slot--tl",
    "uno-slot--top",
    "uno-slot--tr",
    "uno-slot--left",
    "uno-slot--right",
    "uno-slot--ml",
    "uno-slot--mr",
    "uno-slot--bl",
    "uno-slot--br",
  ];
  return slots[opponentIndex % slots.length]!;
}

function SeatCard({
  player,
  count,
  isTurn,
  isRisk,
  backClass,
  onSelect,
}: {
  player: UnoPlayer;
  count: number;
  isTurn: boolean;
  isRisk: boolean;
  backClass: string;
  onSelect?: (player: UnoPlayer) => void;
}) {
  return (
    <div
      className={`uno-seat ${isTurn ? "uno-seat--active" : ""} ${isRisk ? "uno-seat--risk" : ""} ${onSelect && !player.isBot ? "uno-seat--giftable" : ""}`}
      data-social-user={player.userId || undefined}
      data-social-name={player.displayName}
      data-social-seat={player.seat}
      role={onSelect && !player.isBot ? "button" : undefined}
      tabIndex={onSelect && !player.isBot ? 0 : undefined}
      onClick={
        onSelect && !player.isBot ? () => onSelect(player) : undefined
      }
      onKeyDown={
        onSelect && !player.isBot
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(player);
              }
            }
          : undefined
      }
      title={
        onSelect && !player.isBot ? `Tặng quà · ${player.displayName}` : undefined
      }
    >
      <div
        className={`uno-seat__avatar-wrap ${isTurn ? "uno-seat__avatar-wrap--turn" : ""}`}
      >
        <span className="uno-seat__turn-ring" aria-hidden />
        <div className="uno-seat__avatar" aria-hidden>
          {player.displayName.slice(0, 2)}
        </div>
      </div>
      <div className="uno-seat__name" title={player.displayName}>
        {player.displayName}
      </div>
      <UnoHandFan count={count} backClass={backClass} />
      <div className="uno-seat__flags">
        {player.isBot ? <span className="uno-seat__bot">BOT</span> : null}
        {player.saidUno ? <span className="uno-seat__uno">Rush!</span> : null}
        {isRisk ? <span className="uno-seat__risk">!</span> : null}
        <span className="uno-seat__flags-spacer" aria-hidden>
          ·
        </span>
      </div>
    </div>
  );
}

export function UnoBoard({
  room,
  mySeat,
  isMyTurn,
  onPlayCard,
  onDraw,
  onCallUno,
  onCatch,
  onChooseColor,
  fxPulse,
  onSelectPlayer,
}: {
  room: UnoRoom;
  mySeat: number | null;
  isMyTurn: boolean;
  onPlayCard: (cardId: string) => void;
  onDraw: () => void;
  onCallUno: () => void;
  onCatch: (seat: number) => void;
  onChooseColor: (color: UnoColor) => void;
  fxPulse?: string | null;
  onSelectPlayer?: (player: UnoPlayer) => void;
}) {
  const opponents = room.seats
    .slice(0, room.playerCount)
    .filter((_, i) => i !== mySeat);

  const catchTarget =
    room.catchableSeat != null ? room.seats[room.catchableSeat] : null;
  const handLen = room.myHand.length;
  const me = mySeat != null ? room.seats[mySeat] : null;

  return (
    <div
      className={`uno-arena ${room.feltClass}`}
      data-players={room.playerCount}
    >
      {/* Fixed info strip — reserved height */}
      <div className="uno-arena__info">
        <span
          className={`uno-color-pill uno-color-pill--${room.activeColor}`}
          aria-label={
            COLOR_LABEL[room.activeColor as keyof typeof COLOR_LABEL] ??
            "Màu hiện tại"
          }
          title={
            COLOR_LABEL[room.activeColor as keyof typeof COLOR_LABEL] ??
            room.activeColor
          }
        />
        <span className="uno-dir" aria-label={room.direction === 1 ? "Thuận" : "Ngược"}>
          {room.direction === 1 ? "↻" : "↺"}
        </span>
        <span
          className={`uno-pending ${room.pendingDraw > 0 ? "uno-pending--on" : ""}`}
        >
          {room.pendingDraw > 0 ? `+${room.pendingDraw}` : "—"}
        </span>
        <span className="uno-decks">
          {room.deckCount} bộ · {room.drawPileCount} lá
        </span>
      </div>

      {/* Fixed table frame with absolute seat slots */}
      <div className="uno-table-frame">
        <div className="uno-table-felt" aria-hidden />

        {opponents.map((p, idx) => {
          const count = room.handCounts[p.seat] ?? 0;
          const isRisk =
            room.unoRiskSeat === p.seat && !p.saidUno && count === 1;
          return (
            <div
              key={p.seat}
              className={`uno-slot ${seatSlotClass(idx, opponents.length)}`}
            >
              <SeatCard
                player={p}
                count={count}
                isTurn={room.turnSeat === p.seat}
                isRisk={isRisk}
                backClass={room.cardBackClass}
                onSelect={
                  onSelectPlayer && p.userId && p.seat !== mySeat
                    ? onSelectPlayer
                    : undefined
                }
              />
            </div>
          );
        })}

        {/* Center piles — fixed box */}
        <div className="uno-table-center">
          <div className="uno-pile-box uno-pile-box--draw">
            <UnoDrawStack
              count={room.drawPileCount}
              backClass={room.cardBackClass}
              canDraw={isMyTurn && room.phase === "play"}
              onDraw={onDraw}
            />
          </div>
          <div className="uno-pile-box uno-pile-box--discard">
            {room.topCard ? (
              <UnoCardFace
                card={room.topCard}
                activeColor={room.activeColor}
                size="lg"
              />
            ) : (
              <div className="uno-pile__empty" />
            )}
            <span className="uno-pile__label">Úp</span>
          </div>
        </div>

        {/* FX layer — doesn't move layout */}
        <div
          className={`uno-table-fx ${fxPulse ? `uno-fx--${fxPulse}` : ""}`}
          aria-hidden
        />

        {/* Overlays — absolute, no reflow */}
        <div
          className={`uno-overlay ${room.needsColorChoice ? "is-on" : ""}`}
        >
          <div className="uno-color-picker" role="dialog" aria-label="Chọn màu">
            <div className="uno-color-picker__glow" aria-hidden />
            <p>Chọn màu</p>
            <div className="uno-color-picker__btns">
              {(["red", "yellow", "green", "blue"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`uno-color-btn uno-color-btn--${c}`}
                  aria-label={COLOR_LABEL[c]}
                  title={COLOR_LABEL[c]}
                  onClick={() => onChooseColor(c)}
                >
                  <span className="uno-color-btn__shine" aria-hidden />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          className={`uno-overlay uno-overlay--catch ${catchTarget && room.catchableSeat != null ? "is-on" : ""}`}
        >
          {catchTarget && room.catchableSeat != null ? (
            <button
              type="button"
              className="uno-catch-btn"
              onClick={() => onCatch(room.catchableSeat!)}
            >
              Bắt {catchTarget.displayName} quên Rush!
            </button>
          ) : null}
        </div>
      </div>

      {/* Fixed self seat + actions + hand dock */}
      <div className="uno-dock">
        <div className="uno-dock__bar">
          {me ? (
            <div
              className={`uno-seat uno-seat--self ${room.turnSeat === me.seat ? "uno-seat--active" : ""}`}
              data-social-user={me.userId || undefined}
              data-social-name={me.displayName}
              data-social-seat={me.seat}
            >
              <div
                className={`uno-seat__avatar-wrap ${
                  room.turnSeat === me.seat ? "uno-seat__avatar-wrap--turn" : ""
                }`}
              >
                <span className="uno-seat__turn-ring" aria-hidden />
                <div className="uno-seat__avatar">
                  {me.displayName.slice(0, 2)}
                </div>
              </div>
              <div className="uno-seat__meta">
                <div className="uno-seat__name">Bạn</div>
                <span className="uno-seat__count-fixed">{handLen} lá</span>
              </div>
            </div>
          ) : (
            <div className="uno-seat uno-seat--self uno-seat--ghost">
              <span className="uno-seat__count-fixed">—</span>
            </div>
          )}

          <div className="uno-actions" role="toolbar" aria-label="Thao tác HueRush">
            <button
              type="button"
              className={`uno-act uno-act--draw ${
                isMyTurn && room.phase === "play" ? "is-ready" : ""
              }`}
              onClick={onDraw}
              disabled={!(isMyTurn && room.phase === "play")}
            >
              {room.pendingDraw > 0
                ? `Rút +${room.pendingDraw}`
                : "Rút bài"}
            </button>
            <button
              type="button"
              className={`uno-act uno-act--uno ${
                mySeat != null && handLen >= 1 && handLen <= 2 ? "is-ready" : ""
              }`}
              onClick={onCallUno}
              disabled={!(mySeat != null && handLen >= 1 && handLen <= 2)}
            >
              Rush!
            </button>
            <p className="uno-act__hint" aria-live="polite">
              {room.needsColorChoice
                ? "Chạm ô màu trên bàn"
                : room.phase !== "play"
                  ? "Chờ ván…"
                  : !isMyTurn
                    ? "Chờ lượt"
                    : room.playableCardIds.length > 0
                      ? `${room.playableCardIds.length} lá đánh được · chạm lá sáng`
                      : room.pendingDraw > 0
                        ? `Phải rút +${room.pendingDraw} hoặc chồng`
                        : "Không khớp · bấm Rút bài"}
            </p>
          </div>
        </div>

        <div className="uno-dock__hand">
          {(() => {
            const density =
              handLen <= 6
                ? "comfy"
                : handLen <= 10
                  ? "snug"
                  : "scroll";

            return (
              <div
                className={`uno-hand uno-hand--fan uno-hand--${density}`}
                aria-label={`${handLen} lá trên tay`}
              >
                {room.myHand.map((card, i) => {
                  const playable = room.playableCardIds.includes(card.id);
                  const mid = (handLen - 1) / 2;
                  const t =
                    handLen > 1 ? (i - mid) / Math.max(handLen - 1, 1) : 0;
                  const tiltDeg = density === "scroll" ? t * 5 : t * 9;
                  const arcY =
                    density === "scroll" ? Math.abs(t) * 3 : Math.abs(t) * 8;
                  return (
                    <div
                      key={card.id}
                      className="uno-hand__slot uno-hand__slot--front"
                      style={
                        {
                          "--uno-tilt": `${tiltDeg}deg`,
                          "--uno-arc": `${arcY}px`,
                          zIndex: playable && isMyTurn ? 80 + i : 20 + i,
                        } as CSSProperties
                      }
                    >
                      <UnoCardFace
                        card={card}
                        backClass={room.cardBackClass}
                        size="sm"
                        highlight={playable && isMyTurn}
                        disabled={
                          !playable ||
                          !isMyTurn ||
                          room.phase !== "play"
                        }
                        onClick={() => onPlayCard(card.id)}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
