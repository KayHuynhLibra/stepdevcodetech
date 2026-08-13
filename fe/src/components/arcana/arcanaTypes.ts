export type OuterEvenMoneyPick = "red" | "black" | "odd" | "even";

export interface SpinResult {
  id: string;
  stake: number;
  pickId: number;
  pickIds: number[];
  winId: number;
  ratio: number;
  won: boolean;
  payout: number;
  payoutBase?: number;
  streakBonusPercent?: number;
  streakBefore?: number;
  streakAfter?: number;
  nearMiss?: boolean;
  wheelDisplayWinId?: number;
  missionCompleted?: boolean;
  usedBonusSpin?: boolean;
  outerNumber?: number;
  outerPick?: OuterEvenMoneyPick;
  outerWon?: boolean;
  outerPayout?: number;
  arcanaPayout?: number;
  arcanaStake?: number;
  outerStake?: number;
  profit: number;
  seed: string;
  at?: number;
}
