# Voice + Live (V3)

5 phòng cố định × 8 ghế. Signaling Socket.IO (`voice:*`), WebRTC **mesh**.
**Không** đụng `GameEngine` / chat trả xu / vault xu đặt.

## Modes
- **Voice** (mặc định): chỉ mic.
- **Live** (host/staff): mỗi người **opt-in** camera. Tối đa **4 cam HD / phòng**.
- Web desktop: **720p / ~1.8 Mbps**. Mobile: 360p / ~500 kbps.
- Đóng hub vẫn giữ mic + **PiP** cam. «Rời ghế» mới thoát.

## Host / Room status
- Host (hoặc staff/mod) `voice:setOpen` — đóng phòng chặn join mới.
- `voice:setMediaMode` Voice ↔ Live. Về Voice → tắt hết cam + renegotiate.
- Host/staff: mute, **tắt cam**, kick.

## User media (client)
- Mic mute + Input Volume (GainNode). Output mute + volume (`<audio>` ẩn).
- Video: `replaceTrack`, glare (perfect negotiation), bitrate cap.
- Consent lần đầu: `sofia_live_cam_ok_v1`.
- `<video>` luôn **muted** (tránh echo / double audio).
- Lưu volume: `tarot_voice_volumes_v1`.

## Env (production)

```
VITE_TURN_URL=turn:your-turn.example:3478?transport=udp
VITE_TURN_USERNAME=...
VITE_TURN_CREDENTIAL=...
```

Không có TURN thì nhiều mạng 4G/NAT không nghe/không thấy hình (chỉ STUN Google).

Prod headers: `Permissions-Policy: camera=(self), microphone=(self)`.

## Deploy

Giữ **1 instance** Railway cho MVP (state voice in-memory).
