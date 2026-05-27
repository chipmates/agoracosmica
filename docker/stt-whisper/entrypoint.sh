#!/bin/sh
# Pre-pull the configured Whisper model into the HF cache before starting the
# server, so the first transcription doesn't 404 with "model not installed"
# (Speaches lazy-loads by default). Mounted HF cache volume keeps the download
# across container restarts; this script is a no-op when the model is already
# cached.

set -e

MODEL="${WHISPER__MODEL:-deepdml/faster-whisper-large-v3-turbo-ct2}"

echo "[agora-init] Ensuring Whisper model present: $MODEL"
python - <<PY || echo "[agora-init] Pre-pull failed; server will lazy-load on first request"
import sys
from huggingface_hub import snapshot_download
try:
    snapshot_download("$MODEL")
    print("[agora-init] Model ready: $MODEL")
except Exception as exc:
    print(f"[agora-init] snapshot_download failed: {exc}", file=sys.stderr)
    sys.exit(1)
PY

exec "$@"
