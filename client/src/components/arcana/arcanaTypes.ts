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
  profit: number;
  seed: string;
  at?: number;
}
