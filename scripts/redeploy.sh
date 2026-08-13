#!/usr/bin/env bash
# Redeploy Sofiaore / Tarot -> Railway (https://stepkay.codes)
# Git Bash / WSL / macOS. Windows: uu tien scripts/redeploy.ps1
#
#   ./scripts/redeploy.sh          # menu + chi dan
#   ./scripts/redeploy.sh deploy   # chi railway up
#   ./scripts/redeploy.sh full     # typecheck -> deploy -> verify
#   npm run redeploy:sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LIVE_URL="https://stepkay.codes"
HEALTH_URL="$LIVE_URL/health"

title() {
  echo ""
  echo "========================================"
  echo "  $1"
  echo "========================================"
}

help_text() {
  title "REDEPLOY - chi dan nhanh"
  cat <<EOF

Live:     $LIVE_URL
Health:   $HEALTH_URL
Project:  tarot-bet-demo (Railway)
Volume:   /app/be/data  (KHONG ghi de bang git)

Khi nao dung gi?
  (1) Typecheck     - truoc khi deploy (server + client tsc)
  (2) Deploy local  - railway up -c -y  * tin cay nhat
  (3) Full          - typecheck -> deploy -> verify
  (4) Verify live   - health + danh sach deployment
  (5) Status CLI    - whoami / status / deployment list
  (0) Thoat

Luu y:
  - GitHub auto-deploy doi khi khong chay -> dung (2)
  - Khong commit: be/data/*.json, .env, studying/, local/
  - Login Railway (mot lan):  npx @railway/cli@latest login
  - Sau Deploy complete: Ctrl+F5 tren trinh duyet

Chay khong menu:
  ./scripts/redeploy.sh deploy
  ./scripts/redeploy.sh full
  npm run redeploy:sh

EOF
}

do_check() {
  title "Typecheck"
  echo "-> server..."
  (cd "$ROOT/server" && npx tsc --noEmit)
  echo "-> client..."
  (cd "$ROOT/client" && npx tsc --noEmit)
  echo "OK typecheck sach."
}

do_deploy() {
  title "Deploy Railway (upload local)"
  echo "Lenh: npx --yes @railway/cli@latest up -c -y"
  echo "Doi build... (co the 1-3 phut)"
  npx --yes @railway/cli@latest up -c -y
  echo "Deploy CLI xong - kiem tra SUCCESS / dashboard."
}

do_verify() {
  title "Verify live"
  echo "-> deployment list"
  npx --yes @railway/cli@latest deployment list --limit 3 || true
  echo ""
  echo "-> GET $HEALTH_URL"
  if command -v curl >/dev/null 2>&1; then
    body="$(curl -sS --max-time 25 "$HEALTH_URL" || true)"
    echo "$body"
    if echo "$body" | grep -Eq '"ready"[[:space:]]*:[[:space:]]*true|"ok"[[:space:]]*:[[:space:]]*true'; then
      echo "Live OK · $LIVE_URL"
    else
      echo "Health chua ready - doi 30-60s roi chay lai: ./scripts/redeploy.sh verify"
    fi
  else
    echo "Thieu curl - mo $HEALTH_URL tren trinh duyet."
  fi
}

do_status() {
  title "Railway status"
  npx --yes @railway/cli@latest whoami || true
  npx --yes @railway/cli@latest status || true
  npx --yes @railway/cli@latest deployment list --limit 5 || true
}

menu() {
  help_text
  while true; do
    echo ""
    printf "Chon (0-5): "
    read -r choice
    case "${choice:-}" in
      1) do_check ;;
      2) do_deploy ;;
      3) do_check; do_deploy; sleep 20; do_verify ;;
      4) do_verify ;;
      5) do_status ;;
      0) echo "Bye."; exit 0 ;;
      h|help) help_text ;;
      *) echo "Khong hop le. Go 0-5 hoac help." ;;
    esac
  done
}

cmd="${1:-menu}"
case "$cmd" in
  help|-h|--help) help_text ;;
  check|typecheck) do_check ;;
  deploy|up) do_deploy ;;
  verify) do_verify ;;
  status) do_status ;;
  full)
    do_check
    do_deploy
    sleep 20
    do_verify
    ;;
  menu) menu ;;
  *)
    echo "Lenh khong ro: $cmd"
    help_text
    exit 1
    ;;
esac
