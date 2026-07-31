import { LudoScene, type LudoTokenView } from "./LudoScene";
import type { LudoThemeId } from "../themes";

export type { LudoTokenView };

export default function LudoBoard3D({
  tokens,
  validTokenIds,
  onPick,
  myColor,
  themeId = "classic",
}: {
  tokens: LudoTokenView[];
  validTokenIds: string[];
  onPick: (tokenId: string) => void;
  myColor?: string | null;
  themeId?: LudoThemeId;
}) {
  return (
    <div className="ludo-board3d" aria-label="Bàn Ludo 3D">
      <LudoScene
        tokens={tokens}
        validTokenIds={validTokenIds}
        onPick={onPick}
        myColor={myColor}
        themeId={themeId}
      />
    </div>
  );
}
