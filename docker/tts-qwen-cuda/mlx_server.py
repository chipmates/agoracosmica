"""Local Mode DE TTS server for Apple Silicon (MLX backend).

Mirrors the OpenAI-compatible interface of the production CUDA Qwen3-TTS
server (`server.py` in this directory) but uses mlx-audio's voice-cloning
inference instead of faster_qwen3_tts. Endpoints:

    POST /v1/audio/speech   — OpenAI-shape: {model, input, voice, response_format, speed, language}
    GET  /health            — liveness probe used by the Local Mode panel
    GET  /v1/audio/voices   — voice catalog for discoverability

Voice resolution:
    The `voice` field is an archetype slug (e.g. `m1_warm_elder_v2`). The
    server maps the slug to a local WAV reference + transcript via the same
    R2-backed voice cache used by the CUDA path (`voice_loader.VoiceLoader`).
    On first start the loader fetches `manifest.json` + per-voice files from
    `VOICES_R2_BASE`; subsequent starts hit the local cache.

Model:
    Defaults to `mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit` (matches the
    production `Qwen/Qwen3-TTS-12Hz-0.6B-Lite-Base` size class). Override via
    `QWEN_MODEL_ID` env var. The model is loaded once at startup and reused
    across requests — voice cloning is per-request via `ref_audio` + `ref_text`.

Environment:
    QWEN_MODEL_ID         HuggingFace repo id (default 0.6B-Base-8bit)
    VOICES_R2_BASE        Base URL for voice catalog (default media.agoracosmica.org/voices)
    VOICES_CACHE_DIR      Local cache dir (default ~/Library/AgoraLocalTTS/voices-cache)
    PORT                  HTTP port (default 8887)
    CORS_ALLOW_ORIGINS    Comma-separated origins for CORS (default *)
    REF_TEXT_FALLBACK     Used when a voice's metadata.json has no `transcript`
                          field. If unset, the auto-STT path is used (slow first
                          inference; downloads whisper-large-v3-turbo).
"""

from __future__ import annotations

import concurrent.futures
import io
import logging
import os
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

import mlx.core as mx
from mlx_audio.tts.utils import load_model
from mlx_audio.tts.generate import generate_audio

from voice_loader import VoiceLoader

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

MODEL_ID = os.environ.get("QWEN_MODEL_ID", "mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit")
VOICES_R2_BASE = os.environ.get("VOICES_R2_BASE", "https://media.agoracosmica.org/voices")
VOICES_CACHE_DIR = Path(os.environ.get(
    "VOICES_CACHE_DIR",
    str(Path.home() / "Library" / "AgoraLocalTTS" / "voices-cache"),
))
PORT = int(os.environ.get("PORT", "8887"))
CORS_ORIGINS = os.environ.get("CORS_ALLOW_ORIGINS", "*").split(",")
REF_TEXT_FALLBACK = os.environ.get("REF_TEXT_FALLBACK", "")

# Lazy-resolved ffmpeg path. iOS Safari can't reliably play WAV from blob URLs,
# so LAN-deployed Apple Silicon homelabs serving iOS clients need MP3. If
# ffmpeg isn't on PATH the server still works for WAV — MP3 requests get a
# clear 503 instead of silently downgrading.
_FFMPEG = shutil.which("ffmpeg")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("mlx_server")

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

# Friendly-name → technical-slug mapping for the 10 archetype voices.
# Cosmic-themed names (Lyra, Astra, Solaris, ...) match the agoracosmica
# client UI labels. Both forms work in the /v1/audio/speech `voice` field:
#   voice: "lyra"             → resolves to f1_warm_wise_v1
#   voice: "f1_warm_wise_v1"  → used directly (technical alias)
# When this server is extracted as chipmates/qwen3-tts-mlx, this dict moves
# to a bundled voices.json that ships with the repo.
FRIENDLY_VOICES: dict[str, dict] = {
    # Female (ranked by Michel)
    "lyra":      {"slug": "f1_warm_wise_v1",        "gender": "female", "character": "warm-wise",   "rank": 1},
    "astra":     {"slug": "f5_deep_commanding_v2",  "gender": "female", "character": "commanding",  "rank": 2},
    "vega":      {"slug": "f1_warm_wise_v2",        "gender": "female", "character": "wise",        "rank": 3},
    "andromeda": {"slug": "f2_commanding_thinker_v1", "gender": "female", "character": "intellectual", "rank": 4},
    "ceres":     {"slug": "f1_warm_mentor_v2",      "gender": "female", "character": "nurturing",   "rank": 5},
    # Male (ranked by Michel)
    "solaris":   {"slug": "m3_rich_narrator_v3",    "gender": "male",   "character": "narrator",    "rank": 1},
    "umbra":     {"slug": "m5_rich_baritone_v1",    "gender": "male",   "character": "baritone",    "rank": 2},
    "phoenix":   {"slug": "m1_warm_elder_v3",       "gender": "male",   "character": "elder",       "rank": 3},
    "hyperion":  {"slug": "m1_warm_elder_v2",       "gender": "male",   "character": "elder",       "rank": 4},
    "corvus":    {"slug": "m3_intellectual_v2",     "gender": "male",   "character": "intellectual", "rank": 5},
}
SLUG_TO_FRIENDLY: dict[str, str] = {v["slug"]: k for k, v in FRIENDLY_VOICES.items()}


def _resolve_voice_slug(voice_param: str) -> str:
    """Accept either friendly name (e.g., 'lyra') or technical slug. Return slug."""
    if voice_param in FRIENDLY_VOICES:
        return FRIENDLY_VOICES[voice_param]["slug"]
    return voice_param


_voices: VoiceLoader | None = None

# Dedicated single-worker thread for all MLX inference. MLX uses per-thread
# stream/device contexts, so model loading + inference must happen on the same
# thread; FastAPI's default sync-handler thread pool would otherwise yield
# `RuntimeError: There is no Stream(gpu, 0) in current thread.` This executor
# serialises all synth calls and owns the model.
_model_holder: dict = {}
_inference_executor: concurrent.futures.ThreadPoolExecutor | None = None


def _worker_init() -> None:
    """Runs once when the inference worker thread starts."""
    mx.set_default_device(mx.gpu)
    log.info("Inference worker thread initialised (default device = GPU)")


def _worker_load_model() -> None:
    """Load the MLX model onto the worker thread (called from the executor so
    the model lives on the same thread that will later call generate_audio)."""
    log.info("Loading MLX model: %s", MODEL_ID)
    _model_holder["model"] = load_model(MODEL_ID)
    log.info("Model loaded on worker thread")


def _worker_synth(text: str, ref_audio: str, ref_text: Optional[str],
                  lang: str, speed: float, tmp_dir: str) -> list[Path]:
    """Run a single synthesis on the worker thread. Returns the list of WAV
    files mlx-audio wrote to tmp_dir."""
    generate_audio(
        model=_model_holder["model"],
        text=text,
        ref_audio=ref_audio,
        ref_text=ref_text,
        lang_code=lang,
        audio_format="wav",
        output_path=tmp_dir,
        file_prefix="out",
        save=True,
        play=False,
        speed=speed,
        verbose=False,
    )
    return sorted(Path(tmp_dir).glob("out*.wav"))


def _init_voices() -> None:
    global _voices
    log.info("Loading voice catalog from %s into %s", VOICES_R2_BASE, VOICES_CACHE_DIR)
    _voices = VoiceLoader(r2_base=VOICES_R2_BASE, cache_dir=VOICES_CACHE_DIR)
    try:
        _voices.load()
    except Exception as exc:  # noqa: BLE001 — fail open: empty catalog, requests will 503
        log.warning("Voice catalog load failed: %s. Server will start, "
                    "but requests will 503 until voices are reachable.", exc)


def _read_metadata_transcript(voice_slug: str) -> Optional[str]:
    """Read the transcript field from a voice's metadata.json if present."""
    meta_path = VOICES_CACHE_DIR / voice_slug / "metadata.json"
    if not meta_path.exists():
        return None
    try:
        import json
        return json.loads(meta_path.read_text()).get("transcript")
    except Exception:
        return None


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

app = FastAPI(title="Agora Cosmica MLX TTS (Apple Silicon)", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class SpeechRequest(BaseModel):
    model: str = Field(default="qwen3-tts-mlx", description="Accepted-but-ignored for SDK compat")
    input: str = Field(..., description="Text to synthesize")
    voice: str = Field(default="m1_warm_elder_v2", description="Archetype slug")
    response_format: str = Field(default="wav", description="wav | mp3 (mp3 requires ffmpeg on PATH)")
    speed: float = Field(default=1.0, description="Speech speed, 0.5-1.5")
    language: str = Field(default="de", description="ISO 639-1 language code (de, en)")


@app.on_event("startup")
def _startup() -> None:
    global _inference_executor
    _init_voices()
    _inference_executor = concurrent.futures.ThreadPoolExecutor(
        max_workers=1, thread_name_prefix="mlx-tts", initializer=_worker_init,
    )
    # Submit model load synchronously so /health reflects the real model state
    _inference_executor.submit(_worker_load_model).result()


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model": MODEL_ID,
        "voices_loaded": len(_voices.voices) if _voices else 0,
        "model_loaded": "model" in _model_holder,
    }


@app.get("/v1/audio/voices")
def voices() -> dict:
    if not _voices:
        return {"voices": []}
    out = []
    for v in _voices.voices.values():
        friendly = SLUG_TO_FRIENDLY.get(v.slug)
        entry = {
            "slug": v.slug,
            "gender": v.gender,
            "sample_rate": v.sample_rate,
        }
        if friendly:
            meta = FRIENDLY_VOICES[friendly]
            entry["id"] = friendly
            entry["name"] = friendly.capitalize()
            entry["character"] = meta["character"]
            entry["rank"] = meta["rank"]
        out.append(entry)
    # Sort: female-first then male, by rank within gender
    return {
        "voices": sorted(out, key=lambda x: (x.get("gender", "z"), x.get("rank", 99)))
    }


@app.post("/v1/audio/speech")
def speech(req: SpeechRequest) -> Response:
    fmt = req.response_format.lower()
    if fmt in ("mpeg",):
        fmt = "mp3"
    if fmt not in ("wav", "wave", "mp3"):
        raise HTTPException(status_code=400,
                            detail=f"response_format={req.response_format!r} not supported (use wav or mp3)")
    if fmt == "mp3" and _FFMPEG is None:
        raise HTTPException(status_code=503,
                            detail="MP3 requested but ffmpeg not on PATH; install via `brew install ffmpeg` or request wav")

    if not _voices or not _voices.voices:
        raise HTTPException(status_code=503,
                            detail="Voice catalog is empty — check VOICES_R2_BASE and restart")

    requested_slug = _resolve_voice_slug(req.voice)
    slug = _voices.fallback_slug(requested_slug) or requested_slug
    voice = _voices.get(slug)
    if voice is None:
        raise HTTPException(status_code=404, detail=f"Voice {req.voice!r} not found and no fallback available")

    if not voice.reference_path.exists():
        raise HTTPException(status_code=503, detail=f"Reference WAV missing for voice {slug!r}")

    ref_text = _read_metadata_transcript(slug) or REF_TEXT_FALLBACK
    # If neither metadata nor env-var fallback gives us a transcript, mlx-audio
    # will auto-STT the reference (slow first call, downloads whisper-large-v3).

    speed = max(0.5, min(1.5, float(req.speed)))
    lang = req.language.lower()[:2] if req.language else "de"

    log.info("synth voice=%s lang=%s len=%d fmt=%s", slug, lang, len(req.input), fmt)

    # Submit synth to the dedicated worker thread (model lives there too).
    # Wait synchronously for the result — FastAPI will already be running this
    # handler in its own thread, so the .result() call doesn't block the event loop.
    with tempfile.TemporaryDirectory() as tmp:
        future = _inference_executor.submit(
            _worker_synth,
            req.input,
            str(voice.reference_path),
            ref_text or None,
            lang,
            speed,
            tmp,
        )
        try:
            wav_files = future.result(timeout=120)
        except concurrent.futures.TimeoutError:
            raise HTTPException(status_code=504, detail="Inference timed out after 120s")
        except Exception as exc:
            log.exception("Inference failed")
            raise HTTPException(status_code=500, detail=f"Inference failed: {exc}")

        if not wav_files:
            raise HTTPException(status_code=500, detail="MLX produced no audio output")

        # Concatenate chunks if mlx-audio split the input
        if len(wav_files) == 1:
            wav_bytes = wav_files[0].read_bytes()
        else:
            wav_bytes = _concat_wavs(wav_files)

    if fmt == "mp3":
        try:
            audio_bytes = _wav_to_mp3(wav_bytes)
        except Exception as exc:
            log.exception("MP3 transcode failed")
            raise HTTPException(status_code=500, detail=f"MP3 transcode failed: {exc}")
        return Response(content=audio_bytes, media_type="audio/mpeg")

    return Response(content=wav_bytes, media_type="audio/wav")


def _wav_to_mp3(wav_bytes: bytes) -> bytes:
    """Transcode WAV bytes to MP3 via ffmpeg stdin/stdout. iOS Safari plays MP3
    reliably via HTML5 audio; WAV from blob URLs is flaky on the same path.

    Settings: libmp3lame at 128k CBR, sample rate inherited from WAV. Good
    enough for voice; opus would be smaller but iOS Safari support is uneven.
    """
    if _FFMPEG is None:
        raise RuntimeError("ffmpeg not available")
    proc = subprocess.run(
        [_FFMPEG, "-loglevel", "error", "-f", "wav", "-i", "pipe:0",
         "-codec:a", "libmp3lame", "-b:a", "128k", "-f", "mp3", "pipe:1"],
        input=wav_bytes,
        capture_output=True,
        check=True,
        timeout=30,
    )
    return proc.stdout


def _concat_wavs(paths: list[Path]) -> bytes:
    """Concatenate same-format WAV files into a single WAV. mlx-audio guarantees
    matching sample rate / channels / sample width across chunks of the same call."""
    params = None
    frames = bytearray()
    for p in paths:
        with wave.open(str(p), "rb") as w:
            if params is None:
                params = w.getparams()
            frames.extend(w.readframes(w.getnframes()))
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setparams(params)
        w.writeframes(frames)
    return out.getvalue()


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
