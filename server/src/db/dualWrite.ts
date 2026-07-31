/**
 * Dual-write adapters: JSON remains source of truth until PG cutover.
 * When DATABASE_URL is set, mirror hot rows asynchronously (fire-and-forget).
 */
import { dbQuery, isDbEnabled } from "./pool.js";

const dualWriteOn = () =>
  isDbEnabled() &&
  String(process.env.SCALE_DUAL_WRITE ?? "1").trim() !== "0";

function logDw(err: unknown, label: string) {
  console.warn(
    `[dual-write:${label}]`,
    err instanceof Error ? err.message : err,
  );
}

export function dualWriteUserSnapshot(user: {
  id: string;
  username: string;
  code?: string;
  role?: string;
  balance?: number;
  gem?: number;
  [k: string]: unknown;
}): void {
  if (!dualWriteOn()) return;
  const payload = { ...user };
  void dbQuery(
    `INSERT INTO users_snapshot (id, username, code, role, balance, gem, payload, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,NOW())
     ON CONFLICT (id) DO UPDATE SET
       username = EXCLUDED.username,
       code = EXCLUDED.code,
       role = EXCLUDED.role,
       balance = EXCLUDED.balance,
       gem = EXCLUDED.gem,
       payload = EXCLUDED.payload,
       updated_at = NOW()`,
    [
      String(user.id),
      String(user.username ?? ""),
      user.code ?? null,
      user.role ?? null,
      Math.floor(Number(user.balance) || 0),
      Math.floor(Number(user.gem) || 0),
      JSON.stringify(payload),
    ],
  ).catch((e) => logDw(e, "user"));
}

export function dualWriteVaultLedgerEntry(entry: {
  id: string;
  vaultKey?: string;
  at?: number;
  kind: string;
  amount: number;
  balanceAfter?: number;
  userId?: string;
  byUsername?: string;
  note?: string;
  [k: string]: unknown;
}): void {
  if (!dualWriteOn()) return;
  void dbQuery(
    `INSERT INTO vault_ledger
      (id, vault_key, at, kind, amount, balance_after, user_id, by_username, note, payload)
     VALUES ($1,$2,to_timestamp($3/1000.0),$4,$5,$6,$7,$8,$9,$10::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [
      String(entry.id),
      entry.vaultKey ?? "tarot",
      entry.at ?? Date.now(),
      String(entry.kind),
      Math.floor(Number(entry.amount) || 0),
      entry.balanceAfter != null
        ? Math.floor(Number(entry.balanceAfter))
        : null,
      entry.userId ?? null,
      entry.byUsername ?? null,
      entry.note ?? null,
      JSON.stringify(entry),
    ],
  ).catch((e) => logDw(e, "vault"));
}

export function dualWriteStake(entry: {
  id: string;
  at?: number;
  userId?: string;
  username?: string;
  round?: number;
  cardId?: number;
  amount?: number;
  result?: string;
  payout?: number;
  profit?: number;
  winningCardId?: number;
}): void {
  if (!dualWriteOn()) return;
  void dbQuery(
    `INSERT INTO stakes
      (id, at, user_id, username, round, card_id, amount, result, payout, profit, winning_card_id, payload)
     VALUES ($1,to_timestamp($2/1000.0),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [
      String(entry.id),
      entry.at ?? Date.now(),
      entry.userId ?? null,
      entry.username ?? null,
      entry.round ?? null,
      entry.cardId ?? null,
      Math.floor(Number(entry.amount) || 0),
      entry.result ?? null,
      entry.payout != null ? Math.floor(Number(entry.payout)) : null,
      entry.profit != null ? Math.floor(Number(entry.profit)) : null,
      entry.winningCardId ?? null,
      JSON.stringify(entry),
    ],
  ).catch((e) => logDw(e, "stake"));
}

export async function dualWriteOracleDraw(row: {
  id: string;
  userId: string;
  deckId: string;
  spread: string;
  cards: unknown;
  question?: string | null;
  notes?: string | null;
  title?: string | null;
  at?: number;
}): Promise<void> {
  if (!dualWriteOn()) return;
  await dbQuery(
    `INSERT INTO oracle_draws (id, user_id, deck_id, spread, cards, question, notes, title, at)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,to_timestamp($9/1000.0))
     ON CONFLICT (id) DO UPDATE SET
       notes = COALESCE(EXCLUDED.notes, oracle_draws.notes),
       title = COALESCE(EXCLUDED.title, oracle_draws.title),
       question = COALESCE(EXCLUDED.question, oracle_draws.question)`,
    [
      row.id,
      row.userId,
      row.deckId,
      row.spread,
      JSON.stringify(row.cards),
      row.question ?? null,
      row.notes ?? null,
      row.title ?? null,
      row.at ?? Date.now(),
    ],
  ).catch((e) => logDw(e, "oracle_draw"));
}

export async function dualWriteOracleDrawPatch(row: {
  id: string;
  userId: string;
  notes?: string | null;
  title?: string | null;
}): Promise<void> {
  if (!dualWriteOn()) return;
  await dbQuery(
    `UPDATE oracle_draws SET
       notes = COALESCE($3, notes),
       title = COALESCE($4, title)
     WHERE id = $1 AND user_id = $2`,
    [row.id, row.userId, row.notes ?? null, row.title ?? null],
  ).catch((e) => logDw(e, "oracle_draw_patch"));
}
