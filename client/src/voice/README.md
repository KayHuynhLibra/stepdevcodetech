# Voice rooms (V2)

5 phòng cố định × 8 ghế. Signaling Socket.IO (`voice:*`), audio WebRTC mesh.
**Không** đụng `GameEngine` / chat trả xu / vault xu đặt.

## Host / Room status
- Host (hoặc staff/mod) `voice:setOpen` — đóng phòng chặn join mới.
- Lobby hiện On/Off; nút GamePage: `Room N` / `Room · Off`.

## User audio (client)
- **Mic mute** + **Input Volume** (0–100, GainNode trước khi gửi WebRTC).
- **Output mute** + **Output Volume** (volume trên thẻ `<audio>` remote).
- Lưu localStorage `tarot_voice_volumes_v1`.

## Env (production)

```
VITE_TURN_URL=turn:your-turn.example:3478
VITE_TURN_USERNAME=...
VITE_TURN_CREDENTIAL=...
```

Không có TURN thì nhiều mạng 4G/NAT có thể không nghe được (chỉ STUN Google).

## Deploy

Giữ **1 instance** Railway cho MVP (state voice in-memory).
