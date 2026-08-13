/**
 * Brand + localStorage helpers.
 * Product name: SOFIA (formerly SOFIAORE). Storage keys migrated from sofiaore_*.
 */

export const BRAND = "SOFIA";
export const BRAND_PRODUCT = "SOFIA-TAROT";

/** Read key; if missing, copy from legacy sofiaore_* once. */
export function brandLsGet(key: string): string | null {
  try {
    const cur = localStorage.getItem(key);
    if (cur != null) return cur;
    if (key.startsWith("sofia_")) {
      const legacy = "sofiaore_" + key.slice("sofia_".length);
      const old = localStorage.getItem(legacy);
      if (old != null) {
        localStorage.setItem(key, old);
        return old;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function brandLsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function brandLsRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
