import { useEffect, useState } from "react";
import { api, type AuthUser } from "../auth";
import type { GameManifest } from "../platform/games";
import { ImageUploadPopup, type CatalogUploadKind } from "./ImageUploadPopup";
import { BottomSheet } from "./BottomSheet";
import { invalidateLudoCosmeticsCache } from "../hooks/useLudoCosmetics";
import { invalidatePlayMediaPresetsCache } from "../hooks/useApplyPlayMediaPresets";
import { SfxAdminPanel } from "./SfxAdminPanel";
import { BoiCosmeticsAdmin } from "./BoiCosmeticsAdmin";
import { LudoCosmeticsAdmin } from "./LudoCosmeticsAdmin";

type GameId = "tarot" | "olympus" | "arcana" | "boi" | "ludo";

const LUDO_PAWN_SLOTS = [
  { id: "red", label: "Đỏ" },
  { id: "green", label: "Xanh lá" },
  { id: "yellow", label: "Vàng" },
  { id: "blue", label: "Xanh dương" },
] as const;

const OLY_SYM_SLOTS = [
  { id: "ruby", label: "Ruby" },
  { id: "sapphire", label: "Sapphire" },
  { id: "emerald", label: "Emerald" },
  { id: "amethyst", label: "Amethyst" },
  { id: "topaz", label: "Topaz" },
  { id: "pearl", label: "Pearl" },
  { id: "crown", label: "Crown" },
  { id: "bolt", label: "Bolt" },
  { id: "zeus", label: "Zeus" },
  { id: "wild", label: "Wild" },
] as const;

type GameMediaPreset = {
  heroUrl?: string;
  zeusHeroUrl?: string;
  coverUrl?: string;
  reduceFx?: boolean;
  symbolStrip?: "icons" | "labels" | "off";
  symbolUrls?: Partial<Record<(typeof OLY_SYM_SLOTS)[number]["id"], string>>;
  boltStyle?: "straight" | "zigzag" | "wave";
  boltThickness?: number;
  boardUrl?: string;
  pawnUrls?: Partial<Record<(typeof LUDO_PAWN_SLOTS)[number]["id"], string>>;
  diceUrl?: string;
  sfx?: {
    masterMuted?: boolean;
    volumes?: Partial<Record<"master" | "ui" | "tarot" | "olympus", number>>;
    muted?: Partial<Record<"ui" | "tarot" | "olympus", boolean>>;
    presetName?: string;
    styles?: Partial<Record<string, string>>;
    paths?: Partial<Record<string, string>>;
  };
};

const GAME_OPTS: { id: GameId; label: string }[] = [
  { id: "tarot", label: "Tarot" },
  { id: "olympus", label: "Olympus" },
  { id: "arcana", label: "Arcana" },
  { id: "boi", label: "Bói bài" },
  { id: "ludo", label: "Ludo" },
];

export function PmAssetsPanel({
  me,
  main,
  onMsg,
  onOpenCosmetics,
}: {
  me: AuthUser | null;
  main: boolean;
  onMsg: (s: string) => void;
  onOpenCosmetics: (userId: string) => void;
}) {
  const [games, setGames] = useState<GameManifest[]>([]);
  const [presets, setPresets] = useState<Partial<Record<GameId, GameMediaPreset>>>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const [coverDraft, setCoverDraft] = useState<Record<string, string>>({});
  const [upload, setUpload] = useState<{
    kind: CatalogUploadKind;
    key: string;
    gameId?: string;
    field?: "cover" | "hero" | "zeus" | "symbol" | "board" | "pawn" | "dice";
    symbolId?: (typeof OLY_SYM_SLOTS)[number]["id"];
    pawnColor?: (typeof LUDO_PAWN_SLOTS)[number]["id"];
  } | null>(null);
  const [optGame, setOptGame] = useState<GameId | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [oracleCards, setOracleCards] = useState<
    { key: string; nameVi: string; image: string; suit?: string }[]
  >([]);

  const load = async () => {
    setBusy(true);
    try {
      const [g, p] = await Promise.all([
        api<{ ok: true; games: GameManifest[] }>("/api/admin/platform/games"),
        api<{
          ok: true;
          games: Partial<Record<GameId, GameMediaPreset>>;
        }>("/api/admin/pm/presets"),
      ]);
      setGames(g.games ?? []);
      setPresets(p.games ?? {});
      const draft: Record<string, string> = {};
      for (const row of g.games ?? []) {
        draft[row.id] = row.coverUrl ?? "";
      }
      setCoverDraft(draft);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi tải P+M");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveCover = async (id: string) => {
    setBusy(true);
    try {
      const r = await api<{ ok: true; games: GameManifest[] }>(
        "/api/admin/platform/games",
        {
          method: "POST",
          body: JSON.stringify({
            id,
            coverUrl: (coverDraft[id] ?? "").trim(),
          }),
        },
      );
      setGames(r.games ?? []);
      onMsg(`Đã lưu cover ${id}`);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi lưu cover");
    } finally {
      setBusy(false);
    }
  };

  const savePreset = async (gameId: GameId, patch: GameMediaPreset) => {
    setBusy(true);
    try {
      const r = await api<{
        ok: true;
        games: Partial<Record<GameId, GameMediaPreset>>;
      }>("/api/admin/pm/presets", {
        method: "POST",
        body: JSON.stringify({ gameId, preset: patch }),
      });
      setPresets(r.games ?? {});
      invalidatePlayMediaPresetsCache();
      if (gameId === "ludo") invalidateLudoCosmeticsCache();
      onMsg(`Đã lưu preset ${gameId}`);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi lưu preset");
    } finally {
      setBusy(false);
    }
  };

  const openGallery = async () => {
    setGalleryOpen(true);
    try {
      const r = await api<{
        ok: true;
        cards: { key: string; nameVi: string; image: string; suit?: string; deckId: string }[];
      }>("/api/oracle/catalog");
      setOracleCards(
        (r.cards ?? []).filter((c) => c.deckId === "tarot"),
      );
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi tải 78 lá");
    }
  };

  const opt = optGame ? presets[optGame] ?? {} : {};

  return (
    <section className="space-y-3">
      <div className="app-panel p-3">
        <p className="play-heading text-sm">P+M · Ảnh & SFX</p>
        <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
          Cover lobby, hero/avatar bàn, preset SFX/FX, Cosmetics.
          {main ? " Mainadmin + role P+M." : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!me || busy}
            onClick={() => me && onOpenCosmetics(me.id)}
            className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
          >
            Cosmetics (self)…
          </button>
          <button
            type="button"
            onClick={() => void openGallery()}
            className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/15"
          >
            Xem 78 lá Tarot
          </button>
        </div>
      </div>

      <SfxAdminPanel
        canEdit={main || !!me}
        onMsg={onMsg}
        presets={presets}
        setPresets={setPresets}
        busy={busy}
        setBusy={setBusy}
      />

      <BoiCosmeticsAdmin canEdit={main || !!me} onMsg={onMsg} />

      <LudoCosmeticsAdmin canEdit={main || !!me} onMsg={onMsg} />

      <div className="app-panel p-3">
        <p className="play-heading text-sm">Ảnh cover lobby</p>
        {busy && !games.length ? (
          <p className="mt-2 text-xs text-[var(--play-muted)]">Đang tải…</p>
        ) : null}
        <ul className="mt-2 space-y-2">
          {games.map((g) => (
            <li
              key={g.id}
              className="flex flex-wrap items-center gap-2 rounded-xl bg-white/70 px-2.5 py-2 text-xs ring-1 ring-[var(--wood-deep)]/10"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--cream)] ring-1 ring-[var(--wood-deep)]/12">
                {g.coverUrl ? (
                  <img
                    src={g.coverUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-[10px] text-[var(--play-muted)]">
                    —
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{g.nameVi}</p>
                <input
                  className="app-input mt-1 w-full !py-1 font-mono !text-[10px]"
                  value={coverDraft[g.id] ?? ""}
                  onChange={(e) =>
                    setCoverDraft((d) => ({ ...d, [g.id]: e.target.value }))
                  }
                  placeholder="/assets/lobby/…"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setUpload({
                      kind: "lobby",
                      key: g.id.slice(0, 40),
                      gameId: g.id,
                      field: "cover",
                    })
                  }
                  className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15"
                >
                  Upload
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveCover(g.id)}
                  className="rounded-full bg-[var(--wood-deep)] px-2.5 py-1 text-[10px] font-bold text-white"
                >
                  Lưu
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setOptGame(
                      (
                        ["tarot", "olympus", "arcana", "boi", "ludo"] as GameId[]
                      ).includes(g.id as GameId)
                        ? (g.id as GameId)
                        : "tarot",
                    )
                  }
                  className="rounded-full bg-amber-900/90 px-2.5 py-1 text-[10px] font-bold text-amber-50"
                >
                  Tối ưu…
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="app-panel p-3">
        <p className="play-heading text-sm">Hero / Zeus per-game</p>
        <ul className="mt-2 space-y-2">
          {GAME_OPTS.map(({ id, label }) => {
            const p = presets[id] ?? {};
            const hero = id === "olympus" ? p.zeusHeroUrl || p.heroUrl : p.heroUrl;
            return (
              <li
                key={id}
                className="rounded-xl bg-white/70 px-2.5 py-2 text-xs ring-1 ring-[var(--wood-deep)]/10"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="h-12 w-12 overflow-hidden rounded-lg bg-[var(--cream)]">
                    {hero ? (
                      <img src={hero} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[9px] text-[var(--play-muted)]">
                        —
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{label}</p>
                    <input
                      className="app-input mt-1 w-full !py-1 font-mono !text-[10px]"
                      value={
                        id === "olympus"
                          ? p.zeusHeroUrl ?? p.heroUrl ?? ""
                          : p.heroUrl ?? ""
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setPresets((prev) => ({
                          ...prev,
                          [id]:
                            id === "olympus"
                              ? { ...prev[id], zeusHeroUrl: v, heroUrl: v }
                              : { ...prev[id], heroUrl: v },
                        }));
                      }}
                      placeholder={
                        id === "olympus"
                          ? "/assets/… zeus hero"
                          : "/assets/… hero"
                      }
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setUpload({
                        kind: id === "olympus" ? "olympus" : "lobby",
                        key: `${id}-hero`,
                        gameId: id,
                        field: id === "olympus" ? "zeus" : "hero",
                      })
                    }
                    className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15"
                  >
                    Upload
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void savePreset(id, {
                        ...(presets[id] ?? {}),
                      })
                    }
                    className="rounded-full bg-[var(--wood-deep)] px-2.5 py-1 text-[10px] font-bold text-white"
                  >
                    Lưu hero
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="app-panel p-3">
        <p className="play-heading text-sm">Olympus · Symbols</p>
        <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
          Icon strip / reel (ruby → zeus / wild). Để trống = SVG mặc định.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {OLY_SYM_SLOTS.map(({ id, label }) => {
            const p = presets.olympus ?? {};
            const url = p.symbolUrls?.[id] || `/assets/olympus/${id}.svg`;
            const custom = !!p.symbolUrls?.[id];
            return (
              <div
                key={id}
                className="rounded-xl bg-white/70 px-2 py-2 text-center text-[10px] ring-1 ring-[var(--wood-deep)]/10"
              >
                <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-[var(--cream)]">
                  <img
                    src={url}
                    alt={label}
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        `/assets/olympus/${id}.svg`;
                    }}
                  />
                </div>
                <p className="font-bold">{label}</p>
                {custom ? (
                  <p className="truncate font-mono text-[8px] text-[var(--play-muted)]">
                    custom
                  </p>
                ) : (
                  <p className="text-[8px] text-[var(--play-muted)]">default</p>
                )}
                <div className="mt-1 flex flex-wrap justify-center gap-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setUpload({
                        kind: "olympus",
                        key: `sym-${id}`,
                        gameId: "olympus",
                        field: "symbol",
                        symbolId: id,
                      })
                    }
                    className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold ring-1 ring-[var(--wood-deep)]/15"
                  >
                    Upload
                  </button>
                  <button
                    type="button"
                    disabled={busy || !custom}
                    onClick={() => {
                      const nextUrls = {
                        ...(presets.olympus?.symbolUrls ?? {}),
                        [id]: "",
                      };
                      void savePreset("olympus", {
                        ...(presets.olympus ?? {}),
                        symbolUrls: nextUrls,
                      });
                    }}
                    className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-40"
                  >
                    Clear
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="app-panel p-3">
        <p className="play-heading text-sm">Olympus · Sấm & SFX</p>
        <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
          Kiểu đường sấm từ Zeus xuống ô (thẳng / zigzag / uốn sóng) + độ đậm.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="text-[10px] font-bold text-[var(--play-muted)]">
            Kiểu sấm
            <select
              className="app-input mt-1 w-full !py-1.5"
              value={(presets.olympus ?? {}).boltStyle ?? "straight"}
              onChange={(e) =>
                setPresets((prev) => ({
                  ...prev,
                  olympus: {
                    ...prev.olympus,
                    boltStyle: e.target.value as GameMediaPreset["boltStyle"],
                  },
                }))
              }
            >
              <option value="straight">Thẳng</option>
              <option value="zigzag">Zigzag sét</option>
              <option value="wave">Uốn sóng</option>
            </select>
          </label>
          <label className="text-[10px] font-bold text-[var(--play-muted)]">
            Độ đậm ({(presets.olympus ?? {}).boltThickness ?? 2})
            <input
              type="range"
              min={1}
              max={8}
              className="mt-2 w-full"
              value={(presets.olympus ?? {}).boltThickness ?? 2}
              onChange={(e) =>
                setPresets((prev) => ({
                  ...prev,
                  olympus: {
                    ...prev.olympus,
                    boltThickness: Number(e.target.value),
                  },
                }))
              }
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void savePreset("olympus", {
              ...(presets.olympus ?? {}),
            })
          }
          className="mt-2 rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-45"
        >
          Lưu sấm Olympus
        </button>
      </div>

      <ImageUploadPopup
        open={!!upload}
        kind={upload?.kind ?? "lobby"}
        itemKey={upload?.key ?? "cover"}
        onClose={() => setUpload(null)}
        onUploaded={(url) => {
          if (!upload) return;
          if (upload.field === "cover" && upload.gameId) {
            setCoverDraft((d) => ({ ...d, [upload.gameId!]: url }));
            void api("/api/admin/platform/games", {
              method: "POST",
              body: JSON.stringify({ id: upload.gameId, coverUrl: url }),
            })
              .then((r) => {
                const snap = r as { games?: GameManifest[] };
                if (snap.games) setGames(snap.games);
                onMsg("Đã upload cover");
              })
              .catch((e) =>
                onMsg(e instanceof Error ? e.message : "Lỗi lưu cover"),
              );
          } else if (upload.gameId && (upload.field === "hero" || upload.field === "zeus")) {
            const gid = upload.gameId as GameId;
            const next: GameMediaPreset = {
              ...(presets[gid] ?? {}),
              ...(upload.field === "zeus"
                ? { zeusHeroUrl: url, heroUrl: url }
                : { heroUrl: url }),
            };
            setPresets((prev) => ({ ...prev, [gid]: next }));
            void savePreset(gid, next);
          } else if (
            upload.field === "symbol" &&
            upload.symbolId &&
            upload.gameId === "olympus"
          ) {
            const next: GameMediaPreset = {
              ...(presets.olympus ?? {}),
              symbolUrls: {
                ...(presets.olympus?.symbolUrls ?? {}),
                [upload.symbolId]: url,
              },
            };
            setPresets((prev) => ({ ...prev, olympus: next }));
            void savePreset("olympus", next);
          } else if (upload.field === "board" && upload.gameId === "ludo") {
            const next: GameMediaPreset = {
              ...(presets.ludo ?? {}),
              boardUrl: url,
            };
            setPresets((prev) => ({ ...prev, ludo: next }));
            void savePreset("ludo", next);
          } else if (
            upload.field === "pawn" &&
            upload.pawnColor &&
            upload.gameId === "ludo"
          ) {
            const next: GameMediaPreset = {
              ...(presets.ludo ?? {}),
              pawnUrls: {
                ...(presets.ludo?.pawnUrls ?? {}),
                [upload.pawnColor]: url,
              },
            };
            setPresets((prev) => ({ ...prev, ludo: next }));
            void savePreset("ludo", next);
          } else if (upload.field === "dice" && upload.gameId === "ludo") {
            const next: GameMediaPreset = {
              ...(presets.ludo ?? {}),
              diceUrl: url,
            };
            setPresets((prev) => ({ ...prev, ludo: next }));
            void savePreset("ludo", next);
          }
          setUpload(null);
        }}
      />

      <BottomSheet
        open={!!optGame}
        onClose={() => setOptGame(null)}
        title={optGame ? `Tối ưu · ${optGame}` : "Tối ưu"}
      >
        {optGame ? (
          <div className="space-y-3 p-1 text-xs">
            <label className="flex items-center justify-between gap-2">
              <span>Giảm FX ngoài deck</span>
              <input
                type="checkbox"
                checked={!!opt.reduceFx}
                onChange={(e) =>
                  setPresets((prev) => ({
                    ...prev,
                    [optGame]: { ...prev[optGame], reduceFx: e.target.checked },
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold text-[var(--play-muted)]">
                Symbol strip
              </span>
              <select
                className="app-input mt-1 w-full !py-1.5"
                value={opt.symbolStrip ?? "icons"}
                onChange={(e) =>
                  setPresets((prev) => ({
                    ...prev,
                    [optGame]: {
                      ...prev[optGame],
                      symbolStrip: e.target.value as GameMediaPreset["symbolStrip"],
                    },
                  }))
                }
              >
                <option value="icons">Icons</option>
                <option value="labels">Labels</option>
                <option value="off">Off</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-2">
              <span>Mute master SFX</span>
              <input
                type="checkbox"
                checked={!!opt.sfx?.masterMuted}
                onChange={(e) =>
                  setPresets((prev) => ({
                    ...prev,
                    [optGame]: {
                      ...prev[optGame],
                      sfx: {
                        ...prev[optGame]?.sfx,
                        masterMuted: e.target.checked,
                      },
                    },
                  }))
                }
              />
            </label>
            {(
              [
                ["ui", "UI"],
                ["tarot", "Tarot"],
                ["olympus", "Olympus"],
              ] as const
            ).map(([ch, label]) => (
              <div key={ch} className="flex items-center gap-2">
                <span className="w-16 shrink-0 font-semibold">{label}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={opt.sfx?.volumes?.[ch] ?? 80}
                  onChange={(e) =>
                    setPresets((prev) => ({
                      ...prev,
                      [optGame]: {
                        ...prev[optGame],
                        sfx: {
                          ...prev[optGame]?.sfx,
                          volumes: {
                            ...prev[optGame]?.sfx?.volumes,
                            [ch]: Number(e.target.value),
                          },
                        },
                      },
                    }))
                  }
                  className="flex-1"
                />
                <label className="flex items-center gap-1 text-[10px]">
                  <input
                    type="checkbox"
                    checked={!!opt.sfx?.muted?.[ch]}
                    onChange={(e) =>
                      setPresets((prev) => ({
                        ...prev,
                        [optGame]: {
                          ...prev[optGame],
                          sfx: {
                            ...prev[optGame]?.sfx,
                            muted: {
                              ...prev[optGame]?.sfx?.muted,
                              [ch]: e.target.checked,
                            },
                          },
                        },
                      }))
                    }
                  />
                  mute
                </label>
              </div>
            ))}
            <label className="block">
              <span className="text-[10px] font-bold text-[var(--play-muted)]">
                Preset tên (synth)
              </span>
              <input
                className="app-input mt-1 w-full !py-1.5"
                value={opt.sfx?.presetName ?? ""}
                onChange={(e) =>
                  setPresets((prev) => ({
                    ...prev,
                    [optGame]: {
                      ...prev[optGame],
                      sfx: {
                        ...prev[optGame]?.sfx,
                        presetName: e.target.value,
                      },
                    },
                  }))
                }
                placeholder="default / soft / punchy"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void savePreset(optGame, presets[optGame] ?? {});
                setOptGame(null);
              }}
              className="w-full rounded-full bg-[var(--wood-deep)] py-2 text-[12px] font-bold text-white"
            >
              Lưu tối ưu {optGame}
            </button>
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        title="78 lá Tarot"
      >
        <div className="grid max-h-[60vh] grid-cols-4 gap-2 overflow-y-auto p-1 sm:grid-cols-6">
          {oracleCards.map((c) => (
            <div
              key={c.key}
              className="overflow-hidden rounded-lg bg-white ring-1 ring-[var(--wood-deep)]/12"
            >
              <div className="aspect-[5/7] bg-[var(--cream)]">
                <img
                  src={c.image}
                  alt={c.nameVi}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.opacity = "0.2";
                  }}
                />
              </div>
              <p className="truncate px-1 py-0.5 text-center text-[9px] font-semibold">
                {c.nameVi}
              </p>
            </div>
          ))}
        </div>
      </BottomSheet>
    </section>
  );
}
