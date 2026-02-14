@echo off
chcp 65001 >nul
echo.
echo  ══════════════════════════════════
echo   🔮 사주풀이 서버를 시작합니다...
echo  ══════════════════════════════════
echo.
echo  잠시 후 브라우저가 자동으로 열립니다!
echo.
echo  📱 폰에서도 접속할 수 있어요!
echo     서버 시작 후 표시되는 주소를 폰 브라우저에 입력하세요.
echo     (PC와 폰이 같은 WiFi에 연결되어 있어야 합니다)
echo.
echo  ⚠️  이 창은 닫지 마세요! (서버가 꺼집니다)
echo.

cd /d "%~dp0"

start "" "http://localhost:3000"
node server.js

pause
