import type { LudoCosmetics } from "../../../hooks/useLudoCosmetics";
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
}: {
  tokens: LudoTokenView[];
  validTokenIds: string[];
  onPick: (tokenId: string) => void;
  myColor?: string | null;
  themeId?: LudoThemeId;
  cosmetics?: LudoCosmetics;
}) {
  return (
    <div className="ludo-board3d" aria-label="Bàn Ludo 3D">
      <LudoScene
        tokens={tokens}
        validTokenIds={validTokenIds}
        onPick={onPick}
        myColor={myColor}
        themeId={themeId}
        cosmetics={cosmetics}
      />
    </div>
  );
}
