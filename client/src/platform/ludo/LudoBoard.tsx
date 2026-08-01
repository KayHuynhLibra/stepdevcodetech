import { lazy, Suspense, useMemo } from "react";
import type { LudoCosmetics } from "../../hooks/useLudoCosmetics";
import type { LudoViewMode } from "./cosmeticsCatalog";
import { LudoBoardLite, type LudoTokenView } from "./LudoBoardLite";
import {
  preferLiteBoard,
  type LudoBoardMode,
} from "./preferLiteBoard";
import type { LudoThemeId } from "./themes";

export type { LudoTokenView };

const LazyLudoBoard3D = lazy(() => import("./r3f/LudoBoard3D"));

export function LudoBoard({
  tokens,
  validTokenIds,
  onPick,
  myColor,
  themeId = "classic",
  cosmetics,
  boardMode = "auto",
  viewMode = "orbit",
}: {
  tokens: LudoTokenView[];
  validTokenIds: string[];
  onPick: (tokenId: string) => void;
  myColor?: string | null;
  themeId?: LudoThemeId;
  cosmetics?: LudoCosmetics;
  boardMode?: LudoBoardMode;
  viewMode?: LudoViewMode;
}) {
  const lite = useMemo(() => preferLiteBoard(boardMode), [boardMode]);

  if (lite) {
    return (
      <LudoBoardLite
        tokens={tokens}
        validTokenIds={validTokenIds}
        onPick={onPick}
        myColor={myColor}
        cosmetics={cosmetics}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <div className="ludo-board3d ludo-board3d--loading">
          Đang tải bàn 3D… (máy yếu có thể hơi lâu)
        </div>
      }
    >
      <LazyLudoBoard3D
        tokens={tokens}
        validTokenIds={validTokenIds}
        onPick={onPick}
        myColor={myColor}
        themeId={themeId}
        cosmetics={cosmetics}
        viewMode={viewMode}
      />
    </Suspense>
  );
}
