import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LudoCosmetics } from "../../../hooks/useLudoCosmetics";
import type { LudoViewMode } from "../cosmeticsCatalog";
import {
  readOrbitLock,
  subscribeOrbitLock,
  writeOrbitLock,
  type LudoOrbitPose,
} from "../ludoOrbitLock";
import {
  LudoCornerAvatars,
  type LudoCornerDie,
  type LudoCornerPlayer,
} from "../LudoCornerAvatars";
import type { LudoThemeId } from "../themes";
import {
  LudoScene,
  type LudoOrbitNavApi,
  type LudoTokenView,
} from "./LudoScene";

export type { LudoTokenView };

export default function LudoBoard3D({
  tokens,
  validTokenIds,
  onPick,
  myColor,
  themeId = "classic",
  cosmetics,
  viewMode = "orbit",
  players,
  mySeat,
  turnSeat,
  dice,
  diceFaces,
  diceThrowKey = 0,
  diceThrowColor,
  turnDice,
  selectedDieIndex = null,
  diceSelectable = false,
  onSelectDie,
  onSelectPlayer,
}: {
  tokens: LudoTokenView[];
  validTokenIds: string[];
  onPick: (tokenId: string) => void;
  myColor?: string | null;
  themeId?: LudoThemeId;
  cosmetics?: LudoCosmetics;
  viewMode?: LudoViewMode;
  players?: LudoCornerPlayer[];
  mySeat?: number | null;
  turnSeat?: number | null;
  dice?: number | null;
  diceFaces?: number[] | null;
  diceThrowKey?: number;
  diceThrowColor?: string | null;
  turnDice?: LudoCornerDie[] | null;
  selectedDieIndex?: number | null;
  diceSelectable?: boolean;
  onSelectDie?: (dieIndex: number) => void;
  onSelectPlayer?: (player: LudoCornerPlayer) => void;
}) {
  const pawnDecorByColor = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of players || []) {
      if (p.color && p.pawnDecorId) m[p.color] = p.pawnDecorId;
    }
    return m;
  }, [players]);

  const [orbitLock, setOrbitLock] = useState(() => readOrbitLock());
  const orbitCaptureRef = useRef<(() => LudoOrbitPose | null) | null>(null);
  const orbitNavRef = useRef<LudoOrbitNavApi | null>(null);
  const orbitLocked =
    viewMode === "orbit" && orbitLock.locked && !!orbitLock.pose;

  useEffect(() => subscribeOrbitLock(setOrbitLock), []);

  const onOrbitPoseChange = useCallback(
    (pose: LudoOrbitPose) => {
      if (orbitLock.locked) {
        const next = { locked: true, pose };
        writeOrbitLock(next);
        setOrbitLock(next);
      } else {
        setOrbitLock((prev) => ({ ...prev, pose }));
      }
    },
    [orbitLock.locked],
  );

  return (
    <div
      className={`ludo-board3d ludo-board3d--framed ludo-board3d--${viewMode}${
        orbitLocked ? " is-orbit-locked" : ""
      }`}
      data-theme={themeId}
      data-view={viewMode}
      aria-label="Bàn Ludo 3D"
    >
      <div className="ludo-board3d__bezel" aria-hidden>
        <span className="ludo-board3d__corner ludo-board3d__corner--tl" />
        <span className="ludo-board3d__corner ludo-board3d__corner--tr" />
        <span className="ludo-board3d__corner ludo-board3d__corner--bl" />
        <span className="ludo-board3d__corner ludo-board3d__corner--br" />
      </div>
      {players?.length ? (
        <LudoCornerAvatars
          players={players}
          mySeat={mySeat}
          turnSeat={turnSeat}
          facingColor={myColor}
          className="ludo-corners--overlay3d"
          turnDice={turnDice}
          selectedDieIndex={selectedDieIndex}
          diceSelectable={diceSelectable}
          onSelectDie={onSelectDie}
          onSelectPlayer={onSelectPlayer}
        />
      ) : null}
      <div className="ludo-board3d__viewport">
        <LudoScene
          tokens={tokens}
          validTokenIds={validTokenIds}
          onPick={onPick}
          myColor={myColor}
          themeId={themeId}
          cosmetics={cosmetics}
          viewMode={viewMode}
          pawnDecorByColor={pawnDecorByColor}
          dice={dice}
          diceFaces={diceFaces}
          diceThrowKey={diceThrowKey}
          diceThrowColor={diceThrowColor}
          orbitLocked={orbitLocked}
          orbitPose={orbitLock.pose}
          orbitCaptureRef={orbitCaptureRef}
          orbitNavRef={orbitNavRef}
          onOrbitPoseChange={onOrbitPoseChange}
        />
      </div>
    </div>
  );
}
