#!/usr/bin/env bash
# Agora Cosmica — Local Mode Qwen3-TTS native install for Apple Silicon
#
# MLX doesn't work in Docker on Mac (no Metal passthrough), so the Qwen3-TTS
# voice-clone model runs natively via the mlx-audio package, served by a
# FastAPI wrapper (mlx_server.py) managed by launchd. After this script
# completes the server is listening on http://localhost:8887 and will restart
# on login.
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
HF_CACHE="${INSTALL_DIR}/hf-cache"
PORT="${AGORA_LOCAL_TTS_PORT:-8887}"
VOICES_R2_BASE="${AGORA_VOICES_R2_BASE:-https://media.agoracosmica.org/voices}"
MLX_MODEL_ID="${AGORA_QWEN_MLX_MODEL:-mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit}"
CORS_ORIGINS="${AGORA_LOCAL_TTS_CORS:-*}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Agora Cosmica Local TTS setup (Apple Silicon, MLX backend)"
echo "    install dir : ${INSTALL_DIR}"
echo "    port        : ${PORT}"
echo "    voice base  : ${VOICES_R2_BASE}"
echo "    MLX model   : ${MLX_MODEL_ID}"
echo "    HF cache    : ${HF_CACHE}"
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

mkdir -p "${INSTALL_DIR}" "${LOG_DIR}" "${HF_CACHE}"

if [[ ! -d "${INSTALL_DIR}/venv" ]]; then
  echo "==> Creating venv"
  "${PYTHON_BIN}" -m venv "${INSTALL_DIR}/venv"
fi

# shellcheck disable=SC1091
source "${INSTALL_DIR}/venv/bin/activate"

echo "==> Installing Python dependencies"
pip install --upgrade pip >/dev/null

# mlx-audio brings mlx + mlx-lm + transformers + huggingface_hub transitively.
# We add the FastAPI server-side deps explicitly so the versions are pinned.
pip install --upgrade \
  fastapi==0.115.* \
  "uvicorn[standard]==0.32.*" \
  httpx==0.27.* \
  pydantic==2.* \
  soundfile==0.12.* \
  numpy \
  huggingface_hub \
  mlx mlx-audio

echo "==> Pre-downloading MLX model (one-time, ~1 GB)"
HF_HOME="${HF_CACHE}" python3 - <<PY
from huggingface_hub import snapshot_download
import os
path = snapshot_download(
    repo_id="${MLX_MODEL_ID}",
    cache_dir="${HF_CACHE}",
)
print(f"Model cached at: {path}")
PY

echo "==> Staging server files"
cp "${REPO_ROOT}/docker/tts-qwen-cuda/mlx_server.py" "${INSTALL_DIR}/mlx_server.py"
cp "${REPO_ROOT}/docker/tts-qwen-cuda/voice_loader.py" "${INSTALL_DIR}/voice_loader.py"

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
    <string>${INSTALL_DIR}/mlx_server.py</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>VOICES_R2_BASE</key><string>${VOICES_R2_BASE}</string>
    <key>VOICES_CACHE_DIR</key><string>${INSTALL_DIR}/voices-cache</string>
    <key>PORT</key><string>${PORT}</string>
    <key>QWEN_MODEL_ID</key><string>${MLX_MODEL_ID}</string>
    <key>CORS_ALLOW_ORIGINS</key><string>${CORS_ORIGINS}</string>
    <key>HF_HOME</key><string>${HF_CACHE}</string>
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
echo "    First boot fetches 10 archetype voices from R2 (~5 MB); subsequent starts are warm."
echo "    Logs:          ${LOG_DIR}/stdout.log"
echo "    Health check:  curl http://localhost:${PORT}/health"
echo "    Voice catalog: curl http://localhost:${PORT}/v1/audio/voices"
echo "    Uninstall:     launchctl unload ${PLIST_PATH} && rm -rf ${INSTALL_DIR} ${PLIST_PATH}"
