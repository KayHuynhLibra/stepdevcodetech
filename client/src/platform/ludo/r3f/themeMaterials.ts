import type { LudoThemeId } from "../themes";

export type BoardThemeMats = {
  wood: string;
  woodDark: string;
  track: string;
  fog: string;
  ambient: number;
  dirIntensity: number;
};

export function themeMaterials(themeId: LudoThemeId): BoardThemeMats {
  switch (themeId) {
    case "soccer":
      return {
        wood: "#2e7d32",
        woodDark: "#1b5e20",
        track: "#eceff1",
        fog: "#1b3d1f",
        ambient: 0.5,
        dirIntensity: 1.05,
      };
    case "arena":
      return {
        wood: "#2a2035",
        woodDark: "#1a1218",
        track: "#3a3048",
        fog: "#120e18",
        ambient: 0.35,
        dirIntensity: 1.25,
      };
    default:
      return {
        wood: "#6d4c41",
        woodDark: "#4e342e",
        track: "#f5f5f5",
        fog: "#1a237e",
        ambient: 0.45,
        dirIntensity: 1.15,
      };
  }
}
