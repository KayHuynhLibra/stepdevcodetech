import { posToXy, SAFE_VISUAL } from "./boardMap";

export type LudoTokenView = {
  id: string;
  color: string;
  index: number;
  pos: number;
};

export function LudoBoard({
  tokens,
  validTokenIds,
  onPick,
  myColor,
}: {
  tokens: LudoTokenView[];
  validTokenIds: string[];
  onPick: (tokenId: string) => void;
  myColor?: string | null;
}) {
  const valid = new Set(validTokenIds);

  return (
    <div className="ludo-board" aria-label="Bàn Ludo">
      <div className="ludo-board__iso">
        <div className="ludo-board__face">
          <div className="ludo-board__quad ludo-board__quad--red" />
          <div className="ludo-board__quad ludo-board__quad--green" />
          <div className="ludo-board__quad ludo-board__quad--yellow" />
          <div className="ludo-board__quad ludo-board__quad--blue" />
          <div className="ludo-board__cross" />
          {Array.from(SAFE_VISUAL).map((i) => {
            const xy = posToXy("red", i, 0);
            return (
              <span
                key={`safe-${i}`}
                className="ludo-safe"
                style={{ left: `${xy.x}%`, top: `${xy.y}%` }}
              />
            );
          })}
          {tokens.map((t) => {
            const xy = posToXy(t.color, t.pos, t.index);
            const can = valid.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                className={`ludo-token ludo-token--${t.color} ${can ? "is-valid" : ""} ${
                  myColor === t.color ? "is-mine" : ""
                }`}
                style={{ left: `${xy.x}%`, top: `${xy.y}%` }}
                disabled={!can}
                onClick={() => onPick(t.id)}
                title={t.id}
              >
                {t.index + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
