import fs from "node:fs";

const path = "fe/src/pages/AdminDashboard.tsx";
let src = fs.readFileSync(path, "utf8");
const lines = src.split(/\r?\n/);
const originalLineCount = lines.length;

function replaceRange(start, end, replacement) {
  const before = lines.slice(0, start - 1);
  const after = lines.slice(end);
  lines.splice(0, lines.length, ...before, ...replacement, ...after);
}

const lazyImports = `const LazyUsersAdminPanel = lazy(() =>
  import("../components/admin/panels/UsersAdminPanel").then((m) => ({
    default: m.UsersAdminPanel,
  })),
);
const LazyInterAdminPanel = lazy(() =>
  import("../components/admin/panels/InterAdminPanel").then((m) => ({
    default: m.InterAdminPanel,
  })),
);
const LazyVaultAdminPanel = lazy(() =>
  import("../components/admin/panels/VaultAdminPanel").then((m) => ({
    default: m.VaultAdminPanel,
  })),
);`;

if (!src.includes("LazyUsersAdminPanel")) {
  src = src.replace(
    "const LazyMessAdminPanel = lazy(() =>\n  import(\"../components/MessAdminPanel\").then((m) => ({\n    default: m.MessAdminPanel,\n  })),\n);",
    `const LazyMessAdminPanel = lazy(() =>
  import("../components/MessAdminPanel").then((m) => ({
    default: m.MessAdminPanel,
  })),
);
${lazyImports}`,
  );
  lines.splice(0, lines.length, ...src.split(/\r?\n/));
}

const panelFallback = (label) => `        <p className="mt-4 text-[11px] text-[var(--play-muted)]">
          Đang tải ${label}…
        </p>`;

replaceRange(
  5428,
  5897,
  [
    `      {tab === "users" && (`,
    `        <Suspense`,
    `          fallback={`,
    panelFallback("User & Bot"),
    `          }`,
    `        >`,
    `          <LazyUsersAdminPanel`,
    `            users={data.users}`,
    `            liveGuests={data.liveGuests}`,
    `            me={me}`,
    `            botTarget={data.stats.botTarget}`,
    `            onMsg={setMsg}`,
    `            onReload={load}`,
    `            onOpenPwReset={openPwReset}`,
    `            onMeUpdate={setMe}`,
    `          />`,
    `        </Suspense>`,
    `      )}`,
  ],
);

// Line numbers shifted - recalculate inter and vault
src = lines.join("\n");
const interStart = src.indexOf('{tab === "inter" && canInter');
const interEnd = src.indexOf('{tab === "vault" && canVault');
if (interStart === -1 || interEnd === -1) {
  throw new Error("Could not find inter/vault blocks");
}
const beforeInter = src.slice(0, interStart);
const afterInter = src.slice(interEnd);
const interReplacement = `{tab === "inter" && canInter && data.inter && (
        <Suspense
          fallback={
${panelFallback("Inter")}
          }
        >
          <LazyInterAdminPanel
            inter={data.inter}
            users={data.users}
            vault={data.vault}
            vaultArcana={data.vaultArcana}
            me={me}
            active={tab === "inter"}
            onMsg={setMsg}
            onReload={load}
          />
        </Suspense>
      )}

      `;
src = beforeInter + interReplacement + afterInter;

const vaultStart = src.indexOf('{tab === "vault" && canVault');
const vaultEnd = src.indexOf('{tab === "arcana" && canArcanaCfg');
if (vaultStart === -1 || vaultEnd === -1) {
  throw new Error("Could not find vault block");
}
const beforeVault = src.slice(0, vaultStart);
const afterVault = src.slice(vaultEnd);
const vaultReplacement = `{tab === "vault" && canVault && activeVault && (
        <Suspense
          fallback={
${panelFallback("Kho")}
          }
        >
          <LazyVaultAdminPanel
            activeVault={activeVault}
            managedGame={managedGame}
            users={data.users}
            onMsg={setMsg}
            onReload={load}
          />
        </Suspense>
      )}

      `;
src = beforeVault + vaultReplacement + afterVault;

// Remove vaultRowDetail modal
src = src.replace(
  /\n      \{vaultRowDetail && \([\s\S]*?\n      \)\}\n\n      <ImageUploadPopup/,
  "\n      <ImageUploadPopup",
);

fs.writeFileSync(path, src);
const newLineCount = src.split(/\r?\n/).length;
console.log(`AdminDashboard: ${originalLineCount} -> ${newLineCount} lines (${originalLineCount - newLineCount} removed)`);
