import { lazy, Suspense, type ComponentType, type ReactNode } from "react";

/**
 * Mỗi game = 1 chunk riêng. Vào Olympus không tải Tarot/Arcana/Bói bài.
 * Prefetch khi hover cover ở Lobby (xem GameLobby).
 */
export const LazyGamePage = lazy(() => import("../pages/GamePage"));
export const LazyArcanaWheelPage = lazy(() => import("../pages/ArcanaWheelPage"));
export const LazyBoiBaiPage = lazy(() => import("../pages/BoiBaiPage"));
export const LazyBoltPeakPage = lazy(() => import("../pages/BoltPeakPage"));
export const LazyLudoPage = lazy(() => import("../pages/LudoPage"));
export const LazyOanQuanPage = lazy(() => import("../pages/OanQuanPage"));
export const LazyUnoPage = lazy(() => import("../pages/UnoPage"));

const PREFETCH: Record<string, () => Promise<{ default: ComponentType }>> = {
  tarot: () => import("../pages/GamePage"),
  arcana: () => import("../pages/ArcanaWheelPage"),
  "boi-bai": () => import("../pages/BoiBaiPage"),
  olympus: () => import("../pages/BoltPeakPage"),
  ludo: () => {
    void import("../platform/ludo/preferLiteBoard").then((m) =>
      m.prefetchLudo3D(m.readLudoBoardMode()),
    );
    return import("../pages/LudoPage");
  },
  "oan-quan": () => import("../pages/OanQuanPage"),
  uno: () => import("../pages/UnoPage"),
};

const warmed = new Set<string>();

/** Prefetch chunk + cover khi user sắp vào bàn (hover / focus). */
export function prefetchGame(pathSuffix: string): void {
  const key = pathSuffix.replace(/^\/+/, "");
  if (warmed.has(key)) return;
  warmed.add(key);
  const load = PREFETCH[key];
  if (load) void load().catch(() => warmed.delete(key));
}

export function GameChunkFallback() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center px-4">
      <p className="text-sm font-semibold text-[var(--play-muted)]">
        Đang tải trò chơi…
      </p>
    </div>
  );
}

export function withGameSuspense(node: ReactNode) {
  return <Suspense fallback={<GameChunkFallback />}>{node}</Suspense>;
}
