/** European roulette layout — shared with Arcana double-wheel UI. */

export const EU_WHEEL_ORDER: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;

const RED_SET = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export type OuterEvenMoneyPick = "red" | "black" | "odd" | "even";

export function isRed(n: number): boolean {
  return RED_SET.has(n);
}

export function isBlack(n: number): boolean {
  return n !== 0 && !RED_SET.has(n);
}

export function pocketColor(n: number): "green" | "red" | "black" {
  if (n === 0) return "green";
  return isRed(n) ? "red" : "black";
}

export function pocketHex(n: number): string {
  const c = pocketColor(n);
  if (c === "green") return "#0d5c2e";
  if (c === "red") return "#8b1a1a";
  return "#141414";
}

export function outerIndexOnWheel(n: number): number {
  const i = EU_WHEEL_ORDER.indexOf(n);
  return i >= 0 ? i : 0;
}

export function outerPickLabelVi(pick: OuterEvenMoneyPick): string {
  switch (pick) {
    case "red":
      return "Đỏ";
    case "black":
      return "Đen";
    case "odd":
      return "Lẻ";
    case "even":
      return "Chẵn";
  }
}
