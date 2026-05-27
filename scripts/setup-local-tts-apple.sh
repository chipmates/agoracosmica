#!/usr/bin/env bash
# Agora Cosmica — Local Mode Qwen3-TTS native install for Apple Silicon
#
# MLX doesn't work in Docker on Mac (no Metal passthrough), so the same
# Qwen3-TTS-12Hz-0.6B-Lite voice-clone model runs as a native Python venv
# managed by launchd. After this script completes the server is listening
# on http://localhost:8887 and will restart on login.
#
# Idempotent — safe to re-run. Updates the venv in place.
#
# Requirements:
#   - macOS 14+ on Apple Silicon (M1/M2/M3/M4)
#   - Xcode Command Line Tools (`xcode-select --install`)
#   - Python 3.11+ (Homebrew or python.org)
#
# Removes itself cleanly:
#   launchctl unload ~/Library/LaunchAgents/org.agoracosmica.local-tts.plist
#   rm -rf ~/Library/AgoraLocalTTS ~/Library/LaunchAgents/org.agoracosmica.local-tts.plist

set -euo pipefail

INSTALL_DIR="${HOME}/Library/AgoraLocalTTS"
PLIST_PATH="${HOME}/Library/LaunchAgents/org.agoracosmica.local-tts.plist"
LOG_DIR="${INSTALL_DIR}/logs"
PORT="${AGORA_LOCAL_TTS_PORT:-8887}"
VOICES_R2_BASE="${AGORA_VOICES_R2_BASE:-https://media.agoracosmica.org/voices}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Agora Cosmica Local TTS setup (Apple Silicon)"
echo "    install dir : ${INSTALL_DIR}"
echo "    port        : ${PORT}"
echo "    voice base  : ${VOICES_R2_BASE}"
echo "    repo root   : ${REPO_ROOT}"

if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
  echo "ERROR: this script is for Apple Silicon Macs. Use docker compose on other platforms." >&2
  exit 1
fi

PYTHON_BIN="$(command -v python3.11 || command -v python3.12 || command -v python3 || true)"
if [[ -z "${PYTHON_BIN}" ]]; then
  echo "ERROR: python3.11+ not found. Install via Homebrew: 'brew install python@3.11'" >&2
  exit 1
fi

echo "==> Using ${PYTHON_BIN}"

mkdir -p "${INSTALL_DIR}" "${LOG_DIR}"

if [[ ! -d "${INSTALL_DIR}/venv" ]]; then
  echo "==> Creating venv"
  "${PYTHON_BIN}" -m venv "${INSTALL_DIR}/venv"
fi

# shellcheck disable=SC1091
source "${INSTALL_DIR}/venv/bin/activate"

echo "==> Installing Python dependencies"
pip install --upgrade pip >/dev/null

pip install --upgrade \
  fastapi==0.115.* \
  "uvicorn[standard]==0.32.*" \
  httpx==0.27.* \
  pydantic==2.* \
  soundfile==0.12.* \
  numpy

echo "==> Installing MLX audio + the kapi2800 Qwen3-TTS Apple Silicon port"
# The pip package name may vary as the project matures; we try a few candidates
# and fall back to git+ install. Adjust if the canonical name changes.
pip install --upgrade mlx mlx-audio || true
if ! pip install --upgrade qwen3-tts-mlx 2>/dev/null; then
  echo "    pip package 'qwen3-tts-mlx' not found, installing from GitHub..."
  pip install --upgrade "git+https://github.com/kapi2800/qwen3-tts-apple-silicon.git"
fi

echo "==> Staging server files"
cp "${REPO_ROOT}/docker/tts-qwen-cuda/server.py" "${INSTALL_DIR}/server.py"
cp "${REPO_ROOT}/docker/tts-qwen-cuda/tts_preprocess.py" "${INSTALL_DIR}/tts_preprocess.py"
cp "${REPO_ROOT}/docker/tts-qwen-cuda/voice_loader.py" "${INSTALL_DIR}/voice_loader.py"

# Swap the faster_qwen3_tts import for the MLX equivalent. The kapi2800 port
# exposes a class with the same public surface (`from_pretrained`,
# `generate_voice_clone`, `generate_with_embedding`). If the package name
# differs from `mlx_qwen3_tts`, edit `${INSTALL_DIR}/server.py` manually.
python3 - <<'PY'
import re
from pathlib import Path

server = Path.home() / "Library" / "AgoraLocalTTS" / "server.py"
text = server.read_text()
text = text.replace(
    "from faster_qwen3_tts import FasterQwen3TTS",
    "from mlx_qwen3_tts import MLXQwen3TTS as FasterQwen3TTS",
)
text = re.sub(r"^MODEL_ID = .*$",
              'MODEL_ID = os.environ.get("QWEN_MODEL_ID", "Qwen/Qwen3-TTS-12Hz-0.6B-Lite-Base")',
              text, count=1, flags=re.MULTILINE)
server.write_text(text)
PY

echo "==> Writing launchd plist"
cat > "${PLIST_PATH}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>org.agoracosmica.local-tts</string>
  <key>ProgramArguments</key>
  <array>
    <string>${INSTALL_DIR}/venv/bin/python</string>
    <string>${INSTALL_DIR}/server.py</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>VOICES_R2_BASE</key><string>${VOICES_R2_BASE}</string>
    <key>VOICES_CACHE_DIR</key><string>${INSTALL_DIR}/voices-cache</string>
    <key>PORT</key><string>${PORT}</string>
    <key>QWEN_MODEL_ID</key><string>Qwen/Qwen3-TTS-12Hz-0.6B-Lite-Base</string>
  </dict>
  <key>WorkingDirectory</key><string>${INSTALL_DIR}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${LOG_DIR}/stdout.log</string>
  <key>StandardErrorPath</key><string>${LOG_DIR}/stderr.log</string>
</dict>
</plist>
EOF

# (Re)load the service
launchctl unload "${PLIST_PATH}" 2>/dev/null || true
launchctl load "${PLIST_PATH}"

echo ""
echo "==> Done. The local TTS server is starting on http://localhost:${PORT}"
echo "    First-run model download (~3 GB) can take several minutes; check ${LOG_DIR}/stdout.log"
echo "    Health check:  curl http://localhost:${PORT}/health"
echo "    Uninstall:     launchctl unload ${PLIST_PATH} && rm -rf ${INSTALL_DIR} ${PLIST_PATH}"
