import { io } from "socket.io-client";

const socket = io("http://localhost:3001", { transports: ["websocket"] });

let lastPhase = "";
const seen = new Set();

socket.on("connect", () => {
  console.log("connected", socket.id);
  socket.emit("join", { name: "VerifyBot" });
});

socket.on("joined", (p) => console.log("joined", p));

socket.on("state", (s) => {
  if (s.phase !== lastPhase) {
    console.log(
      `phase=${s.phase} remaining≈${Math.ceil((s.phaseEndsAt - s.serverTime) / 1000)}s winning=${s.winningCard} balance=${s.yourBalance} displaySum=${s.displayBets.reduce((a, b) => a + b, 0)}`,
    );
    lastPhase = s.phase;
    seen.add(s.phase);
  }

  if (s.phase === "betting" && (s.yourBets?.every((x) => x === 0) ?? true)) {
    socket.emit("placeBet", { cardId: 1, amount: 500 }, (r) => {
      console.log("bet result", r);
    });
  }

  if (seen.has("betting") && seen.has("revealing") && seen.has("payout")) {
    console.log("FULL_ROUND_OK");
    socket.close();
    process.exit(0);
  }
});

setTimeout(() => {
  console.error("TIMEOUT phases seen:", [...seen]);
  process.exit(1);
}, 45000);
