# Agora Cosmica — Whisper STT (Local Mode)
#
# Derives from the upstream Speaches image (CT2-based faster-whisper with an
# OpenAI-compatible HTTP API). Single-user local container — no concurrency
# tuning, no metrics export, just `/v1/audio/transcriptions` on port 8000.
#
# Default model: faster-whisper-large-v3 (DE + EN multilingual, ~2.2 GB VRAM).
# Override via WHISPER__MODEL env var. CPU users should switch to
# Systran/faster-whisper-base or Systran/faster-whisper-small for usable speed.
#
# Image: ghcr.io/chipmates/agoracosmica-stt-whisper:1.1.0 (+ :latest)

FROM ghcr.io/speaches-ai/speaches:latest

ENV WHISPER__MODEL=Systran/faster-whisper-large-v3
ENV WHISPER__INFERENCE_DEVICE=auto
ENV WHISPER__COMPUTE_TYPE=int8_float16

EXPOSE 8000

# Upstream entrypoint exposes the FastAPI app on :8000. No override needed.
