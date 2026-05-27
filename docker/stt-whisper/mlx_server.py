"""Local Mode STT server for Apple Silicon (MLX backend).

Mirrors the OpenAI-compatible interface of the Speaches-based Whisper docker
container, but uses mlx-whisper's MPS/Metal inference instead of CTranslate2 on
CPU. Endpoints:

    POST /v1/audio/transcriptions   OpenAI-shape: multipart file upload + optional
                                    model / language / prompt / response_format
                                    / temperature.
    GET  /health                    Liveness probe used by the Local Mode panel.
    GET  /v1/models                 Catalog endpoint for discoverability.

Why this exists:
    Docker on macOS runs in a Linux VM with no Metal passthrough, so the
    Whisper container falls back to CPU. On CPU, Whisper's 30-second encoder
    window means a 5-second utterance still takes ~10 seconds to transcribe.
    Running mlx-whisper natively on Apple Silicon uses Metal and brings the
    same utterance down to <1 second.

Model:
    Defaults to `mlx-community/whisper-large-v3-turbo` (~1.5 GB). Same model
    class as the Docker container default (deepdml/faster-whisper-large-v3-
    turbo-ct2), so transcription quality is identical. Override via
    WHISPER_MODEL_ID env var.

Environment:
    WHISPER_MODEL_ID        HuggingFace repo id (default whisper-large-v3-turbo)
    PORT                    HTTP port (default 8000, matches the docker
                            container so the panel's STT URL stays the same).
    CORS_ALLOW_ORIGINS      Comma-separated origins for CORS (default *).
"""

from __future__ import annotations

import concurrent.futures
import logging
import os
import tempfile
import wave
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

import mlx.core as mx
import mlx_whisper

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

MODEL_ID = os.environ.get("WHISPER_MODEL_ID", "mlx-community/whisper-large-v3-turbo")
PORT = int(os.environ.get("PORT", "8000"))
CORS_ORIGINS = os.environ.get("CORS_ALLOW_ORIGINS", "*").split(",")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("stt_mlx_server")

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

# Dedicated single-worker thread for all MLX inference. MLX uses per-thread
# stream/device contexts, so any work hitting the model must happen on the
# same thread that ran the first transcribe() call. FastAPI's default sync-
# handler thread pool would otherwise yield
#   `RuntimeError: There is no Stream(gpu, 0) in current thread.`
# This executor serialises all transcription calls.
_inference_executor: concurrent.futures.ThreadPoolExecutor | None = None
_model_ready = False


def _worker_init() -> None:
    """Runs once when the inference worker thread starts."""
    mx.set_default_device(mx.gpu)
    log.info("Inference worker thread initialised (default device = GPU)")


def _worker_warmup() -> None:
    """Trigger model load by running a tiny transcribe() on 1 second of silence.
    mlx-whisper loads weights lazily inside transcribe(); doing it once here
    means the first user request hits a warm model."""
    global _model_ready
    log.info("Pre-warming MLX Whisper model: %s", MODEL_ID)
    silence = np.zeros(16000, dtype=np.int16)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        with wave.open(tmp_path, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(16000)
            w.writeframes(silence.tobytes())
        mlx_whisper.transcribe(
            tmp_path,
            path_or_hf_repo=MODEL_ID,
            fp16=True,
            verbose=False,
        )
        _model_ready = True
        log.info("Model warmed up and ready")
    except Exception as exc:  # noqa: BLE001
        log.error("Warmup failed (will load on first request): %s", exc)
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def _worker_transcribe(audio_path: str, language: Optional[str],
                       initial_prompt: Optional[str],
                       temperature: float) -> dict:
    """Run a single transcription on the worker thread."""
    kwargs: dict = {
        "path_or_hf_repo": MODEL_ID,
        "fp16": True,
        "verbose": False,
        "temperature": temperature,
    }
    if language:
        kwargs["language"] = language
    if initial_prompt:
        kwargs["initial_prompt"] = initial_prompt
    return mlx_whisper.transcribe(audio_path, **kwargs)


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

app = FastAPI(title="Agora Cosmica MLX STT (Apple Silicon)", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    global _inference_executor
    _inference_executor = concurrent.futures.ThreadPoolExecutor(
        max_workers=1, thread_name_prefix="mlx-stt", initializer=_worker_init,
    )
    # Block startup until warmup completes so /health reflects model state
    _inference_executor.submit(_worker_warmup).result()


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model": MODEL_ID,
        "model_loaded": _model_ready,
    }


@app.get("/v1/models")
def list_models() -> dict:
    owner = MODEL_ID.split("/", 1)[0] if "/" in MODEL_ID else "mlx-community"
    return {
        "object": "list",
        "data": [
            {
                "id": MODEL_ID,
                "object": "model",
                "owned_by": owner,
            }
        ],
    }


@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    model: str = Form(None),  # accepted-but-ignored for OpenAI SDK compat
    language: str = Form(None),
    prompt: str = Form(None),
    response_format: str = Form("json"),
    temperature: float = Form(0.0),
):
    fmt = response_format.lower()
    if fmt not in ("json", "text", "verbose_json"):
        raise HTTPException(
            status_code=400,
            detail=f"response_format={response_format!r} not supported (use json, text, or verbose_json)",
        )

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="empty audio upload")

    # mlx-whisper expects a file path (it shells out to ffmpeg for decoding).
    suffix = Path(file.filename or "audio.wav").suffix or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    log.info("transcribe lang=%s temp=%.2f bytes=%d", language, temperature, len(audio_bytes))

    try:
        future = _inference_executor.submit(
            _worker_transcribe, tmp_path, language, prompt, temperature,
        )
        try:
            result = future.result(timeout=120)
        except concurrent.futures.TimeoutError:
            raise HTTPException(status_code=504, detail="Transcription timed out after 120s")
        except Exception as exc:
            log.exception("Transcription failed")
            raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}")
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    text = (result.get("text") or "").strip()

    if fmt == "text":
        return PlainTextResponse(text)

    if fmt == "verbose_json":
        segments = result.get("segments", []) or []
        duration = max((s.get("end", 0.0) for s in segments), default=0.0)
        return {
            "task": "transcribe",
            "language": result.get("language"),
            "duration": duration,
            "text": text,
            "segments": segments,
        }

    return {"text": text}


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
