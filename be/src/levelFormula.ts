/**
 * Công thức level dùng chung mọi "part" (play / couple / …).
 * metricToReach(L) = floor(coef × (L−1)^power)
 * Admin chỉnh coef, power, maxLevel — không hardcode trong feature.
 */

export const LEVEL_MIN = 1;
export const LEVEL_MAX_CAP = 999;

export interface LevelFormula {
  /** Trần cấp (1…999) */
  maxLevel: number;
  /** Hệ số: toReach(L) = coef × (L−1)^power */
  coef: number;
  /** Số mũ (≥ 1) */
  power: number;
}

export const DEFAULT_PLAY_FORMULA: LevelFormula = {
  maxLevel: 99,
  coef: 5,
  power: 2,
};

/** Couple: xu nhẫn — Lv.2 ≈ 1k, Lv.10 ≈ 81k với coef=1000 power=2 */
export const DEFAULT_COUPLE_FORMULA: LevelFormula = {
  maxLevel: 50,
  coef: 1000,
  power: 2,
};

export function clampLevel(level: unknown, maxLevel: number): number {
  const max = Math.max(
    LEVEL_MIN,
    Math.min(LEVEL_MAX_CAP, Math.floor(Number(maxLevel) || 99)),
  );
  const L = Math.floor(Number(level) || LEVEL_MIN);
  if (!Number.isFinite(L)) return LEVEL_MIN;
  return Math.max(LEVEL_MIN, Math.min(max, L));
}

export function normalizeFormula(
  raw: unknown,
  fallback: LevelFormula,
): LevelFormula {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<LevelFormula>;
  const maxLevel = Math.max(
    LEVEL_MIN,
    Math.min(LEVEL_MAX_CAP, Math.floor(Number(r.maxLevel) || fallback.maxLevel)),
  );
  let coef = Number(r.coef);
  if (!Number.isFinite(coef) || coef <= 0) coef = fallback.coef;
  coef = Math.min(1_000_000_000, Math.max(0.0001, coef));
  let power = Number(r.power);
  if (!Number.isFinite(power) || power < 1) power = fallback.power;
  power = Math.min(8, Math.max(1, power));
  return { maxLevel, coef, power };
}

/** Metric (ván / xu) cần để ĐẠT cấp `level`. */
export function metricToReachLevel(
  level: number,
  formula: LevelFormula,
): number {
  const L = clampLevel(level, formula.maxLevel);
  if (L <= 1) return 0;
  const n = L - 1;
  return Math.floor(formula.coef * Math.pow(n, formula.power));
}

export function levelFromMetric(
  metricRaw: unknown,
  formula: LevelFormula,
): number {
  const metric = Math.max(0, Math.floor(Number(metricRaw) || 0));
  let lo = LEVEL_MIN;
  let hi = formula.maxLevel;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi + 1) / 2);
    if (metric >= metricToReachLevel(mid, formula)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface LevelProgress {
  level: number;
  metric: number;
  intoLevel: number;
  needForNext: number;
  ratio: number;
  isMax: boolean;
  maxLevel: number;
}

export function levelProgress(
  metricRaw: unknown,
  formula: LevelFormula,
): LevelProgress {
  const metric = Math.max(0, Math.floor(Number(metricRaw) || 0));
  const level = levelFromMetric(metric, formula);
  const isMax = level >= formula.maxLevel;
  const floor = metricToReachLevel(level, formula);
  const next = isMax ? floor : metricToReachLevel(level + 1, formula);
  const span = Math.max(1, next - floor);
  const intoLevel = Math.max(0, metric - floor);
  const needForNext = isMax ? 0 : Math.max(0, next - metric);
  const ratio = isMax ? 1 : Math.min(1, intoLevel / span);
  return {
    level,
    metric,
    intoLevel,
    needForNext,
    ratio,
    isMax,
    maxLevel: formula.maxLevel,
  };
}

/** Bảng Lv → metric (preview admin / rules). */
export function buildLevelTable(
  formula: LevelFormula,
  upTo?: number,
): { level: number; metric: number }[] {
  const hi = Math.min(
    formula.maxLevel,
    Math.max(1, Math.floor(Number(upTo) || formula.maxLevel)),
  );
  const rows: { level: number; metric: number }[] = [];
  for (let L = 1; L <= hi; L++) {
    rows.push({ level: L, metric: metricToReachLevel(L, formula) });
  }
  return rows;
}
