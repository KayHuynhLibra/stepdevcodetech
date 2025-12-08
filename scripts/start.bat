@echo off
echo.
echo ========================================
echo   KHỞI ĐỘNG SERVER VÀ MỞ WEBSITE
echo ========================================
echo.

REM Dừng các process node cũ
echo Đang dừng các process cũ...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Xóa cache
echo Đang xóa cache...
if exist .next rmdir /s /q .next

REM Chạy server trong cửa sổ mới
echo.
echo Đang khởi động Next.js server...
start "Next.js Dev Server" cmd /k "npm run dev"

REM Đợi server khởi động
echo Đợi server khởi động (15 giây)...
timeout /t 15 /nobreak >nul

REM Mở trình duyệt
echo.
echo Đang mở trình duyệt...
start http://localhost:3000

echo.
echo ========================================
echo   Website đã được mở!
echo   Server đang chạy trong cửa sổ khác
echo ========================================
echo.
pause

