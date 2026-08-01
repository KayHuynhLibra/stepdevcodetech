import type { LudoThemeId } from "../themes";

export type BoardThemeMats = {
  wood: string;
  woodDark: string;
  track: string;
  fog: string;
  ambient: number;
  dirIntensity: number;
  ground: string;
  groundRing: string;
  accent: string;
  sparkle: string;
  sky: string;
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
        ground: "#2e7d32",
        groundRing: "#1b5e20",
        accent: "#a5d6a7",
        sparkle: "#fff59d",
        sky: "#87ceeb",
      };
    case "arena":
      return {
        wood: "#2a2035",
        woodDark: "#1a1218",
        track: "#3a3048",
        fog: "#120e18",
        ambient: 0.35,
        dirIntensity: 1.25,
        ground: "#1a1218",
        groundRing: "#2a2035",
        accent: "#f2ab27",
        sparkle: "#ffecb3",
        sky: "#1a0a20",
      };
    default:
      return {
        wood: "#6d4c41",
        woodDark: "#4e342e",
        track: "#f5f5f5",
        fog: "#87a8d8",
        ambient: 0.5,
        dirIntensity: 1.15,
        ground: "#7cb342",
        groundRing: "#558b2f",
        accent: "#ffb74d",
        sparkle: "#fff8e1",
        sky: "#b3e5fc",
      };
  }
}
