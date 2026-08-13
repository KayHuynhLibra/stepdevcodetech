export const VOICE_ROOM_COUNT = 5;
export const VOICE_SEATS_PER_ROOM = 8;
export const VOICE_MAX_LIVE_CAMS = 4;

export type VoiceRoomId = 1 | 2 | 3 | 4 | 5;
export type VoiceSeatIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
/** voice = chỉ mic · live = cho phép bật cam (opt-in) */
export type VoiceMediaMode = "voice" | "live";

export interface VoiceSeatPublic {
  seat: VoiceSeatIndex;
  socketId: string;
  userId: string;
  name: string;
  avatar: string;
  muted: boolean;
  forceMuted: boolean;
  videoOn: boolean;
  joinedAt: number;
}

export interface VoiceRoomPublic {
  roomId: VoiceRoomId;
  hostSocketId: string | null;
  hostUserId: string | null;
  seats: (VoiceSeatPublic | null)[];
  occupied: number;
  open?: boolean;
  hasPassword?: boolean;
  mediaMode?: VoiceMediaMode;
}

export type VoiceSignalData =
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "candidate"; candidate: RTCIceCandidateInit };
