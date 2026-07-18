import { readFileSync } from "fs";
import { join } from "path";
import { authStore } from "../src/auth.js";

const name = readFileSync(join("data", "verify-name.txt"), "utf8").trim();
const reg = authStore.register(name, "test1234");
if (!reg.ok) throw new Error(JSON.stringify(reg));
authStore.syncPlayStats(reg.user.id, 123456, 500, 3);
authStore.saveNow();
console.log("WRITE_OK", name);
