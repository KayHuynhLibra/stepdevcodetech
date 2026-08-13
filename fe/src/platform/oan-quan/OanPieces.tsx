import { stoneSlots } from "./oanStoneLayout";
import type { OanPit } from "./types";

type StonePileProps = {
  pit: OanPit;
  variant: "dan" | "quan";
  compact?: boolean;
};

function ariaLabel(pit: OanPit, variant: "dan" | "quan"): string {
  const parts: string[] = [];
  if (pit.quan > 0) parts.push(`${pit.quan} quan`);
  if (pit.dan > 0) parts.push(`${pit.dan} dân`);
  if (!parts.length) return variant === "quan" ? "Ô quan trống" : "Ô dân trống";
  return parts.join(", ");
}

/** Cục đá dân — nhỏ, xám tro. */
function Pebble({
  slot,
  i,
}: {
  slot: { x: number; y: number; scale: number; rot: number };
  i: number;
}) {
  return (
    <span
      className="oan-pebble"
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        transform: `translate(-50%, -50%) rotate(${slot.rot}deg) scale(${slot.scale})`,
        zIndex: 2 + (i % 7),
        animationDelay: `${(i % 5) * 0.28}s`,
      }}
      aria-hidden
    />
  );
}

/** Đá quan — to, màu ngọc bích / hổ phách dân gian. */
function QuanStone({ large, i }: { large?: boolean; i: number }) {
  const offset = large ? 0 : i % 2 === 0 ? -10 : 10;
  return (
    <span
      className={`oan-quan-stone ${large ? "oan-quan-stone--hero" : "oan-quan-stone--extra"}`}
      style={{
        animationDelay: `${0.1 + i * 0.14}s`,
        transform: large ? undefined : `translateX(${offset}%)`,
      }}
      aria-hidden
    />
  );
}

/** Hiển thị đủ từng viên — không gộp +N. */
export function StonePile({ pit, variant, compact }: StonePileProps) {
  const total = pit.dan + pit.quan;
  if (total <= 0) {
    return (
      <div className="oan-pile oan-pile--empty" aria-hidden>
        <span className="oan-pile__hollow" />
      </div>
    );
  }

  const danSlots = stoneSlots(pit.dan);
  const withQuan = pit.quan > 0 && pit.dan > 0;

  return (
    <div
      className={`oan-pile oan-pile--${variant} ${compact || withQuan ? "is-compact" : ""}`}
      aria-label={ariaLabel(pit, variant)}
    >
      {pit.quan > 0 ? (
        <div className="oan-pile__quans">
          {Array.from({ length: pit.quan }).map((_, i) => (
            <QuanStone
              key={`q-${i}`}
              large={variant === "quan" && pit.quan === 1 && pit.dan === 0}
              i={i}
            />
          ))}
        </div>
      ) : null}

      {pit.dan > 0 ? (
        <div className="oan-pile__stones">
          {danSlots.map((slot, i) => (
            <Pebble key={`d-${i}`} slot={slot} i={i} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Điểm đã ăn — quan = đá lớn, dân = sỏi nhỏ. */
export function ScoreTreasure({
  score,
  label,
}: {
  score: number;
  label: string;
}) {
  const quans = Math.floor(score / 10);
  const pebbles = score % 10;
  const showQuans = Math.min(quans, 6);
  const showPebbles = Math.min(pebbles, 8);
  return (
    <div className="oan-treasure" aria-label={`${label}: ${score} điểm`}>
      <div className="oan-treasure__row">
        {quans > 0
          ? Array.from({ length: showQuans }).map((_, i) => (
              <span key={`q-${i}`} className="oan-treasure__quan" aria-hidden />
            ))
          : null}
        {quans > showQuans ? (
          <span className="oan-treasure__badge">×{quans}</span>
        ) : null}
        {pebbles > 0
          ? Array.from({ length: showPebbles }).map((_, i) => (
              <span key={`p-${i}`} className="oan-treasure__pebble" aria-hidden />
            ))
          : null}
        {score === 0 ? <span className="oan-treasure__empty">—</span> : null}
      </div>
      <span className="oan-treasure__pts">{score}</span>
    </div>
  );
}
