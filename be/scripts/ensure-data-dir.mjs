/**
 * Railway legacy volume was /app/server/data.
 * After be/ rename, stores read /app/be/data.
 * If legacy still has JSON and be/data does not, link/copy so prod xu/users survive.
 */
import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, symlinkSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const beData = join(__dirname, "..", "data");
const legacy = join(__dirname, "..", "..", "server", "data");

function hasJson(dir) {
  try {
    return readdirSync(dir).some((f) => f.endsWith(".json"));
  } catch {
    return false;
  }
}

if (hasJson(beData)) {
  console.log("[data] using", beData);
  process.exit(0);
}

if (!hasJson(legacy)) {
  mkdirSync(beData, { recursive: true });
  console.log("[data] created empty", beData);
  process.exit(0);
}

try {
  if (existsSync(beData)) {
    const st = lstatSync(beData);
    if (st.isSymbolicLink() || st.isDirectory()) {
      rmSync(beData, { recursive: true, force: true });
    }
  }
  symlinkSync(legacy, beData, "dir");
  console.log("[data] linked", beData, "->", legacy);
} catch (err) {
  console.error("[data] link failed", err);
  process.exit(1);
}
