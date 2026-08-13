import type { LudoThemeId } from "../themes";

export type BoardThemeMats = {
  wood: string;
  woodDark: string;
  track: string;
  trackAlt: string;
  fog: string;
  ambient: number;
  dirIntensity: number;
  hemiIntensity: number;
  exposure: number;
  ground: string;
  groundRing: string;
  accent: string;
  sparkle: string;
  sky: string;
  yardFloor: string;
  tileRough: number;
  tileMetal: number;
  tileEmissive: string;
  tileEmit: number;
  rim: string;
};

export function themeMaterials(themeId: LudoThemeId): BoardThemeMats {
  switch (themeId) {
    case "soccer":
      return {
        wood: "#43a047",
        woodDark: "#2e7d32",
        track: "#f5f7f8",
        trackAlt: "#e8eef0",
        fog: "#9bc9a8",
        ambient: 0.78,
        dirIntensity: 1.45,
        hemiIntensity: 0.42,
        exposure: 1.12,
        ground: "#3d8b40",
        groundRing: "#1b5e20",
        accent: "#a5d6a7",
        sparkle: "#fff59d",
        sky: "#7eb8d9",
        yardFloor: "#e8f5e9",
        tileRough: 0.48,
        tileMetal: 0.04,
        tileEmissive: "#000000",
        tileEmit: 0,
        rim: "#1b5e20",
      };
    case "arena":
      return {
        wood: "#3a3048",
        woodDark: "#1a1218",
        track: "#524860",
        trackAlt: "#3a3048",
        fog: "#2a2038",
        ambient: 0.48,
        dirIntensity: 1.7,
        hemiIntensity: 0.32,
        exposure: 1.18,
        ground: "#241c30",
        groundRing: "#3a3048",
        accent: "#ffc14a",
        sparkle: "#fff3c4",
        sky: "#2a1838",
        yardFloor: "#2a2035",
        tileRough: 0.55,
        tileMetal: 0.18,
        tileEmissive: "#ff9800",
        tileEmit: 0.08,
        rim: "#f2ab27",
      };
    case "garden":
      return {
        wood: "#6d8f4e",
        woodDark: "#4a6b32",
        track: "#efebe0",
        trackAlt: "#e4dcc8",
        fog: "#b7d9a8",
        ambient: 0.82,
        dirIntensity: 1.4,
        hemiIntensity: 0.48,
        exposure: 1.2,
        ground: "#7cb342",
        groundRing: "#558b2f",
        accent: "#aed581",
        sparkle: "#fff59d",
        sky: "#b3e5fc",
        yardFloor: "#dcedc8",
        tileRough: 0.72,
        tileMetal: 0.02,
        tileEmissive: "#000000",
        tileEmit: 0,
        rim: "#33691e",
      };
    case "neon":
      return {
        wood: "#2a1848",
        woodDark: "#140a28",
        track: "#1e1238",
        trackAlt: "#2a1848",
        fog: "#3a2060",
        ambient: 0.5,
        dirIntensity: 1.65,
        hemiIntensity: 0.4,
        exposure: 1.28,
        ground: "#1a1030",
        groundRing: "#7c4dff",
        accent: "#e040fb",
        sparkle: "#00e5ff",
        sky: "#120820",
        yardFloor: "#120820",
        tileRough: 0.28,
        tileMetal: 0.55,
        tileEmissive: "#7c4dff",
        tileEmit: 0.22,
        rim: "#00e5ff",
      };
    case "frost":
      return {
        wood: "#90caf9",
        woodDark: "#42a5f5",
        track: "#e8f4fc",
        trackAlt: "#d6ebf8",
        fog: "#b3e5fc",
        ambient: 0.85,
        dirIntensity: 1.35,
        hemiIntensity: 0.5,
        exposure: 1.22,
        ground: "#e3f2fd",
        groundRing: "#81d4fa",
        accent: "#e1f5fe",
        sparkle: "#ffffff",
        sky: "#0d2137",
        yardFloor: "#bbdefb",
        tileRough: 0.22,
        tileMetal: 0.35,
        tileEmissive: "#81d4fa",
        tileEmit: 0.12,
        rim: "#1565c0",
      };
    default:
      return {
        wood: "#8d6e63",
        woodDark: "#6d4c41",
        track: "#faf8f4",
        trackAlt: "#f0e6d8",
        fog: "#c5d8ef",
        ambient: 0.75,
        dirIntensity: 1.5,
        hemiIntensity: 0.4,
        exposure: 1.2,
        ground: "#8bc34a",
        groundRing: "#689f38",
        accent: "#ffcc80",
        sparkle: "#fffde7",
        sky: "#d2effc",
        yardFloor: "#efe6d6",
        tileRough: 0.45,
        tileMetal: 0.05,
        tileEmissive: "#000000",
        tileEmit: 0,
        rim: "#5d4037",
      };
  }
}
