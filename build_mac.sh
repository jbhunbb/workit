#!/usr/bin/env bash
# Build Workit.app + Workit.dmg for macOS
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Workit Mac App Builder ==="

# ── Python: prefer .venv, then Homebrew 3.12 ──────────────────
if [ -f ".venv/bin/python" ]; then
  PY=".venv/bin/python"
elif command -v /opt/homebrew/bin/python3.12 &>/dev/null; then
  PY="/opt/homebrew/bin/python3.12"
elif command -v python3.12 &>/dev/null; then
  PY="$(command -v python3.12)"
else
  echo "Python 3.12+ required. Run: brew install python@3.12"
  exit 1
fi
echo "Python: $($PY --version)"

# ── Create / update venv ───────────────────────────────────────
if [ ! -f ".venv/bin/python" ]; then
  echo "[1/5] Creating virtual environment..."
  $PY -m venv .venv
fi
.venv/bin/pip install flask pyyaml pywebview pyinstaller Pillow --quiet

# ── Generate app icon ──────────────────────────────────────────
echo "[2/5] Generating icon..."
.venv/bin/python make_icon.py

# ── Clean previous build ───────────────────────────────────────
echo "[3/5] Cleaning previous build..."
rm -rf build dist __pycache__

# ── Build .app ────────────────────────────────────────────────
echo "[4/5] Building Workit.app..."
.venv/bin/pyinstaller \
  --windowed \
  --name "Workit" \
  --icon "workit.icns" \
  --add-data "templates:templates" \
  --add-data "static:static" \
  --hidden-import "webview.platforms.cocoa" \
  --collect-submodules "webview" \
  --noconfirm \
  main.py

# ── Build .zip ────────────────────────────────────────────────
echo "[5/5] Building Workit.zip..."

ZIP_OUT="dist/Workit.zip"
rm -f "$ZIP_OUT"
ditto -c -k --keepParent dist/Workit.app "$ZIP_OUT"

echo ""
echo "=== 빌드 완료 ==="
echo ""
echo "  App : dist/Workit.app"
echo "  ZIP : dist/Workit.zip"
echo ""
echo "설치: Workit.zip 압축 해제 후 Workit.app을 /Applications로 이동"
echo "데이터: ~/.workit/  |  로그: ~/.workit/logs/workit.log"
