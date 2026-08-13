/** HD rõ trên web; mobile hạ độ phân giải để mesh không chết. */

export const VOICE_CAM_CONSENT_KEY = "sofia_live_cam_ok_v1";

export function isHdWebClient(): boolean {
  if (typeof window === "undefined") return true;
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  const narrow = window.matchMedia?.("(max-width: 767px)")?.matches;
  return !coarse && !narrow;
}

export function liveVideoMaxBitrate(): number {
  return isHdWebClient() ? 1_800_000 : 500_000;
}

export function liveVideoMaxFramerate(): number {
  return isHdWebClient() ? 30 : 24;
}

export function getLiveVideoConstraints(
  deviceId?: string,
): MediaTrackConstraints {
  const hd = isHdWebClient();
  const device: MediaTrackConstraints = deviceId
    ? { deviceId: { exact: deviceId } }
    : { facingMode: "user" };
  if (hd) {
    return {
      ...device,
      width: { ideal: 1280, min: 640 },
      height: { ideal: 720, min: 360 },
      frameRate: { ideal: 30, max: 30 },
      aspectRatio: { ideal: 16 / 9 },
    };
  }
  return {
    ...device,
    width: { ideal: 640 },
    height: { ideal: 360 },
    frameRate: { ideal: 24, max: 24 },
  };
}

export async function applyVideoSenderBitrate(
  pc: RTCPeerConnection,
): Promise<void> {
  const maxBitrate = liveVideoMaxBitrate();
  const maxFramerate = liveVideoMaxFramerate();
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== "video") continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = maxBitrate;
      params.encodings[0].maxFramerate = maxFramerate;
      await sender.setParameters(params);
    } catch {
      /* Safari / early negotiation */
    }
  }
}

export function videoSenderOf(
  pc: RTCPeerConnection,
): RTCRtpSender | undefined {
  const withTrack = pc.getSenders().find((s) => s.track?.kind === "video");
  if (withTrack) return withTrack;
  return pc.getTransceivers().find((tr) => {
    const kind =
      tr.sender.track?.kind ?? tr.receiver.track?.kind ?? undefined;
    return (
      kind === "video" ||
      tr.direction === "recvonly" ||
      tr.direction === "inactive"
    );
  })?.sender;
}

export function hasCamConsent(): boolean {
  try {
    return localStorage.getItem(VOICE_CAM_CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setCamConsent(ok: boolean) {
  try {
    if (ok) localStorage.setItem(VOICE_CAM_CONSENT_KEY, "1");
    else localStorage.removeItem(VOICE_CAM_CONSENT_KEY);
  } catch {
    /* ignore */
  }
}
