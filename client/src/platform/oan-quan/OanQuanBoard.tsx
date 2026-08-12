import { StonePile } from "./OanPieces";
import { OanBoardTrack } from "./OanBoardTrack";
import { OanSowFx } from "./OanSowFx";
import type { OanPit, SowStep } from "./types";

type Props = {
  pits: OanPit[];
  validPitIndexes: number[];
  interactive: boolean;
  onSow: (pitIndex: number) => void;
  lastSteps?: SowStep[];
  moveSeq?: number;
};

function pitAria(p: OanPit, index: number, kind: "dân" | "quan"): string {
  const parts: string[] = [];
  if (p.quan > 0) parts.push(`${p.quan} quan`);
  if (p.dan > 0) parts.push(`${p.dan} dân`);
  const content = parts.length ? parts.join(", ") : "trống";
  return `Ô ${kind} ${index}: ${content}`;
}

function flashClass(index: number, steps: SowStep[] | undefined): string {
  if (!steps?.length) return "";
  const lastCap = [...steps].reverse().find((s) => s.kind === "capture");
  if (lastCap && lastCap.to === index) return "flash-capture";
  const lastPlace = [...steps].reverse().find((s) => s.kind === "place");
  if (lastPlace && lastPlace.to === index) return "flash-place";
  return "";
}

/**
 * Bàn dọc: quan trên 0 · quan dưới 6,
 * cột dân P1 trái (11→7), cột P0 phải (1→5).
 */
export function OanQuanBoard({
  pits,
  validPitIndexes,
  interactive,
  onSow,
  lastSteps,
  moveSeq,
}: Props) {
  const valid = new Set(validPitIndexes);
  const leftOrder = [11, 10, 9, 8, 7];
  const rightOrder = [1, 2, 3, 4, 5];

  const renderDan = (index: number) => {
    const p = pits[index] ?? { dan: 0, quan: 0 };
    const can = interactive && valid.has(index);
    return (
      <button
        key={index}
        type="button"
        data-oan-pit={index}
        className={`oan-pit oan-pit--dan ${can ? "valid" : ""} ${flashClass(index, lastSteps)}`}
        disabled={!can}
        onClick={() => can && onSow(index)}
        aria-label={pitAria(p, index, "dân")}
      >
        <span className="oan-pit__rim" aria-hidden />
        <StonePile pit={p} variant="dan" />
      </button>
    );
  };

  const renderQuan = (index: number, side: "top" | "bottom") => {
    const p = pits[index] ?? { dan: 0, quan: 0 };
    return (
      <div
        key={index}
        data-oan-pit={index}
        className={`oan-quan oan-quan--${side} ${flashClass(index, lastSteps)}`}
        aria-label={pitAria(p, index, "quan")}
      >
        <span className="oan-quan__label">Ô Quan</span>
        <div className="oan-quan__well">
          <span className="oan-quan__rim" aria-hidden />
          <StonePile pit={p} variant="quan" />
        </div>
      </div>
    );
  };

  return (
    <div className="oan-board-wrap">
      <div className="oan-board-frame">
        <div className="oan-board-frame__carving" aria-hidden>
          Ô ĂN QUAN
        </div>
        <div className="oan-board-stage">
          <OanBoardTrack />
          <div className="oan-board" role="group" aria-label="Bàn ô ăn quan">
            {renderQuan(0, "top")}
            <div className="oan-board__center">
              <div className="oan-cols">
                <div className="oan-col oan-col--left">
                  <div className="oan-side-label oan-side-label--left" aria-hidden>
                    Bên đối thủ
                  </div>
                  <div className="oan-col__pits">
                    {leftOrder.map(renderDan)}
                  </div>
                </div>
                <div className="oan-lane oan-lane--vert" aria-hidden />
                <div className="oan-col oan-col--right">
                  <div className="oan-side-label oan-side-label--right" aria-hidden>
                    Bên của bạn
                  </div>
                  <div className="oan-col__pits">
                    {rightOrder.map(renderDan)}
                  </div>
                </div>
              </div>
            </div>
            {renderQuan(6, "bottom")}
          </div>
          <OanSowFx moveSeq={moveSeq} lastSteps={lastSteps} />
        </div>
      </div>
    </div>
  );
}
