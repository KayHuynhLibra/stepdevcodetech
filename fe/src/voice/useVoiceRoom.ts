import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { getToken } from "../auth";
import { getIceServers } from "./ice";
import type {
  VoiceRoomId,
  VoiceRoomPublic,
  VoiceSeatIndex,
  VoiceSeatPublic,
  VoiceSignalData,
} from "./types";
import {
  applyVideoSenderBitrate,
  getLiveVideoConstraints,
  videoSenderOf,
} from "./videoProfile";

export type VoiceStatus = "idle" | "joining" | "inRoom" | "error";

const VOICE_VOL_KEY = "tarot_voice_volumes_v1";

function loadVoiceVolumes(): {
  inputVolume: number;
  outputVolume: number;
  outputMuted: boolean;
} {
  try {
    const raw = localStorage.getItem(VOICE_VOL_KEY);
    if (!raw) {
      return { inputVolume: 100, outputVolume: 100, outputMuted: false };
    }
    const p = JSON.parse(raw) as Record<string, unknown>;
    const clamp = (n: unknown, d: number) => {
      const v = Math.floor(Number(n));
      if (!Number.isFinite(v)) return d;
      return Math.max(0, Math.min(100, v));
    };
    return {
      inputVolume: clamp(p.inputVolume, 100),
      outputVolume: clamp(p.outputVolume, 100),
      outputMuted: !!p.outputMuted,
    };
  } catch {
    return { inputVolume: 100, outputVolume: 100, outputMuted: false };
  }
}

function saveVoiceVolumes(v: {
  inputVolume: number;
  outputVolume: number;
  outputMuted: boolean;
}) {
  try {
    localStorage.setItem(VOICE_VOL_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

interface UseVoiceRoomOpts {
  socket: Socket | null;
  enabled?: boolean;
}

export function useVoiceRoom({ socket, enabled = true }: UseVoiceRoomOpts) {
  const initialVol = loadVoiceVolumes();
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lobby, setLobby] = useState<VoiceRoomPublic[]>([]);
  const [room, setRoom] = useState<VoiceRoomPublic | null>(null);
  const [seat, setSeat] = useState<VoiceSeatIndex | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [localMuted, setLocalMuted] = useState(false);
  const [forceMuted, setForceMuted] = useState(false);
  const [inputVolume, setInputVolumeState] = useState(initialVol.inputVolume);
  const [outputVolume, setOutputVolumeState] = useState(
    initialVol.outputVolume,
  );
  const [outputMuted, setOutputMutedState] = useState(initialVol.outputMuted);
  const [lixiConfig, setLixiConfig] = useState<{
    payoutPct: number;
    minAmount: number;
    maxAmount: number;
  }>({ payoutPct: 100, minAmount: 10_000_000, maxAmount: 999_999_999_999 });
  const [lixiBusy, setLixiBusy] = useState(false);
  const [lastLixi, setLastLixi] = useState<string | null>(null);
  const [localVideoOn, setLocalVideoOn] = useState(false);
  const [localPreviewStream, setLocalPreviewStream] =
    useState<MediaStream | null>(null);
  const [remoteVideoStreams, setRemoteVideoStreams] = useState<
    Record<string, MediaStream>
  >({});
  const [iceHint, setIceHint] = useState<string>("");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraIdState] = useState("");

  const localStreamRef = useRef<MediaStream | null>(null);
  const rawMicStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const inputGainRef = useRef<GainNode | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const makingOfferRef = useRef<Set<string>>(new Set());
  const socketIdRef = useRef<string | null>(null);
  const outputVolumeRef = useRef(initialVol.outputVolume);
  const outputMutedRef = useRef(initialVol.outputMuted);
  const inputVolumeRef = useRef(initialVol.inputVolume);
  const roomRef = useRef<VoiceRoomPublic | null>(null);
  const iceMapRef = useRef<Map<string, string>>(new Map());
  const cameraIdRef = useRef("");

  const refreshIceHint = useCallback(() => {
    const order = [
      "failed",
      "disconnected",
      "closed",
      "checking",
      "new",
      "connected",
      "completed",
    ];
    let worst = "completed";
    for (const st of iceMapRef.current.values()) {
      if (order.indexOf(st) < order.indexOf(worst)) worst = st;
    }
    setIceHint(iceMapRef.current.size ? worst : "");
  }, []);

  const refreshCameras = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const cams = all.filter((d) => d.kind === "videoinput");
      setCameras(cams);
      if (!cameraIdRef.current && cams[0]?.deviceId) {
        cameraIdRef.current = cams[0].deviceId;
        setCameraIdState(cams[0].deviceId);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const token = () => getToken() ?? undefined;

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const cleanupPeer = useCallback((remoteId: string) => {
    const pc = pcsRef.current.get(remoteId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
      pcsRef.current.delete(remoteId);
    }
    iceMapRef.current.delete(remoteId);
    refreshIceHint();
    const audio = remoteAudioRef.current.get(remoteId);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      remoteAudioRef.current.delete(remoteId);
    }
    makingOfferRef.current.delete(remoteId);
    setRemoteVideoStreams((prev) => {
      if (!prev[remoteId]) return prev;
      const next = { ...prev };
      delete next[remoteId];
      return next;
    });
  }, [refreshIceHint]);

  const cleanupAllPeers = useCallback(() => {
    for (const id of [...pcsRef.current.keys()]) cleanupPeer(id);
  }, [cleanupPeer]);

  const applyOutputToAudio = useCallback((audio: HTMLAudioElement) => {
    const vol = outputMutedRef.current
      ? 0
      : Math.max(0, Math.min(1, outputVolumeRef.current / 100));
    audio.volume = vol;
    audio.muted = outputMutedRef.current;
  }, []);

  const applyOutputToAll = useCallback(() => {
    for (const audio of remoteAudioRef.current.values()) {
      applyOutputToAudio(audio);
    }
  }, [applyOutputToAudio]);

  const applyInputGain = useCallback(() => {
    const gain = inputGainRef.current;
    if (!gain) return;
    // 0–100 → 0–1 linear (đủ dùng chat voice)
    gain.gain.value = Math.max(0, Math.min(1, inputVolumeRef.current / 100));
  }, []);

  const stopLocalMedia = useCallback(() => {
    const processed = localStreamRef.current;
    if (processed) {
      for (const t of processed.getTracks()) t.stop();
      localStreamRef.current = null;
    }
    const raw = rawMicStreamRef.current;
    if (raw) {
      for (const t of raw.getTracks()) t.stop();
      rawMicStreamRef.current = null;
    }
    const cam = camStreamRef.current;
    if (cam) {
      for (const t of cam.getTracks()) t.stop();
      camStreamRef.current = null;
    }
    setLocalPreviewStream(null);
    setLocalVideoOn(false);
    inputGainRef.current = null;
    const ctx = audioCtxRef.current;
    if (ctx) {
      void ctx.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  const ensureLocalMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const raw = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    rawMicStreamRef.current = raw;

    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => {});
    }
    const source = ctx.createMediaStreamSource(raw);
    const gain = ctx.createGain();
    inputGainRef.current = gain;
    gain.gain.value = Math.max(0, Math.min(1, inputVolumeRef.current / 100));
    const dest = ctx.createMediaStreamDestination();
    source.connect(gain);
    gain.connect(dest);

    localStreamRef.current = dest.stream;
    return dest.stream;
  }, []);

  const applyLocalMute = useCallback((muted: boolean) => {
    const raw = rawMicStreamRef.current;
    if (raw) {
      for (const t of raw.getAudioTracks()) t.enabled = !muted;
    }
    const processed = localStreamRef.current;
    if (processed) {
      for (const t of processed.getAudioTracks()) t.enabled = !muted;
    }
  }, []);

  const createPeer = useCallback(
    async (remoteId: string, asOfferer: boolean) => {
      if (!socket || pcsRef.current.has(remoteId)) return;
      const stream = await ensureLocalMedia();
      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      pcsRef.current.set(remoteId, pc);

      for (const track of stream.getAudioTracks()) {
        pc.addTrack(track, stream);
      }
      const vTrack = stream.getVideoTracks()[0];
      if (vTrack) {
        pc.addTrack(vTrack, stream);
        void applyVideoSenderBitrate(pc);
      } else {
        pc.addTransceiver("video", { direction: "recvonly" });
      }

      pc.oniceconnectionstatechange = () => {
        iceMapRef.current.set(remoteId, pc.iceConnectionState);
        refreshIceHint();
      };
      iceMapRef.current.set(remoteId, pc.iceConnectionState);
      refreshIceHint();

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        socket.emit("voice:signal", {
          toSocketId: remoteId,
          data: {
            type: "candidate",
            candidate: ev.candidate.toJSON(),
          } satisfies VoiceSignalData,
          token: token(),
        });
      };

      pc.ontrack = (ev) => {
        const remoteStream = ev.streams[0] ?? new MediaStream([ev.track]);
        if (ev.track.kind === "audio") {
          let audio = remoteAudioRef.current.get(remoteId);
          if (!audio) {
            audio = document.createElement("audio");
            audio.autoplay = true;
            audio.setAttribute("playsinline", "true");
            audio.style.display = "none";
            document.body.appendChild(audio);
            remoteAudioRef.current.set(remoteId, audio);
          }
          audio.srcObject = remoteStream;
          applyOutputToAudio(audio);
          void audio.play().catch(() => {});
        }
        if (ev.track.kind === "video") {
          const videoOnly = new MediaStream([ev.track]);
          setRemoteVideoStreams((prev) => ({
            ...prev,
            [remoteId]: videoOnly,
          }));
          ev.track.onended = () => {
            setRemoteVideoStreams((prev) => {
              if (!prev[remoteId]) return prev;
              const next = { ...prev };
              delete next[remoteId];
              return next;
            });
          };
        }
      };

      if (asOfferer) {
        makingOfferRef.current.add(remoteId);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("voice:signal", {
            toSocketId: remoteId,
            data: {
              type: "offer",
              sdp: pc.localDescription!,
            } satisfies VoiceSignalData,
            token: token(),
          });
        } finally {
          makingOfferRef.current.delete(remoteId);
        }
      }
    },
    [socket, ensureLocalMedia, applyOutputToAudio, refreshIceHint],
  );

  const renegotiateAsOfferer = useCallback(
    async (remoteId: string) => {
      if (!socket) return;
      const pc = pcsRef.current.get(remoteId);
      if (!pc) return;
      makingOfferRef.current.add(remoteId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("voice:signal", {
          toSocketId: remoteId,
          data: {
            type: "offer",
            sdp: pc.localDescription!,
          } satisfies VoiceSignalData,
          token: token(),
        });
      } catch (err) {
        console.warn("[voice] renegotiate", err);
      } finally {
        makingOfferRef.current.delete(remoteId);
      }
    },
    [socket],
  );

  const handleSignal = useCallback(
    async (fromSocketId: string, data: VoiceSignalData) => {
      if (!socket) return;
      let pc = pcsRef.current.get(fromSocketId);
      if (!pc) {
        await createPeer(fromSocketId, false);
        pc = pcsRef.current.get(fromSocketId);
      }
      if (!pc) return;

      try {
        if (data.type === "offer") {
          const myId = socketIdRef.current || socket.id || "";
          const polite = myId < fromSocketId;
          const offerCollision =
            makingOfferRef.current.has(fromSocketId) ||
            pc.signalingState !== "stable";
          if (offerCollision) {
            if (!polite) return;
            try {
              await pc.setLocalDescription({ type: "rollback" });
            } catch {
              /* some browsers lack rollback */
            }
          }
          await pc.setRemoteDescription(data.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("voice:signal", {
            toSocketId: fromSocketId,
            data: {
              type: "answer",
              sdp: pc.localDescription!,
            } satisfies VoiceSignalData,
            token: token(),
          });
        } else if (data.type === "answer") {
          await pc.setRemoteDescription(data.sdp);
        } else if (data.type === "candidate" && data.candidate) {
          try {
            await pc.addIceCandidate(data.candidate);
          } catch {
            /* ignore late candidates */
          }
        }
      } catch (err) {
        console.warn("[voice] signal error", err);
      }
    },
    [socket, createPeer],
  );

  const refreshLobby = useCallback(() => {
    if (!socket) return;
    socket.emit("voice:list");
  }, [socket]);

  const joinRoom = useCallback(
    async (
      roomId: VoiceRoomId,
      seat?: VoiceSeatIndex,
      password?: string,
    ) => {
      if (!socket) {
        setError("Chưa kết nối");
        setStatus("error");
        return;
      }
      if (!getToken()) {
        setError("Cần đăng nhập để vào phòng voice");
        setStatus("error");
        return;
      }
      setStatus("joining");
      setError(null);
      try {
        await ensureLocalMedia();
      } catch {
        setError("Không mở được mic — kiểm tra quyền trình duyệt");
        setStatus("error");
        return;
      }

      await new Promise<void>((resolve) => {
        socket.emit(
          "voice:join",
          {
            roomId,
            seat,
            token: token(),
            password: password || undefined,
          },
          (r: {
            ok?: boolean;
            reason?: string;
            room?: VoiceRoomPublic;
            seat?: VoiceSeatIndex;
            isHost?: boolean;
            peers?: VoiceSeatPublic[];
          }) => {
            if (!r?.ok || !r.room || !r.seat) {
              setError(r?.reason || "Không vào được phòng");
              setStatus("error");
              resolve();
              return;
            }
            setRoom(r.room);
            setSeat(r.seat);
            setIsHost(!!r.isHost);
            setStatus("inRoom");
            setForceMuted(false);
            void (async () => {
              for (const p of r.peers ?? []) {
                await createPeer(p.socketId, true);
              }
            })();
            resolve();
          },
        );
      });
    },
    [socket, ensureLocalMedia, createPeer],
  );

  const leaveRoom = useCallback(() => {
    if (socket) {
      socket.emit("voice:leave", { token: token() });
    }
    cleanupAllPeers();
    stopLocalMedia();
    setRemoteVideoStreams({});
    setRoom(null);
    setSeat(null);
    setIsHost(false);
    setLocalMuted(false);
    setForceMuted(false);
    setStatus("idle");
    setError(null);
  }, [socket, cleanupAllPeers, stopLocalMedia]);

  const stripLocalVideo = useCallback(
    async (opts?: { notifyServer?: boolean; renegotiate?: boolean }) => {
      const outbound = localStreamRef.current;
      if (outbound) {
        for (const t of outbound.getVideoTracks()) outbound.removeTrack(t);
      }
      for (const [remoteId, pc] of pcsRef.current) {
        const sender = videoSenderOf(pc);
        if (sender) {
          try {
            await sender.replaceTrack(null);
          } catch {
            /* ignore */
          }
          const trans = pc.getTransceivers().find((t) => t.sender === sender);
          if (trans) trans.direction = "recvonly";
        }
        if (opts?.renegotiate !== false) void renegotiateAsOfferer(remoteId);
      }
      const cam = camStreamRef.current;
      if (cam) {
        for (const t of cam.getTracks()) t.stop();
        camStreamRef.current = null;
      }
      setLocalPreviewStream(null);
      setLocalVideoOn(false);
      if (opts?.notifyServer && socket) {
        socket.emit(
          "voice:video",
          { videoOn: false, token: token() },
          (r: { ok?: boolean; room?: VoiceRoomPublic }) => {
            if (r?.room) setRoom(r.room);
          },
        );
      }
    },
    [socket, renegotiateAsOfferer],
  );

  const setLocalVideo = useCallback(
    async (on: boolean, deviceId?: string) => {
      if (!socket) return;
      if (!on) {
        await stripLocalVideo({ notifyServer: true, renegotiate: true });
        return;
      }
      if (roomRef.current?.mediaMode !== "live") {
        setError("Phòng đang Voice — Host bật Live trước");
        return;
      }
      try {
        await ensureLocalMedia();
        const id = deviceId || cameraIdRef.current || undefined;
        const cam = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: getLiveVideoConstraints(id),
        });
        void refreshCameras();
        const prevCam = camStreamRef.current;
        if (prevCam) {
          for (const t of prevCam.getTracks()) t.stop();
        }
        camStreamRef.current = cam;
        const vTrack = cam.getVideoTracks()[0];
        if (!vTrack) {
          setError("Không lấy được camera");
          return;
        }
        try {
          vTrack.contentHint = "motion";
        } catch {
          /* ignore */
        }
        const outbound = localStreamRef.current;
        if (!outbound) {
          setError("Chưa có stream voice");
          return;
        }
        for (const t of outbound.getVideoTracks()) outbound.removeTrack(t);
        outbound.addTrack(vTrack);
        for (const [remoteId, pc] of pcsRef.current) {
          const sender = videoSenderOf(pc);
          if (sender) {
            await sender.replaceTrack(vTrack);
            const trans = pc.getTransceivers().find((t) => t.sender === sender);
            if (trans) trans.direction = "sendrecv";
          } else {
            pc.addTrack(vTrack, outbound);
          }
          await applyVideoSenderBitrate(pc);
          void renegotiateAsOfferer(remoteId);
        }
        setLocalPreviewStream(cam);
        setLocalVideoOn(true);
        socket.emit(
          "voice:video",
          { videoOn: true, token: token() },
          (r: { ok?: boolean; reason?: string; room?: VoiceRoomPublic }) => {
            if (!r?.ok) {
              setError(r?.reason || "Không bật cam được");
              void stripLocalVideo({ notifyServer: false, renegotiate: true });
              return;
            }
            if (r.room) setRoom(r.room);
          },
        );
      } catch {
        setError("Không mở được camera — kiểm tra quyền trình duyệt");
      }
    },
    [socket, ensureLocalMedia, renegotiateAsOfferer, stripLocalVideo, refreshCameras],
  );

  const setCameraId = useCallback(
    (id: string) => {
      cameraIdRef.current = id;
      setCameraIdState(id);
      if (localVideoOn) void setLocalVideo(true, id);
    },
    [localVideoOn, setLocalVideo],
  );

  const toggleVideo = useCallback(() => {
    void setLocalVideo(!localVideoOn);
  }, [localVideoOn, setLocalVideo]);

  const setMediaMode = useCallback(
    (mode: "voice" | "live") => {
      if (!socket) return;
      socket.emit(
        "voice:setMediaMode",
        { mode, token: token() },
        (r: { ok?: boolean; reason?: string; room?: VoiceRoomPublic }) => {
          if (!r?.ok) {
            setError(r?.reason || "Không đổi chế độ phòng");
            return;
          }
          if (r.room) setRoom(r.room);
          if (mode === "voice" && localVideoOn) {
            void stripLocalVideo({ notifyServer: true, renegotiate: true });
          }
        },
      );
    },
    [socket, localVideoOn, stripLocalVideo],
  );

  const toggleMute = useCallback(() => {
    if (forceMuted) return;
    const next = !localMuted;
    setLocalMuted(next);
    applyLocalMute(next);
    socket?.emit("voice:mute", { muted: next, token: token() });
  }, [forceMuted, localMuted, applyLocalMute, socket]);

  const setInputVolume = useCallback(
    (pct: number) => {
      const v = Math.max(0, Math.min(100, Math.floor(pct)));
      inputVolumeRef.current = v;
      setInputVolumeState(v);
      applyInputGain();
      saveVoiceVolumes({
        inputVolume: v,
        outputVolume: outputVolumeRef.current,
        outputMuted: outputMutedRef.current,
      });
    },
    [applyInputGain],
  );

  const setOutputVolume = useCallback(
    (pct: number) => {
      const v = Math.max(0, Math.min(100, Math.floor(pct)));
      outputVolumeRef.current = v;
      setOutputVolumeState(v);
      if (v > 0 && outputMutedRef.current) {
        outputMutedRef.current = false;
        setOutputMutedState(false);
      }
      applyOutputToAll();
      saveVoiceVolumes({
        inputVolume: inputVolumeRef.current,
        outputVolume: v,
        outputMuted: outputMutedRef.current,
      });
    },
    [applyOutputToAll],
  );

  const toggleOutputMute = useCallback(() => {
    const next = !outputMutedRef.current;
    outputMutedRef.current = next;
    setOutputMutedState(next);
    applyOutputToAll();
    saveVoiceVolumes({
      inputVolume: inputVolumeRef.current,
      outputVolume: outputVolumeRef.current,
      outputMuted: next,
    });
  }, [applyOutputToAll]);

  const moveSeat = useCallback(
    (nextSeat: VoiceSeatIndex) => {
      if (!socket) return;
      socket.emit(
        "voice:moveSeat",
        { seat: nextSeat, token: token() },
        (r: { ok?: boolean; reason?: string; seat?: VoiceSeatIndex }) => {
          if (!r?.ok) setError(r?.reason || "Không đổi ghế được");
          else if (r.seat) setSeat(r.seat);
        },
      );
    },
    [socket],
  );

  const kick = useCallback(
    (targetSocketId: string) => {
      socket?.emit("voice:kick", {
        targetSocketId,
        token: token(),
      });
    },
    [socket],
  );

  const forceMutePeer = useCallback(
    (targetSocketId: string, muted: boolean) => {
      socket?.emit("voice:forceMute", {
        targetSocketId,
        muted,
        token: token(),
      });
    },
    [socket],
  );

  const forceVideoOffPeer = useCallback(
    (targetSocketId: string) => {
      socket?.emit("voice:forceVideoOff", {
        targetSocketId,
        token: token(),
      });
    },
    [socket],
  );

  const claimHost = useCallback(() => {
    socket?.emit(
      "voice:claimHost",
      { token: token() },
      (r: { ok?: boolean; reason?: string }) => {
        if (!r?.ok) setError(r?.reason || "Không claim host");
      },
    );
  }, [socket]);

  const setRoomOpen = useCallback(
    (open: boolean) => {
      socket?.emit(
        "voice:setOpen",
        { open, token: token() },
        (r: { ok?: boolean; reason?: string; room?: VoiceRoomPublic }) => {
          if (!r?.ok) setError(r?.reason || "Không đổi trạng thái phòng");
          else if (r.room) setRoom(r.room);
        },
      );
    },
    [socket],
  );

  const setRoomPassword = useCallback(
    (password: string) => {
      socket?.emit(
        "voice:setPassword",
        { password, token: token() },
        (r: { ok?: boolean; reason?: string; room?: VoiceRoomPublic }) => {
          if (!r?.ok) setError(r?.reason || "Không đặt mật khẩu");
          else if (r.room) setRoom(r.room);
        },
      );
    },
    [socket],
  );

  const sendLixi = useCallback(
    (amount: number, note?: string) => {
      if (!socket) return;
      setLixiBusy(true);
      setError(null);
      socket.emit(
        "voice:lixi",
        { amount, note, token: token() },
        (r: {
          ok?: boolean;
          reason?: string;
          amount?: number;
          pool?: number;
          payoutPct?: number;
          recipientCount?: number;
        }) => {
          setLixiBusy(false);
          if (!r?.ok) {
            setError(r?.reason || "Phát lì xì thất bại");
            return;
          }
          setLastLixi(
            `Đã phát ${Number(r.amount).toLocaleString("vi-VN")} · chia ${r.pool?.toLocaleString("vi-VN")} (${r.payoutPct}%) cho ${r.recipientCount} người`,
          );
          window.setTimeout(() => setLastLixi(null), 5000);
        },
      );
    },
    [socket],
  );

  useEffect(() => {
    if (!socket || !enabled) return;
    socketIdRef.current = socket.id ?? null;

    const onLobby = (rows: VoiceRoomPublic[]) => setLobby(rows);
    const onLixiConfig = (cfg: {
      payoutPct?: number;
      minAmount?: number;
      maxAmount?: number;
    }) => {
      setLixiConfig({
        payoutPct: Math.max(1, Math.min(100, Number(cfg.payoutPct) || 100)),
        minAmount: Number(cfg.minAmount) || 10_000_000,
        maxAmount: Number(cfg.maxAmount) || 999_999_999_999,
      });
    };
    const onLixiEvent = (ev: {
      fromName?: string;
      amount?: number;
      pool?: number;
      payoutPct?: number;
      recipientCount?: number;
    }) => {
      if (!ev?.fromName) return;
      setLastLixi(
        `🧧 ${ev.fromName} phát ${Number(ev.amount).toLocaleString("vi-VN")} · ${ev.recipientCount} người nhận (${ev.payoutPct}%)`,
      );
      window.setTimeout(() => setLastLixi(null), 6000);
    };
    const onRoom = (r: VoiceRoomPublic) => {
      setRoom(r);
      const meId = socket.id;
      setIsHost(r.hostSocketId === meId);
      const mine = r.seats.find((s) => s?.socketId === meId);
      if (mine) {
        setSeat(mine.seat);
        setForceMuted(!!mine.forceMuted);
        if (mine.forceMuted) {
          setLocalMuted(true);
          applyLocalMute(true);
        }
      }
    };
    const onPeerJoined = (payload: {
      peer?: VoiceSeatPublic | null;
      room?: VoiceRoomPublic;
    }) => {
      if (payload.room) setRoom(payload.room);
      // Người mới join tự offer — peer cũ chờ offer
    };
    const onPeerLeft = (payload: {
      socketId?: string;
      room?: VoiceRoomPublic;
    }) => {
      if (payload.socketId) cleanupPeer(payload.socketId);
      if (payload.room) setRoom(payload.room);
    };
    const onSignal = (payload: {
      fromSocketId?: string;
      data?: VoiceSignalData;
    }) => {
      if (!payload.fromSocketId || !payload.data) return;
      void handleSignal(payload.fromSocketId, payload.data);
    };
    const onKicked = (payload: { reason?: string }) => {
      cleanupAllPeers();
      stopLocalMedia();
      setRoom(null);
      setSeat(null);
      setIsHost(false);
      setStatus("idle");
      setError(payload.reason || "Bạn bị mời ra khỏi phòng");
    };
    const onForceMuted = (payload: {
      muted?: boolean;
      room?: VoiceRoomPublic;
    }) => {
      const m = !!payload.muted;
      setForceMuted(m);
      setLocalMuted(m);
      applyLocalMute(m);
      if (payload.room) setRoom(payload.room);
    };
    const onMediaMode = (payload: {
      mode?: string;
      room?: VoiceRoomPublic;
    }) => {
      if (payload.room) setRoom(payload.room);
      if (payload.mode === "voice") {
        void stripLocalVideo({ notifyServer: false, renegotiate: true });
      }
    };
    const onForceVideoOff = (payload: { room?: VoiceRoomPublic }) => {
      if (payload.room) setRoom(payload.room);
      void stripLocalVideo({ notifyServer: false, renegotiate: true });
    };
    const onError = (payload: { reason?: string }) => {
      setError(payload.reason || "Lỗi voice");
      setStatus("error");
    };

    socket.on("voice:lobby", onLobby);
    socket.on("voice:room", onRoom);
    socket.on("voice:peerJoined", onPeerJoined);
    socket.on("voice:peerLeft", onPeerLeft);
    socket.on("voice:signal", onSignal);
    socket.on("voice:kicked", onKicked);
    socket.on("voice:forceMuted", onForceMuted);
    socket.on("voice:forceVideoOff", onForceVideoOff);
    socket.on("voice:mediaMode", onMediaMode);
    socket.on("voice:error", onError);
    socket.on("voice:lixiConfig", onLixiConfig);
    socket.on("voice:lixi", onLixiEvent);

    socket.emit("voice:list");
    socket.emit("voice:lixi-config");

    return () => {
      socket.off("voice:lobby", onLobby);
      socket.off("voice:room", onRoom);
      socket.off("voice:peerJoined", onPeerJoined);
      socket.off("voice:peerLeft", onPeerLeft);
      socket.off("voice:signal", onSignal);
      socket.off("voice:kicked", onKicked);
      socket.off("voice:forceMuted", onForceMuted);
      socket.off("voice:forceVideoOff", onForceVideoOff);
      socket.off("voice:mediaMode", onMediaMode);
      socket.off("voice:error", onError);
      socket.off("voice:lixiConfig", onLixiConfig);
      socket.off("voice:lixi", onLixiEvent);
    };
  }, [
    socket,
    enabled,
    cleanupPeer,
    cleanupAllPeers,
    stopLocalMedia,
    handleSignal,
    applyLocalMute,
    stripLocalVideo,
  ]);

  // Rời voice chỉ khi socket disconnect — đổi bàn Tarot↔Arcana không unmount hub
  useEffect(() => {
    if (!socket) return;
    const onDisc = () => {
      cleanupAllPeers();
      stopLocalMedia();
      setRoom(null);
      setSeat(null);
      setIsHost(false);
      setStatus("idle");
    };
    socket.on("disconnect", onDisc);
    return () => {
      socket.off("disconnect", onDisc);
    };
  }, [socket, cleanupAllPeers, stopLocalMedia]);

  return {
    status,
    error,
    setError,
    lobby,
    room,
    seat,
    isHost,
    localMuted,
    forceMuted,
    localVideoOn,
    localPreviewStream,
    remoteVideoStreams,
    iceHint,
    cameras,
    cameraId,
    setCameraId,
    refreshCameras,
    inputVolume,
    outputVolume,
    outputMuted,
    setInputVolume,
    setOutputVolume,
    toggleOutputMute,
    refreshLobby,
    joinRoom,
    leaveRoom,
    toggleMute,
    toggleVideo,
    setLocalVideo,
    setMediaMode,
    moveSeat,
    kick,
    forceMutePeer,
    forceVideoOffPeer,
    claimHost,
    setRoomOpen,
    setRoomPassword,
    lixiConfig,
    lixiBusy,
    lastLixi,
    sendLixi,
  };
}
