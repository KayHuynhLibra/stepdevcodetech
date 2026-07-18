/**
 * Đăng ký/login 3 user giả, giữ Socket.IO join và tự đặt cược khi đang betting.
 * Chạy: node scripts/fake-players.mjs
 * Dừng: Ctrl+C
 */
import { io } from "socket.io-client";

const BASE = process.env.API_URL || "http://localhost:3001";
const PASSWORD = "pass1234";
const USERS = [
  { username: "fake_player1", cardId: 1, amount: 1000 },
  { username: "fake_player2", cardId: 3, amount: 2000 },
  { username: "fake_player3", cardId: 5, amount: 1500 },
];

async function registerOrLogin(username) {
  for (const path of ["/api/auth/register", "/api/auth/login"]) {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: PASSWORD }),
    });
    const data = await res.json();
    if (data.ok && data.token) return data;
  }
  throw new Error(`Không đăng nhập được: ${username}`);
}

function connectPlayer(username, token, prefer) {
  const socket = io(BASE, { transports: ["websocket"], autoConnect: true });
  let lastRound = null;
  let betPlaced = false;

  socket.on("connect", () => {
    console.log(`[${username}] connected ${socket.id}`);
    socket.emit("join", { name: username, token });
  });

  socket.on("joined", (j) => {
    console.log(
      `[${username}] joined room · balance=${j.balance} · userId=${j.userId}`,
    );
  });

  socket.on("state", (state) => {
    if (!state) return;
    if (state.roundId !== lastRound) {
      lastRound = state.roundId;
      betPlaced = false;
      console.log(
        `[${username}] round #${state.roundId} phase=${state.phase} balance=${state.yourBalance}`,
      );
    }
    if (state.phase === "betting" && !betPlaced) {
      betPlaced = true;
      const cardId = prefer.cardId;
      const amount = prefer.amount;
      socket.emit("placeBet", { cardId, amount }, (r) => {
        if (r?.ok) {
          console.log(
            `[${username}] BET card=${cardId} amount=${amount} → balance=${r.balance}`,
          );
        } else {
          console.log(`[${username}] bet rejected: ${r?.reason ?? "unknown"}`);
          betPlaced = false;
        }
      });
    }
  });

  socket.on("betRejected", (e) => {
    console.log(`[${username}] betRejected: ${e?.reason}`);
    betPlaced = false;
  });

  socket.on("disconnect", (reason) => {
    console.log(`[${username}] disconnect: ${reason}`);
  });

  return socket;
}

const sockets = [];

async function main() {
  console.log(`→ Fake players → ${BASE}`);
  for (const u of USERS) {
    const auth = await registerOrLogin(u.username);
    console.log(
      `✓ ${u.username} (${auth.user.code}) token=${auth.token.slice(0, 8)}… balance=${auth.user.balance}`,
    );
    sockets.push(connectPlayer(u.username, auth.token, u));
  }
  console.log("3 user giả đang online & sẽ cược mỗi vòng. Giữ process này mở.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
