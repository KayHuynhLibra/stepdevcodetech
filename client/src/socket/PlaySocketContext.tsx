import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import {
  getStoredUser,
  getToken,
  type AuthUser,
} from "../auth";
import { VoiceRoomHub } from "../components/VoiceRoomHub";
import { SocialFxLayer } from "../components/SocialFxLayer";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ??
  (import.meta.env.DEV ? "http://localhost:3001" : undefined);

/** Tarot / Arcana / bàn nhiều người — giữ 1 socket + voice + FX quà. */
export function isPlayPath(pathname: string): boolean {
  return /\/(play|arcana|uno|ludo|oan-quan|olympus)\/?$/.test(pathname);
}

export type VoiceHeaderStatus = {
  inRoom: boolean;
  roomId: number | null;
  isHost: boolean;
  roomOpen: boolean;
};

type PlaySocketCtx = {
  active: boolean;
  socket: Socket | null;
  connected: boolean;
  me: AuthUser | null;
  setMe: (u: AuthUser | null) => void;
  sessionAuthed: boolean;
  setSessionAuthed: (v: boolean) => void;
  voiceOpen: boolean;
  setVoiceOpen: (v: boolean) => void;
  openVoiceRoom: () => void;
  voiceStatus: VoiceHeaderStatus;
};

const Ctx = createContext<PlaySocketCtx | null>(null);

export function PlaySocketProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const active = isPlayPath(pathname);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [me, setMe] = useState<AuthUser | null>(() => getStoredUser());
  const [sessionAuthed, setSessionAuthed] = useState(() => !!getToken());
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceHeaderStatus>({
    inRoom: false,
    roomId: null,
    isHost: false,
    roomOpen: true,
  });

  useEffect(() => {
    if (!active) {
      setVoiceOpen(false);
      setSocket((prev) => {
        prev?.disconnect();
        return null;
      });
      setConnected(false);
      return;
    }

    const s = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 20,
    });
    setSocket(s);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      setConnected(false);
      setSessionAuthed(false);
    };
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    if (s.connected) onConnect();

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [active]);

  // Sync auth snapshot khi quay lại tab play
  useEffect(() => {
    if (!active) return;
    setMe(getStoredUser());
    setSessionAuthed(!!getToken() && !!getStoredUser());
  }, [active, pathname]);

  const openVoiceRoom = useCallback(() => setVoiceOpen(true), []);

  const value = useMemo(
    () => ({
      active,
      socket,
      connected,
      me,
      setMe,
      sessionAuthed,
      setSessionAuthed,
      voiceOpen,
      setVoiceOpen,
      openVoiceRoom,
      voiceStatus,
    }),
    [
      active,
      socket,
      connected,
      me,
      sessionAuthed,
      voiceOpen,
      openVoiceRoom,
      voiceStatus,
    ],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {active && (
        <>
          <SocialFxLayer />
          <VoiceRoomHub
            open={voiceOpen}
            socket={socket}
            me={me}
            sessionAuthed={sessionAuthed}
            onClose={() => setVoiceOpen(false)}
            onOpen={() => setVoiceOpen(true)}
            onNeedLogin={() => setVoiceOpen(false)}
            onStatus={setVoiceStatus}
          />
        </>
      )}
    </Ctx.Provider>
  );
}

export function usePlaySocket(): PlaySocketCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("usePlaySocket must be used within PlaySocketProvider");
  }
  return ctx;
}

/** An toàn ngoài play shell (hiếm). */
export function usePlaySocketOptional(): PlaySocketCtx | null {
  return useContext(Ctx);
}
