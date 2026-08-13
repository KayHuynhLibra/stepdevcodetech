import fs from "node:fs";

const path = "fe/src/pages/AdminDashboard.tsx";
let src = fs.readFileSync(path, "utf8");
const before = src.split(/\r?\n/).length;

// Remove formatGem import if unused
src = src.replace(/import \{ formatGem \} from "\.\.\/gem";\n/, "");

// Simplify filteredUsers (rolead only uses text filter)
src = src.replace(
  `  const filteredUsers = data.users.filter((u) => {
    if (userQuick === "vip" && !u.isVip) return false;
    if (userQuick === "banned" && !u.banned) return false;
    if (userQuick === "muted" && !u.muted) return false;
    const q = userFilter.trim().toLowerCase();
    if (!q) return true;
    return \`\${u.username} \${u.code} \${u.id} \${u.role} \${u.cultivationRank ?? ""}\`
      .toLowerCase()
      .includes(q);
  });`,
  `  const filteredUsers = data.users.filter((u) => {
    const q = userFilter.trim().toLowerCase();
    if (!q) return true;
    return \`\${u.username} \${u.code} \${u.id} \${u.role} \${u.cultivationRank ?? ""}\`
      .toLowerCase()
      .includes(q);
  });`,
);

const stateBlocks = [
  /  const \[botCount, setBotCount\] = useState\(25\);\n/,
  /  const \[winBiasDraft, setWinBiasDraft\] = useState\("0"\);\n  const \[vaultLinkDraft, setVaultLinkDraft\] = useState\(\{[\s\S]*?\}\);\n/,
  /  const \[vaultFlagsDraft, setVaultFlagsDraft\] = useState<VaultInterFlags>\(\{[\s\S]*?\}\);\n  const \[vaultFlagsBusy, setVaultFlagsBusy\] = useState\(false\);\n/,
  /  const \[vaultLedgerFilter, setVaultLedgerFilter\] = useState<string>\("all"\);\n  const \[vaultRowDetail, setVaultRowDetail\] = useState<VaultLedgerRow \| null>\(\n    null,\n  \);\n/,
  /  const \[adjust, setAdjust\] = useState<\{[\s\S]*?\}\>\(\{ userId: "", delta: "", lane: "play" \}\);\n/,
  /  const \[guestAdjust, setGuestAdjust\] = useState<\{ key: string; delta: string \}>\(\n    \{ key: "", delta: "" \},\n  \);\n/,
  /  const \[vaultDelta, setVaultDelta\] = useState\("10000"\);\n  const \[vaultSet, setVaultSet\] = useState\(""\);\n  const \[vaultNote, setVaultNote\] = useState\(""\);\n  const \[vaultUser, setVaultUser\] = useState\(\{[\s\S]*?\}\);\n/,
  /  const \[interBusy, setInterBusy\] = useState\(false\);\n  const \[interSubTab, setInterSubTab\] = useState<"live" \| "room" \| "userWin">\(\n    "live",\n  \);\n  const \[interLive, setInterLive\] = useState<\{[\s\S]*?\} \| null>\(null\);\n  const \[interLiveBusy, setInterLiveBusy\] = useState\(false\);\n/,
  /  const \[winPctDrafts, setWinPctDrafts\] = useState<Record<string, string>>\(\{\}\);\n  const \[winPctFilter, setWinPctFilter\] = useState\(""\);\n  const \[allSlotMinutes, setAllSlotMinutes\] = useState\("5"\);\n  const \[rotationDraft, setRotationDraft\] = useState<RotateStep\[\]>\(\[[\s\S]*?\]\);\n  const \[rotationAddMode, setRotationAddMode\] = useState<RotateStep>\("auto"\);\n/,
  /  const \[codeDrafts, setCodeDrafts\] = useState<Record<string, string>>\(\{\}\);\n  const \[codeBusyId, setCodeBusyId\] = useState<string \| null>\(null\);\n/,
  /  const \[userQuick, setUserQuick\] = useState<\n    "all" \| "vip" \| "banned" \| "muted"\n  >\("all"\);\n/,
];

for (const re of stateBlocks) {
  src = src.replace(re, "");
}

// load() cleanup
src = src.replace(/    setBotCount\(overview\.stats\.botTarget\);\n/, "");
src = src.replace(
  /    if \(overview\.inter\?\.winBiasPct != null\) \{[\s\S]*?      \}\);\n    \}\n    const activeVault = pickVault/,
  "    const activeVault = pickVault",
);
src = src.replace(
  /    const activeVault = pickVault\(managedGame, overview\);\n    if \(activeVault\) \{[\s\S]*?        \);\n      \}\n    \}\n/,
  "",
);

// inter useEffects and helpers
src = src.replace(
  /  useEffect\(\(\) => \{\n    if \(data\?\.inter\?\.allSlotMinutes != null\) \{[\s\S]*?  \}, \[data\?\.inter\?\.allSlotMinutes\]\);\n\n  useEffect\(\(\) => \{\n    const r = data\?\.inter\?\.allRotation;[\s\S]*?  \}, \[data\?\.inter\?\.allRotation\]\);\n\n  function isRotateStep[\s\S]*?  \}, \[data\?\.inter\?\.rotateCatalog\]\);\n\n  \/\/ ALL \/ Bộ mode[\s\S]*?  \}, \[tab, data\?\.inter\?\.mode, load\]\);\n\n/,
  "",
);
src = src.replace(
  /  const loadInterLive = useCallback\(async \(\) => \{[\s\S]*?  \}, \[tab, interSubTab, me, loadInterLive\]\);\n\n/,
  "",
);

const fnBlocks = [
  /  const applyBots = async \(\) => \{[\s\S]*?  \};\n\n  const applyAdjust[\s\S]*?  \};\n\n  const applyGuestAdjust[\s\S]*?  \};\n\n/,
  /  const setUserOutcome = async \([\s\S]*?  \};\n\n  const setUserWinPct = async \([\s\S]*?  \};\n\n  const setUserVip = async \([\s\S]*?  \};\n\n  const setUserCode = async \([\s\S]*?  \};\n\n/,
  /  const saveWinBiasAndVaultLink = async \(\) => \{[\s\S]*?  \};\n\n  const saveVaultInterFlags = async \(\) => \{[\s\S]*?  \};\n\n/,
  /  const setUserBan = async \(userId: string, banned: boolean\) => \{[\s\S]*?  \};\n\n/,
  /  const setUserMute = async \(\n    userId: string,[\s\S]*?  \};\n\n/,
  /  const vaultAdjust = async \(delta: number\) => \{[\s\S]*?  \};\n\n  const vaultSetBalance = async \(e: FormEvent\) => \{[\s\S]*?  \};\n\n  const vaultGrant = async \(\) => \{[\s\S]*?  \};\n\n  const interModeLabel = \(mode: string\) => \{[\s\S]*?  \};\n\n  const setInterMode = async \(mode: InterMode\) => \{[\s\S]*?  \};\n\n  const setInterPrimaryTier = async \(tier: "mode1" \| "mode2" \| "mode3"\) => \{[\s\S]*?  \};\n\n  const applyAllSlotMinutes = async \(\) => \{[\s\S]*?  \};\n\n  const saveAllRotation = async \(\) => \{[\s\S]*?  \};\n\n  const resetAllRotationDefault = async \(\) => \{[\s\S]*?  \};\n\n  const moveRotationStep = \(index: number, dir: -1 \| 1\) => \{[\s\S]*?  \};\n\n  const removeRotationStep = \(index: number\) => \{[\s\S]*?  \};\n\n  const addRotationStep = \(\) => \{[\s\S]*?  \};\n\n  const vaultSeize = async \(\) => \{[\s\S]*?  \};\n\n/,
];

for (const re of fnBlocks) {
  src = src.replace(re, "");
}

fs.writeFileSync(path, src);
const after = src.split(/\r?\n/).length;
console.log(`Cleanup: ${before} -> ${after} lines (${before - after} removed)`);
