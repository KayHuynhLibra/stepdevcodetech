# hackmyapp (lab bảo mật — local)

Folder **`hackmyapp/`** trên máy bạn dùng để **học kiểm thử phòng thủ** trên app SOFIAORE / https://stepkay.codes (local + domain tự vận hành).

## GitHub chỉ giữ file này

Chi tiết lab (checklist, script `safe-check`, mẫu thông báo ISP, nhật ký, phương thức A1–A14…) **không push** — đã `.gitignore` (`hackmyapp/*`, trừ README này).

Clone repo → tự tạo lại lab local nếu cần, hoặc copy từ máy operator.

## Mục đích

- Self-test có ủy quyền: health, headers, rate-limit, auth gate  
- **Không** exploit / malware / tấn công hệ thống người khác  
- Privacy & mẫu thông báo nhà mạng nằm trong bản lab local  

## Chạy (khi đã có lab local đầy đủ)

```powershell
npm run hackmyapp:live
npm run hackmyapp:local
```

## Liên quan

- Threat model nội bộ: folder `cybersecurity/` (cũng gitignore)  
- Privacy / Terms công khai: [`PRIVACY.md`](../PRIVACY.md), [`TERMS.md`](../TERMS.md)  
- Redeploy: `npm run redeploy`
