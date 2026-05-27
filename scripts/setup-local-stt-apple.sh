#!/usr/bin/env bash
# Agora Cosmica — Local Mode Whisper STT native install for Apple Silicon
#
# Docker on Mac runs in a Linux VM with no Metal passthrough, so the upstream
# Whisper container falls back to CPU. Whisper's 30-second encoder window
# means short utterances still take ~10 seconds on CPU. This script installs
# mlx-whisper natively so the same model runs on Metal and brings short
# utterances under 1 second.
#
# After this script completes the server is listening on http://localhost:8000
# (the same port as the docker Whisper container would use) and will restart
# on login. The setup script stops the docker container if it is running, so
# there is no port conflict.
#
# Idempotent — safe to re-run. Updates the venv in place.
#
# Requirements:
#   - macOS 14+ on Apple Silicon (M1/M2/M3/M4)
#   - Xcode Command Line Tools (`xcode-select --install`)
#   - Python 3.11+ (Homebrew or python.org)
#   - ffmpeg on PATH (mlx-whisper shells out to ffmpeg for audio decoding).
#     Install with: `brew install ffmpeg`
#
# Removes itself cleanly:
#   launchctl unload ~/Library/LaunchAgents/org.agoracosmica.local-stt.plist
#   rm -rf ~/Library/AgoraLocalSTT ~/Library/LaunchAgents/org.agoracosmica.local-stt.plist

set -euo pipefail

INSTALL_DIR="${HOME}/Library/AgoraLocalSTT"
PLIST_PATH="${HOME}/Library/LaunchAgents/org.agoracosmica.local-stt.plist"
LOG_DIR="${INSTALL_DIR}/logs"
HF_CACHE="${INSTALL_DIR}/hf-cache"
PORT="${AGORA_LOCAL_STT_PORT:-8000}"
MLX_MODEL_ID="${AGORA_WHISPER_MLX_MODEL:-mlx-community/whisper-large-v3-turbo}"
CORS_ORIGINS="${AGORA_LOCAL_STT_CORS:-*}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Agora Cosmica Local STT setup (Apple Silicon, MLX backend)"
echo "    install dir : ${INSTALL_DIR}"
echo "    port        : ${PORT}"
echo "    MLX model   : ${MLX_MODEL_ID}"
echo "    HF cache    : ${HF_CACHE}"
echo "    repo root   : ${REPO_ROOT}"

if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
  echo "ERROR: this script is for Apple Silicon Macs. Use docker compose on other platforms." >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg not found on PATH. mlx-whisper uses ffmpeg to decode audio." >&2
  echo "       Install with: brew install ffmpeg" >&2
  exit 1
fi

PYTHON_BIN="$(command -v python3.11 || command -v python3.12 || command -v python3 || true)"
if [[ -z "${PYTHON_BIN}" ]]; then
  echo "ERROR: python3.11+ not found. Install via Homebrew: 'brew install python@3.11'" >&2
  exit 1
fi

echo "==> Using ${PYTHON_BIN}"

# Free port 8000 if the docker stt-whisper container is holding it.
if command -v docker >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' | grep -q '^agoracosmica-stt-whisper$'; then
    echo "==> Stopping docker stt-whisper container so port ${PORT} is free"
    docker stop agoracosmica-stt-whisper >/dev/null
  fi
fi

mkdir -p "${INSTALL_DIR}" "${LOG_DIR}" "${HF_CACHE}"

if [[ ! -d "${INSTALL_DIR}/venv" ]]; then
  echo "==> Creating venv"
  "${PYTHON_BIN}" -m venv "${INSTALL_DIR}/venv"
fi

# shellcheck disable=SC1091
source "${INSTALL_DIR}/venv/bin/activate"

echo "==> Installing Python dependencies"
pip install --upgrade pip >/dev/null

# mlx-whisper brings mlx + numpy + tiktoken transitively. FastAPI + uvicorn are
# the HTTP layer. python-multipart is required by FastAPI for file uploads.
pip install --upgrade \
  fastapi==0.115.* \
  "uvicorn[standard]==0.32.*" \
  python-multipart==0.0.* \
  numpy \
  huggingface_hub \
  mlx mlx-whisper

echo "==> Pre-downloading MLX Whisper model (one-time, ~1.5 GB)"
# Relying on HF_HOME so the runtime (mlx-whisper) hits the same cache layout
# (HF_HOME/hub/models--...). Passing cache_dir= here would put files at
# HF_HOME/models--... and the server would re-download on first transcribe.
HF_HOME="${HF_CACHE}" python3 - <<PY
from huggingface_hub import snapshot_download
path = snapshot_download(repo_id="${MLX_MODEL_ID}")
print(f"Model cached at: {path}")
PY

echo "==> Staging server files"
cp "${REPO_ROOT}/docker/stt-whisper/mlx_server.py" "${INSTALL_DIR}/mlx_server.py"

echo "==> Writing launchd plist"
cat > "${PLIST_PATH}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>org.agoracosmica.local-stt</string>
  <key>ProgramArguments</key>
  <array>
    <string>${INSTALL_DIR}/venv/bin/python</string>
    <string>${INSTALL_DIR}/mlx_server.py</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key><string>${PORT}</string>
    <key>WHISPER_MODEL_ID</key><string>${MLX_MODEL_ID}</string>
    <key>CORS_ALLOW_ORIGINS</key><string>${CORS_ORIGINS}</string>
    <key>HF_HOME</key><string>${HF_CACHE}</string>
    <!-- mlx-whisper shells out to ffmpeg. launchd's default PATH is minimal so
         Homebrew's /opt/homebrew/bin is not visible without this. -->
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
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
echo "==> Done. The local STT server is starting on http://localhost:${PORT}"
echo "    First boot warms up the model on a 1-second silent clip (~2 seconds)."
echo "    Logs:          ${LOG_DIR}/stdout.log"
echo "    Health check:  curl http://localhost:${PORT}/health"
echo "    Test:          curl -F file=@/path/to/audio.wav http://localhost:${PORT}/v1/audio/transcriptions"
echo "    Uninstall:     launchctl unload ${PLIST_PATH} && rm -rf ${INSTALL_DIR} ${PLIST_PATH}"
