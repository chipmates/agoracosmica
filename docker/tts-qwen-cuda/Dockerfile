# Agora Cosmica — Qwen3-TTS (German, Local Mode, CUDA)
#
# Runs Qwen3-TTS-12Hz-0.6B-Base on an NVIDIA GPU via the `faster-qwen3-tts`
# pip package (static CUDA-graph capture, no batching overhead, single-stream
# optimised). Wraps it in a thin FastAPI `/v1/audio/speech` endpoint that
# resolves the 10 archetype voice slugs against reference WAVs + embeddings
# fetched from R2 at startup.
#
# Image: ghcr.io/chipmates/agoracosmica-tts-qwen-cuda:1.1.0 (+ :latest)
# Apple Silicon users: see ../../scripts/setup-local-tts-apple.sh — MLX
# doesn't work in docker on Mac (no Metal passthrough), so the same model
# runs as a native Python venv + launchd plist on that platform.

FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
# `sox` is required at install time by faster-qwen3-tts (transitive dep
# `sox` Python package calls the binary during setup.py). `apt upgrade`
# pulls latest security patches for the Ubuntu 22.04 base.
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
      python3.11 python3.11-venv python3-pip ffmpeg sox curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN python3.11 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Pin Torch to a version known to work with CUDA-graph capture in
# faster-qwen3-tts. The README is explicit: torch<=2.5.0 has graph-capture
# bugs in this path, and Blackwell (RTX 50xx) needs cu128 / 2.7+.
RUN pip install --no-cache-dir torch==2.5.1 --index-url https://download.pytorch.org/whl/cu124 \
    # Pre-seed numpy + sox before faster-qwen3-tts pulls them in. The Python
    # `sox` package's setup.py imports its own module to read __version__,
    # which transitively imports numpy. Without numpy already installed
    # pip's metadata-generation step for sox fails before sox itself can
    # be installed. Splitting the install ensures numpy is on disk when
    # sox's egg_info runs.
    && pip install --no-cache-dir numpy \
    && pip install --no-cache-dir \
         faster-qwen3-tts \
         fastapi==0.115.* \
         uvicorn[standard]==0.32.* \
         httpx==0.27.* \
         pydantic==2.* \
         soundfile==0.12.*

WORKDIR /app
COPY server.py /app/server.py
COPY tts_preprocess.py /app/tts_preprocess.py
COPY voice_loader.py /app/voice_loader.py

ENV VOICES_R2_BASE=https://media.agoracosmica.org/voices
ENV VOICES_CACHE_DIR=/var/cache/agora-voices
ENV GPU_MEMORY_UTILIZATION=0.4
ENV HF_HOME=/root/.cache/huggingface

RUN mkdir -p "$VOICES_CACHE_DIR"

EXPOSE 8887

# Single worker — single user, single GPU. CUDA graph state can't be shared
# across workers and a second worker just duplicates the model in VRAM.
CMD ["python", "/app/server.py"]
