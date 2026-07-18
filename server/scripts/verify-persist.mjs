import { spawnSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const name = "persist_" + Date.now().toString(36).slice(-8);
const dataPath = join(root, "data", "users.json");
writeFileSync(join(root, "data", "verify-name.txt"), name, "utf8");

function run(label, file) {
  const r = spawnSync("npx", ["tsx", file], {
    cwd: root,
    encoding: "utf8",
    shell: true,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  if (r.status !== 0) {
    console.error(`[${label}] failed`, out);
    process.exit(r.status ?? 1);
  }
  console.log(`[${label}]`, out.trim());
}

run("write", "scripts/verify-write.ts");
run("load", "scripts/verify-load.ts");

if (!existsSync(dataPath)) throw new Error("missing users.json");
const file = JSON.parse(readFileSync(dataPath, "utf8"));
const row = file.users.find((u) => u.username === name);
if (!row || row.balance !== 123456) throw new Error("file row missing/bad");
console.log("VERIFY_PASS", { name, users: file.users.length });
