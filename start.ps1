# Script tự động chạy server và mở website
Write-Host "`n╔════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🚀 KHỞI ĐỘNG SERVER              ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════╝" -ForegroundColor Cyan

# Dừng các process node cũ
Write-Host "`n🛑 Đang dừng các process cũ..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Xóa cache
Write-Host "🧹 Đang xóa cache..." -ForegroundColor Yellow
Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue

# Chạy server
Write-Host "`n▶️  Đang khởi động Next.js server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev" -WindowStyle Minimized

# Đợi server khởi động
Write-Host "⏳ Đợi server khởi động (15 giây)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Kiểm tra port 3000
$portCheck = netstat -ano | findstr :3000
if ($portCheck) {
    Write-Host "`n✅ Server đã sẵn sàng!" -ForegroundColor Green
    Write-Host "🌐 Đang mở trình duyệt..." -ForegroundColor Cyan
    
    # Mở trình duyệt
    Start-Process "http://localhost:3000"
    
    Write-Host "`n✨ Website đã được mở trong trình duyệt!" -ForegroundColor Green
    Write-Host "📝 Để dừng server, đóng cửa sổ PowerShell hoặc nhấn Ctrl+C" -ForegroundColor Yellow
} else {
    Write-Host "`n⚠️  Server chưa sẵn sàng, đợi thêm..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    Start-Process "http://localhost:3000"
}
