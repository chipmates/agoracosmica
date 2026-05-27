# Agora Cosmica — Kokoro TTS (English, Local Mode)
#
# Single-user local container based on the public Kokoro FastAPI image.
# Two production patches:
#   1. Log level WARNING — stops Kokoro from logging request text (ZDR).
#   2. Workers stay at the upstream default (1). Our hosted fleet patches
#      `--workers 4` for concurrency; local mode is single-user and the
#      extra workers just duplicate the 82M model in VRAM.
#
# OpenAI-compatible endpoint at `POST :8880/v1/audio/speech`.
# Voices: `af_heart`, `am_michael`, etc. (see Kokoro docs).
#
# Image: ghcr.io/chipmates/agoracosmica-tts-kokoro:1.1.0 (+ :latest)

FROM ghcr.io/remsky/kokoro-fastapi-gpu:latest

# Patch logging to WARNING level. Kokoro by default logs incoming request
# text at DEBUG, which would defeat the "no conversation data leaves your
# machine" claim if local logs are inspected.
RUN sed -i 's/"level": "DEBUG"/"level": "WARNING"/' /app/api/src/main.py && \
    sed -i 's/--log-level debug/--log-level warning/' /app/entrypoint.sh

EXPOSE 8880

# The upstream image already sets the entrypoint. No CMD override needed.
