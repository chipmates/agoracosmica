# Agora Cosmica — Kokoro TTS (English, Local Mode)
#
# Single-user local container based on the public Kokoro FastAPI image.
# CPU-default variant: ~1.5 GB image, runs natively on Apple Silicon (where
# the GPU/CUDA variant would just fall back to CPU under 13.6 GB of dead
# weight). NVIDIA users can override the base image in a downstream
# Dockerfile if they want CUDA acceleration; the per-request difference is
# small for a single-user setup since Kokoro is only 82M params.
#
# Two production patches:
#   1. Log level WARNING. Stops Kokoro from logging request text at DEBUG,
#      which would otherwise leak conversation content into local logs and
#      defeat the "no conversation data leaves your machine" claim.
#   2. Workers stay at the upstream default (1). Our hosted fleet patches
#      `--workers 4` for concurrency; local mode is single-user and the
#      extra workers just duplicate the 82M model in memory.
#
# OpenAI-compatible endpoint at `POST :8880/v1/audio/speech`.
# Voices: `af_heart`, `am_michael`, etc. Blend syntax supported via
# `voice: "voice_a(N)+voice_b(M)"` (see Kokoro docs).
#
# Image: ghcr.io/chipmates/agoracosmica-tts-kokoro:1.1.0 (+ :latest)

FROM ghcr.io/remsky/kokoro-fastapi-cpu:latest

# Pull latest Debian security patches on top of the upstream base.
USER root
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

# Patch logging to WARNING level. Kokoro by default logs incoming request
# text at DEBUG.
RUN sed -i 's/"level": "DEBUG"/"level": "WARNING"/' /app/api/src/main.py && \
    sed -i 's/--log-level debug/--log-level warning/' /app/entrypoint.sh

EXPOSE 8880

# The upstream image already sets the entrypoint. No CMD override needed.
