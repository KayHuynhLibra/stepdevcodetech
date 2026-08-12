import { useEffect, useMemo, useState, type ComponentType } from "react";
import type { LudoCosmetics } from "../../hooks/useLudoCosmetics";
import type { LudoViewMode } from "./cosmeticsCatalog";
import { LudoBoardLite, type LudoTokenView } from "./LudoBoardLite";
import type {
  LudoCornerDie,
  LudoCornerPlayer,
} from "./LudoCornerAvatars";
import { Ludo3dErrorBoundary } from "./Ludo3dErrorBoundary";
import {
  preferLiteBoard,
  type LudoBoardMode,
} from "./preferLiteBoard";
import type { LudoThemeId } from "./themes";

export type { LudoTokenView };

type Board3dProps = {
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
};

/**
 * Load 3D via dynamic import — never wrap R3F in React.Suspense outside <Canvas>.
 * (useTexture/useGLTF suspend bubbles out of Canvas and stuck the old “Đang tải…” UI.)
 */
export function LudoBoard({
  tokens,
  validTokenIds,
  onPick,
  myColor,
  themeId = "classic",
  cosmetics,
  boardMode = "auto",
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
}: Board3dProps & { boardMode?: LudoBoardMode }) {
  const preferLite = useMemo(() => preferLiteBoard(boardMode), [boardMode]);
  const [Board3d, setBoard3d] = useState<ComponentType<Board3dProps> | null>(
    null,
  );
  const [chunkError, setChunkError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [sceneCrash, setSceneCrash] = useState(false);

  useEffect(() => {
    if (preferLite) return;
    let cancelled = false;
    setChunkError(null);
    setSceneCrash(false);
    setBoard3d(null);

    void import("./r3f/LudoBoard3D")
      .then((m) => {
        if (cancelled) return;
        setBoard3d(() => m.default);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[ludo-3d] chunk failed", err);
        setChunkError(
          err instanceof Error ? err.message : "Không tải được module 3D",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [preferLite, retryKey]);

  const throwColor =
    diceThrowColor ||
    players?.find((p) => p.seat === turnSeat)?.color ||
    myColor ||
    null;

  const shared = {
    tokens,
    validTokenIds,
    onPick,
    myColor,
    cosmetics,
    themeId,
    players,
    mySeat,
    turnSeat,
    dice,
    diceFaces,
    diceThrowKey,
    diceThrowColor: throwColor,
    turnDice,
    selectedDieIndex,
    diceSelectable,
    onSelectDie,
    onSelectPlayer,
  };

  if (preferLite) {
    return <LudoBoardLite {...shared} />;
  }

  const retry = () => setRetryKey((k) => k + 1);

  if (chunkError || sceneCrash) {
    return (
      <div
        className={`ludo-board3d ludo-board3d--framed ludo-board3d--failed ludo-board3d--${viewMode}`}
        data-theme={themeId}
        role="alert"
      >
        <p className="ludo-board3d__fail-title">Bàn 3D lỗi</p>
        <p className="ludo-board3d__fail-hint">
          {chunkError || "WebGL / scene crash. Thử lại hoặc chọn 2D trong tuỳ chọn."}
        </p>
        <button type="button" className="ludo-tool is-on" onClick={retry}>
          Thử lại 3D
        </button>
      </div>
    );
  }

  if (!Board3d) {
    return (
      <div
        className={`ludo-board3d ludo-board3d--framed ludo-board3d--loading ludo-board3d--${viewMode}`}
        data-theme={themeId}
        aria-busy="true"
        aria-label="Đang tải bàn 3D"
      >
        Đang tải bàn 3D…
      </div>
    );
  }

  const Comp = Board3d;
  return (
    <Ludo3dErrorBoundary
      fallback={
        <div
          className={`ludo-board3d ludo-board3d--framed ludo-board3d--failed ludo-board3d--${viewMode}`}
          data-theme={themeId}
          role="alert"
        >
          <p className="ludo-board3d__fail-title">Bàn 3D lỗi</p>
          <p className="ludo-board3d__fail-hint">
            WebGL không chạy được trên máy này. Thử lại hoặc chọn 2D.
          </p>
          <button type="button" className="ludo-tool is-on" onClick={retry}>
            Thử lại 3D
          </button>
        </div>
      }
      onError={() => setSceneCrash(true)}
    >
      <Comp {...shared} viewMode={viewMode} />
    </Ludo3dErrorBoundary>
  );
}
