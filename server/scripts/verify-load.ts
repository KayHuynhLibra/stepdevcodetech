import { readFileSync } from "fs";
import { join } from "path";
import { authStore } from "../src/auth.js";

const name = readFileSync(join("data", "verify-name.txt"), "utf8").trim();
const login = authStore.login(name, "test1234");
if (!login.ok) throw new Error(JSON.stringify(login));
if (login.user.balance !== 123456) throw new Error("bad balance " + login.user.balance);
if (login.user.winToday !== 500) throw new Error("bad winToday");
console.log("LOAD_OK", login.user.username, login.user.balance, login.user.winToday);
