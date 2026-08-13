import type { UnoCard as Card, UnoColor, UnoValue } from "./types";
import { COLOR_LABEL, VALUE_LABEL } from "./types";

const COLOR_CLASS: Record<UnoColor, string> = {
  red: "uno-card--red",
  yellow: "uno-card--yellow",
  green: "uno-card--green",
  blue: "uno-card--blue",
  wild: "uno-card--wild",
};

function shortCorner(value: UnoValue): string {
  if (value === "skip") return "⊘";
  if (value === "reverse") return "⇄";
  if (value === "draw2") return "+2";
  if (value === "wild") return "W";
  if (value === "wild4") return "+4";
  return value;
}

function CardGlyph({ value }: { value: UnoValue }) {
  if (/^\d$/.test(value)) {
    return <span className="uno-card__num">{value}</span>;
  }
  if (value === "skip") {
    return (
      <svg className="uno-card__glyph" viewBox="0 0 64 64" aria-hidden>
        <circle
          cx="32"
          cy="32"
          r="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
        />
        <line
          x1="16"
          y1="48"
          x2="48"
          y2="16"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (value === "reverse") {
    return (
      <svg className="uno-card__glyph" viewBox="0 0 64 64" aria-hidden>
        <path
          d="M18 28c0-8 7-14 16-14h6"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path d="M34 8l10 6-10 6" fill="currentColor" />
        <path
          d="M46 36c0 8-7 14-16 14h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path d="M30 56l-10-6 10-6" fill="currentColor" />
      </svg>
    );
  }
  if (value === "draw2") {
    return (
      <span className="uno-card__stack-mark" aria-hidden>
        <span className="uno-card__mini" />
        <span className="uno-card__mini uno-card__mini--2" />
        <span className="uno-card__plus">+2</span>
      </span>
    );
  }
  if (value === "wild") {
    return (
      <span className="uno-card__wild-disc" aria-hidden>
        <span className="uno-card__wedge uno-card__wedge--r" />
        <span className="uno-card__wedge uno-card__wedge--y" />
        <span className="uno-card__wedge uno-card__wedge--g" />
        <span className="uno-card__wedge uno-card__wedge--b" />
      </span>
    );
  }
  if (value === "wild4") {
    return (
      <span className="uno-card__wild4" aria-hidden>
        <span className="uno-card__mini uno-card__mini--r" />
        <span className="uno-card__mini uno-card__mini--y" />
        <span className="uno-card__mini uno-card__mini--g" />
        <span className="uno-card__mini uno-card__mini--b" />
        <span className="uno-card__plus">+4</span>
      </span>
    );
  }
  return <span>{VALUE_LABEL[value] ?? value}</span>;
}

export function UnoCardFace({
  card,
  activeColor,
  small = false,
  faceDown = false,
  onClick,
  disabled = false,
  highlight = false,
  backClass = "uno-card-back--classic",
  className = "",
  size = "md",
}: {
  card: Card;
  activeColor?: UnoColor;
  small?: boolean;
  faceDown?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  highlight?: boolean;
  backClass?: string;
  className?: string;
  /** md = hand, lg = discard, xs = pile accent */
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg"
      ? "uno-card--lg"
      : size === "xs"
        ? "uno-card--xs"
        : small || size === "sm"
          ? "uno-card--sm"
          : "";

  if (faceDown) {
    return (
      <button
        type="button"
        className={`uno-card uno-card--back ${backClass} ${sizeClass} ${className}`.trim()}
        disabled={disabled}
        onClick={onClick}
        aria-label="Lá úp"
      >
        <span className="uno-card__back-mark">
          <span className="uno-card__back-oval">
            <span className="uno-card__back-logo">HR</span>
            <span className="uno-card__back-year">2026</span>
          </span>
        </span>
        <span className="uno-card__shine" aria-hidden />
      </button>
    );
  }

  const isWild = card.color === "wild";
  const colorClass = isWild
    ? activeColor && activeColor !== "wild"
      ? COLOR_CLASS[activeColor]
      : COLOR_CLASS.wild
    : COLOR_CLASS[card.color];

  const toneLabel = isWild
    ? "Wild"
    : COLOR_LABEL[card.color as keyof typeof COLOR_LABEL];

  return (
    <button
      type="button"
      className={`uno-card ${colorClass} ${sizeClass} ${highlight ? "uno-card--playable" : ""} ${isWild ? "uno-card--is-wild" : ""} ${className}`.trim()}
      disabled={disabled}
      onClick={onClick}
      aria-label={`${toneLabel} ${VALUE_LABEL[card.value] ?? card.value}`}
    >
      <span className="uno-card__rim" aria-hidden />
      <span className="uno-card__corner uno-card__corner--tl">
        {shortCorner(card.value)}
      </span>
      <span className="uno-card__oval">
        <span className="uno-card__oval-inner">
          <CardGlyph value={card.value} />
        </span>
      </span>
      <span className="uno-card__corner uno-card__corner--br">
        {shortCorner(card.value)}
      </span>
      <span className="uno-card__shine" aria-hidden />
    </button>
  );
}

/** Visual stack — fixed height; layer count capped, badge shows real count. */
export function UnoDrawStack({
  count,
  backClass,
  onDraw,
  canDraw,
}: {
  count: number;
  backClass: string;
  onDraw?: () => void;
  canDraw?: boolean;
}) {
  const layers = 4;
  return (
    <div className="uno-draw-stack" data-count={count}>
      {Array.from({ length: layers }, (_, i) => (
        <div
          key={i}
          className={`uno-draw-stack__layer ${backClass}`}
          style={{
            transform: `translate(${i * 1.2}px, ${-i * 1.4}px)`,
            zIndex: i,
            opacity: count > 0 || i === 0 ? 1 : 0.25,
          }}
          aria-hidden
        >
          <span className="uno-card__back-mark">
            <span className="uno-card__back-oval">
              <span className="uno-card__back-logo">HR</span>
            </span>
          </span>
        </div>
      ))}
      <div className="uno-draw-stack__badge">{count}</div>
      <button
        type="button"
        className={`uno-btn-draw ${canDraw ? "is-on" : ""}`}
        onClick={onDraw}
        disabled={!canDraw}
        tabIndex={canDraw ? 0 : -1}
      >
        Rút
      </button>
    </div>
  );
}

/** Mini fan — fixed box so count changes don't reflow seats. */
export function UnoHandFan({ count, backClass }: { count: number; backClass: string }) {
  const n = Math.min(5, Math.max(0, count));
  return (
    <div className="uno-hand-fan" aria-label={`${count} lá`}>
      {Array.from({ length: 5 }, (_, i) => {
        const visible = i < n;
        const rot = (i - 2) * 7;
        return (
          <span
            key={i}
            className={`uno-hand-fan__card ${backClass} ${visible ? "is-on" : ""}`}
            style={{
              transform: `rotate(${rot}deg)`,
              zIndex: i,
            }}
          />
        );
      })}
      <span className="uno-hand-fan__n">{count}</span>
    </div>
  );
}
