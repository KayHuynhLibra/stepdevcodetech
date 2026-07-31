# Wire Olympus vào WEB GAME (thủ công)

Làm từng bước — **không** đụng `version 1` / `version 2` / `version 3`.

## 1. Copy file vào tree chính (khi muốn bật)

Từ addon này → workspace root `D:\WEB\WEB GAME\`:

```
server/src/platform/olympus.ts
client/src/pages/OlympusCasinoPage.tsx
client/src/platform/olympus.css
client/public/assets/olympus/*
```

## 2. Server

Trong `server/src/index.ts` (hoặc chỗ mount platform):

```ts
import { mountOlympusRoutes } from "./platform/olympus.js";
// ...
mountOlympusRoutes(app);
```

Đăng ký app/room nếu project có registry tương tự `apps.ts` / `roomHub.ts` của pocketcursor.

## 3. Client

Route React (ví dụ):

```tsx
<Route path="/olympus" element={<OlympusCasinoPage />} />
```

Import CSS trong page (đã có sẵn trong `OlympusCasinoPage.tsx`).

## 4. Proxy / rate-limit

Nếu Vite proxy `/api` → bảo đảm `/api/olympus` tới server.

Rate-limit: path `/api/olympus` nên bucket riêng (tránh 429 khi bot).

## 5. Kiểm tra

```bash
# từ WEB GAME root, sau khi wire
node addons/olympus-sofiaore/scripts/olympus-fifty-vu.mjs
# hoặc chỉnh OLY_BASE
```

## Không làm

- Không merge vào thư mục `version 1|2|3` trừ khi bạn chủ đích fork bản đó.
- Không xóa addon sau khi copy — giữ làm nguồn đối chiếu.
