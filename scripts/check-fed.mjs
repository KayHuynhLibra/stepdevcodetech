/**
 * Kiểm tra Fed/App: npx tsx scripts/check-fed.mjs
 * Cầu: #1=1000 (x5), #8=5000 (x20) → lời max ở lá không ai đánh (#2–#7).
 */
import {
  pickWinningCard,
  houseProfitByCard,
  cardProbabilities,
} from "../server/src/cards.ts";

const bets = [1000, 0, 0, 0, 0, 0, 0, 5000];
const profits = houseProfitByCard(bets);
console.log(
  "profits by card:",
  profits.map((p, i) => `#${i + 1}=${Math.round(p)}`).join(" "),
);

const fedPicks = new Set();
for (let i = 0; i < 80; i++) fedPicks.add(pickWinningCard("fed", bets));
console.log("fed picks (expect among #2–#7, never #8):", [...fedPicks].sort());

console.log(
  "fed probs:",
  cardProbabilities("fed", bets)
    .filter((p) => p.percent > 0)
    .map((p) => `#${p.cardId}:${p.percent}% app+${p.houseProfit}`)
    .join(" | "),
);

const appPicks = {};
for (let i = 0; i < 300; i++) {
  const id = pickWinningCard("app", bets);
  appPicks[id] = (appPicks[id] || 0) + 1;
}
console.log("app soft distribution (300):", appPicks);
