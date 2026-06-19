#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LABEL="local.workit"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$SCRIPT_DIR/logs"
PORT="${WORKIT_PORT:-5010}"

PYTHON3=$(command -v python3 2>/dev/null || command -v python 2>/dev/null)
[ -z "$PYTHON3" ] && echo "python3 not found." && exit 1

_write_plist() {
  mkdir -p "$LOG_DIR"
  cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${PYTHON3}</string>
    <string>${SCRIPT_DIR}/app.py</string>
  </array>
  <key>WorkingDirectory</key><string>${SCRIPT_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>WORKIT_PORT</key><string>${PORT}</string>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>${LOG_DIR}/workit.log</string>
  <key>StandardErrorPath</key><string>${LOG_DIR}/workit-error.log</string>
</dict>
</plist>
EOF
}

_is_loaded() { launchctl list 2>/dev/null | grep -q "$LABEL"; }

cmd_install() {
  echo "python3  : $PYTHON3"
  echo "port     : $PORT"
  "$PYTHON3" -c "import flask, yaml" 2>/dev/null || "$PYTHON3" -m pip install flask pyyaml -q
  _write_plist
  _is_loaded && launchctl unload "$PLIST_PATH" 2>/dev/null && sleep 1
  launchctl load "$PLIST_PATH" && sleep 1
  _is_loaded && echo "✅  Workit 실행 중 → http://localhost:${PORT}" || echo "⚠️  실행 실패. 로그 확인: $0 logs"
}

cmd_uninstall() {
  _is_loaded && launchctl unload "$PLIST_PATH" 2>/dev/null && echo "✅  서비스 중지"
  rm -f "$PLIST_PATH" && echo "✅  Plist 제거"
}

cmd_restart() {
  [ ! -f "$PLIST_PATH" ] && echo "설치되지 않음. $0 install 먼저 실행하세요." && exit 1
  launchctl unload "$PLIST_PATH" 2>/dev/null; sleep 1
  _write_plist; launchctl load "$PLIST_PATH"; sleep 1
  _is_loaded && echo "✅  재시작 → http://localhost:${PORT}" || echo "❌  재시작 실패"
}

cmd_status() {
  echo "Label: $LABEL"
  if _is_loaded; then
    PID=$(launchctl list 2>/dev/null | grep "$LABEL" | awk '{print $1}')
    echo "Status: ✅  실행 중 (PID: $PID)"
    echo "URL   : http://localhost:${PORT}"
  else
    echo "Status: ❌  실행 안 됨"
  fi
}

case "${1:-help}" in
  install)   cmd_install ;;
  uninstall) cmd_uninstall ;;
  restart)   cmd_restart ;;
  status)    cmd_status ;;
  logs)      [ "${2}" = "err" ] && tail -f "$LOG_DIR/workit-error.log" || tail -f "$LOG_DIR/workit.log" ;;
  open)      open "http://localhost:${PORT}" ;;
  help|*)
    echo "Workit — 서비스 관리"
    echo ""
    echo "Usage: $(basename "$0") <command>"
    echo "  install    설치 & 시작"
    echo "  uninstall  제거"
    echo "  restart    재시작"
    echo "  status     상태 확인"
    echo "  logs       로그 (logs err → stderr)"
    echo "  open       브라우저 열기"
    echo ""
    echo "환경변수: WORKIT_PORT (기본값: 5010)"
    ;;
esac
