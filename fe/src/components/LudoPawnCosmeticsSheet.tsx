import { useCallback, useEffect, useState } from "react";
import { getToken } from "../auth";
import { BottomSheet } from "./BottomSheet";
import {
  LUDO_THEMES,
  themeSeatColors,
  normalizeThemeId,
  type LudoThemeId,
} from "../platform/ludo/themes";
import { pawnDecorClass, pawnDecorGlyph } from "../platform/ludo/pawnDecorVisual";

export type LudoDecorItem = {
  id: string;
  nameVi: string;
  kind: "frame" | "pawn" | "board";
  priceXu: number;
  cssClass: string;
  themeId?: LudoThemeId;
  freeStarter?: boolean;
};

type ShopSnap = {
  catalog: LudoDecorItem[];
  ownedIds: string[];
  equippedFrame: string | null;
  equippedPawn: string | null;
  equippedBoard: string | null;
  balance: number;
};

type Tab = "pawn" | "frame" | "board";

export function LudoPawnCosmeticsSheet({
  open,
  onClose,
  usingLite,
  roomId,
  loggedIn,
  themeId = "classic",
  onApplied,
  onBoardEquipped,
}: {
  open: boolean;
  onClose: () => void;
  usingLite: boolean;
  roomId?: string | null;
  loggedIn: boolean;
  themeId?: string;
  onApplied?: (room?: unknown) => void;
  /** Hub: after equip/buy board, select that theme. */
  onBoardEquipped?: (themeId: LudoThemeId) => void;
}) {
  const [tab, setTab] = useState<Tab>("pawn");
  const [snap, setSnap] = useState<ShopSnap | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!loggedIn) {
      setSnap(null);
      return;
    }
    const token = getToken();
    const r = await fetch("/api/ludo/shop", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const j = await r.json();
    if (j.ok) {
      setSnap({
        catalog: j.catalog || [],
        ownedIds: j.ownedIds || [],
        equippedFrame: j.equippedFrame,
        equippedPawn: j.equippedPawn,
        equippedBoard: j.equippedBoard ?? "board-classic",
        balance: j.balance ?? 0,
      });
      setErr(null);
    } else {
      setErr(j.reason || "Không tải shop");
    }
  }, [loggedIn]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const authHeaders = (): HeadersInit => {
    const token = getToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const applySnap = (j: Record<string, unknown>) => {
    setSnap({
      catalog: (j.catalog as LudoDecorItem[]) || snap?.catalog || [],
      ownedIds: (j.ownedIds as string[]) || [],
      equippedFrame: (j.equippedFrame as string) ?? null,
      equippedPawn: (j.equippedPawn as string) ?? null,
      equippedBoard: (j.equippedBoard as string) ?? "board-classic",
      balance: (j.balance as number) ?? snap?.balance ?? 0,
    });
  };

  const buy = async (itemId: string) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/ludo/shop/buy", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ itemId }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.reason || "Mua lỗi");
      applySnap(j);
      const item = (j.catalog as LudoDecorItem[] | undefined)?.find(
        (c) => c.id === itemId,
      );
      if (item?.kind === "board" && item.themeId) {
        onBoardEquipped?.(item.themeId);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  };

  const equip = async (opts: {
    frameId?: string;
    pawnId?: string;
    boardId?: string;
  }) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/ludo/shop/equip", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ ...opts, roomId: roomId || undefined }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.reason || "Equip lỗi");
      applySnap(j);
      if (opts.boardId) {
        const item = (j.catalog as LudoDecorItem[] | undefined)?.find(
          (c) => c.id === opts.boardId,
        );
        const theme =
          item?.themeId ||
          LUDO_THEMES.find((t) => t.boardItemId === opts.boardId)?.id;
        if (theme) onBoardEquipped?.(theme);
      }
      onApplied?.(j.room);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  };

  const items = (snap?.catalog || []).filter((c) => c.kind === tab);
  const equipped =
    tab === "pawn"
      ? snap?.equippedPawn
      : tab === "frame"
        ? snap?.equippedFrame
        : snap?.equippedBoard;
  const seat = themeSeatColors(normalizeThemeId(themeId));
  const previewDecor =
    tab === "pawn" ? equipped || "pawn-classic" : "pawn-classic";

  return (
    <BottomSheet
      open={open}
      title="Quân / Cosmetics"
      onClose={onClose}
      heightClass="max-h-[75vh]"
      shellClass="sheet-shell-light"
      backdropClass="bg-black/40"
    >
      <div className="ludo-cosmetics-sheet px-1 pb-3 space-y-3">
        <div className="ludo-cosmetics-sheet__mode">
          Đang xem: <strong>{usingLite ? "2D" : "3D"}</strong>
          {loggedIn && snap ? (
            <span className="ludo-cosmetics-sheet__bal">
              · {snap.balance.toLocaleString("vi-VN")} xu
            </span>
          ) : null}
        </div>

        {!loggedIn ? (
          <p className="text-[12px] text-[var(--play-muted)]">
            Đăng nhập để mua bàn / quân / khung. Guest chỉ dùng bàn free.
          </p>
        ) : null}

        <div className="ludo-cosmetics-sheet__preview">
          <div
            className={`ludo-cosmetics-preview ${
              usingLite ? "is-2d" : "is-3d"
            } ${pawnDecorClass(previewDecor)}`}
            style={{
              ["--preview-pawn" as string]: seat.red,
              background: `linear-gradient(135deg, ${seat.green}33, ${seat.blue}44), var(--ludo-board-bg, #efe6d6)`,
            }}
          >
            <span
              className="ludo-cosmetics-preview__pawn"
              style={{
                background: `radial-gradient(circle at 35% 30%, #fff8, transparent 48%), ${seat.red}`,
              }}
            >
              {pawnDecorGlyph(previewDecor)}
            </span>
            <span className="ludo-cosmetics-preview__label">
              {usingLite ? "Preview 2D" : "Preview 3D"} · màu skin
            </span>
          </div>
        </div>

        <div className="ludo-cosmetics-sheet__tabs">
          <button
            type="button"
            className={tab === "board" ? "is-on" : ""}
            onClick={() => setTab("board")}
          >
            Bàn
          </button>
          <button
            type="button"
            className={tab === "pawn" ? "is-on" : ""}
            onClick={() => setTab("pawn")}
          >
            Quân cờ
          </button>
          <button
            type="button"
            className={tab === "frame" ? "is-on" : ""}
            onClick={() => setTab("frame")}
          >
            Khung góc
          </button>
        </div>

        {err ? <p className="text-xs text-red-600">{err}</p> : null}

        <div className="ludo-cosmetics-grid">
          {items.map((item) => {
            const owned = snap?.ownedIds.includes(item.id) || item.priceXu <= 0;
            const on = equipped === item.id;
            const themeMeta = LUDO_THEMES.find(
              (t) => t.boardItemId === item.id || t.id === item.themeId,
            );
            return (
              <div
                key={item.id}
                className={`ludo-cosmetics-card ${on ? "is-on" : ""} ${item.cssClass}`}
              >
                <div
                  className="ludo-cosmetics-card__swatch"
                  aria-hidden
                  style={
                    tab === "board" && themeMeta
                      ? { background: themeMeta.swatch }
                      : undefined
                  }
                />
                <div className="ludo-cosmetics-card__name">{item.nameVi}</div>
                <div className="ludo-cosmetics-card__price">
                  {item.priceXu <= 0
                    ? "Miễn phí"
                    : `${item.priceXu.toLocaleString("vi-VN")} xu`}
                </div>
                {loggedIn ? (
                  owned ? (
                    <button
                      type="button"
                      className="ludo-btn-block"
                      disabled={busy || on}
                      onClick={() =>
                        void equip(
                          tab === "pawn"
                            ? { pawnId: item.id }
                            : tab === "frame"
                              ? { frameId: item.id }
                              : { boardId: item.id },
                        )
                      }
                    >
                      {on ? "Đang dùng" : "Equip"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ludo-btn-block ludo-btn-block--primary"
                      disabled={busy}
                      onClick={() => void buy(item.id)}
                    >
                      Mua
                    </button>
                  )
                ) : item.priceXu <= 0 ? (
                  <span className="text-[10px] opacity-70">Free</span>
                ) : (
                  <span className="text-[10px] opacity-70">Cần đăng nhập</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}
