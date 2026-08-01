import type { LudoViewMode } from "./cosmeticsCatalog";
import { isLudoViewMode } from "./cosmeticsCatalog";

const STORAGE_KEY = "ludo_view_mode_v1";

/** Local override; null = follow admin cosmetics.viewMode */
export function readLudoViewModeOverride(): LudoViewMode | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "") return null;
    if (isLudoViewMode(v)) return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeLudoViewModeOverride(mode: LudoViewMode | null): void {
  try {
    if (mode == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function resolveViewMode(
  adminDefault: LudoViewMode | undefined,
  override: LudoViewMode | null,
): LudoViewMode {
  return override ?? adminDefault ?? "orbit";
}
