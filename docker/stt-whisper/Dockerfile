# Agora Cosmica — Whisper STT (Local Mode)
#
# Derives from the upstream Speaches image (CT2-based faster-whisper with an
# OpenAI-compatible HTTP API). Single-user local container — no concurrency
# tuning, no metrics export, just `/v1/audio/transcriptions` on port 8000.
#
# Default model: faster-whisper-large-v3-turbo (DE + EN multilingual, ~1.5 GB,
# ~5x faster than large-v3 on CPU, sub-1% WER cost vs large-v3 on standard
# benchmarks). Override via WHISPER__MODEL env var. CUDA hosts may prefer
# `Systran/faster-whisper-large-v3` for the absolute-best quality at the cost
# of throughput.
#
# Image: ghcr.io/chipmates/agoracosmica-stt-whisper:1.1.0 (+ :latest)

FROM ghcr.io/speaches-ai/speaches:latest-cpu

ENV WHISPER__MODEL=deepdml/faster-whisper-large-v3-turbo-ct2
ENV WHISPER__INFERENCE_DEVICE=auto
ENV WHISPER__COMPUTE_TYPE=int8

# CORS for browser-direct calls (Local Mode panel and LAN-deployment cases
# where the browser sits on a different origin than the container).
# Speaches reads the env value as a JSON-encoded list. Override at runtime
# with a tighter allowlist if needed:
#     ALLOW_ORIGINS='["https://example.com","https://homelab.local"]'
ENV ALLOW_ORIGINS=[\"*\"]

# Pre-pull the configured model on first start so the first transcription
# request doesn't 404. Skipped on subsequent starts (snapshot_download is
# idempotent against the HF cache).
USER root
# Pull latest Ubuntu security patches on top of the upstream Speaches base.
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*
COPY entrypoint.sh /usr/local/bin/agora-init.sh
RUN chmod +x /usr/local/bin/agora-init.sh
USER ubuntu

EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/agora-init.sh"]
CMD ["uvicorn", "--factory", "speaches.main:create_app"]
