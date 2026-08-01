import type { LudoCosmetics } from "../../../hooks/useLudoCosmetics";
import type { LudoViewMode } from "../cosmeticsCatalog";
import type { LudoThemeId } from "../themes";
import { LudoScene, type LudoTokenView } from "./LudoScene";

export type { LudoTokenView };

export default function LudoBoard3D({
  tokens,
  validTokenIds,
  onPick,
  myColor,
  themeId = "classic",
  cosmetics,
  viewMode = "orbit",
}: {
  tokens: LudoTokenView[];
  validTokenIds: string[];
  onPick: (tokenId: string) => void;
  myColor?: string | null;
  themeId?: LudoThemeId;
  cosmetics?: LudoCosmetics;
  viewMode?: LudoViewMode;
}) {
  return (
    <div
      className={`ludo-board3d ludo-board3d--framed ludo-board3d--${viewMode}`}
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
      <div className="ludo-board3d__viewport">
        <LudoScene
          tokens={tokens}
          validTokenIds={validTokenIds}
          onPick={onPick}
          myColor={myColor}
          themeId={themeId}
          cosmetics={cosmetics}
          viewMode={viewMode}
        />
      </div>
    </div>
  );
}
