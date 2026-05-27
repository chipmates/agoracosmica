"""FastAPI server exposing Qwen3-TTS as an OpenAI-compatible
`/v1/audio/speech` endpoint.

Runtime:
    - Model: Qwen/Qwen3-TTS-12Hz-0.6B-Base (voice-clone "Base" variant)
    - Backend: faster-qwen3-tts (static CUDA-graph capture, single-stream
      optimised — no batching overhead for the local-mode single-user case).

Voices: 10 archetype slugs (e.g. m1_warm_elder_v2, f5_deep_commanding_v2)
loaded at startup from R2 via voice_loader.VoiceLoader. Each voice carries a
precomputed 1280-float speaker embedding; we prefer the embedding path
because it skips a per-request speaker-encoder forward (~30-50 ms faster
than passing the reference WAV every time).

Endpoint:
    POST /v1/audio/speech
    {
        "model": "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
        "input": "Die Philosophie lehrt uns die Wahrheit.",
        "voice": "m1_warm_elder_v2",
        "response_format": "wav"   # or "mp3"
    }
    -> audio/wav (24 kHz mono PCM) or audio/mpeg

Apple Silicon parity: the kapi2800/qwen3-tts-apple-silicon MLX port exposes
the same shape via the scripts/setup-local-tts-apple.sh launchd plist; the
client speaks the same JSON either way.
"""

from __future__ import annotations

import io
import logging
import os
import struct
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import Optional

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from tts_preprocess import preprocess_de
from voice_loader import VoiceLoader, Voice

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("qwen-tts-server")

MODEL_ID = os.environ.get("QWEN_MODEL_ID", "Qwen/Qwen3-TTS-12Hz-0.6B-Base")
VOICES_R2_BASE = os.environ.get("VOICES_R2_BASE", "https://media.agoracosmica.org/voices")
VOICES_CACHE_DIR = Path(os.environ.get("VOICES_CACHE_DIR", "/var/cache/agora-voices"))
TAIL_SILENCE_MS = int(os.environ.get("TTS_TAIL_SILENCE_MS", "150"))
DEFAULT_LANGUAGE = os.environ.get("QWEN_DEFAULT_LANGUAGE", "German")

app = FastAPI(title="Agora Cosmica Local Qwen3-TTS")
voice_loader: Optional[VoiceLoader] = None
tts_model = None


class SpeechRequest(BaseModel):
    model: str = Field(default=MODEL_ID)
    input: str
    voice: str
    response_format: str = Field(default="wav")
    speed: float = Field(default=1.0)
    task_type: str = Field(default="Base")
    language: str = Field(default=DEFAULT_LANGUAGE)


@app.on_event("startup")
def startup() -> None:
    global voice_loader, tts_model
    log.info("Loading voices from R2 base: %s", VOICES_R2_BASE)
    voice_loader = VoiceLoader(VOICES_R2_BASE, VOICES_CACHE_DIR)
    voice_loader.load()

    log.info("Loading Qwen3-TTS model: %s", MODEL_ID)
    # Lazy-import so the container starts even if faster-qwen3-tts has
    # transitive import issues that surface only on Python import.
    from faster_qwen3_tts import FasterQwen3TTS
    tts_model = FasterQwen3TTS.from_pretrained(MODEL_ID)
    log.info("Model ready. Voices loaded: %d", len(voice_loader.voices))


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok" if tts_model is not None and voice_loader is not None else "loading",
        "model": MODEL_ID,
        "voices_loaded": len(voice_loader.voices) if voice_loader else 0,
        "voice_slugs": sorted(voice_loader.voices.keys()) if voice_loader else [],
    }


@app.get("/v1/models")
def models() -> dict:
    return {
        "object": "list",
        "data": [{"id": MODEL_ID, "object": "model", "owned_by": "agoracosmica"}],
    }


@app.post("/v1/audio/speech")
def synthesize(req: SpeechRequest) -> Response:
    if tts_model is None or voice_loader is None:
        raise HTTPException(status_code=503, detail="Model still loading")

    slug = voice_loader.fallback_slug(req.voice)
    voice: Optional[Voice] = voice_loader.get(slug) if slug else None
    if not voice:
        raise HTTPException(status_code=404, detail=f"No voice loaded; requested '{req.voice}'")

    text = preprocess_de(req.input) if (req.language or "").lower().startswith(("de", "german")) else req.input

    # Prefer the embedding-path. Fall back to the ref-audio path if the
    # embedding is missing (re-download issue, R2 hiccup at startup).
    try:
        if voice.embedding is not None and hasattr(tts_model, "generate_with_embedding"):
            audio_chunks, sr = tts_model.generate_with_embedding(  # type: ignore[attr-defined]
                text=text,
                language=req.language or DEFAULT_LANGUAGE,
                speaker_embedding=voice.embedding,
            )
        else:
            audio_chunks, sr = tts_model.generate_voice_clone(
                text=text,
                language=req.language or DEFAULT_LANGUAGE,
                ref_audio=str(voice.reference_path),
                ref_text="",
            )
    except Exception as exc:
        log.exception("Qwen3-TTS generation failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    audio = _concatenate_audio(audio_chunks)
    audio = _append_silence(audio, sr, TAIL_SILENCE_MS)

    if req.response_format.lower() == "mp3":
        body = _encode_mp3(audio, sr)
        media_type = "audio/mpeg"
    else:
        body = _encode_wav(audio, sr)
        media_type = "audio/wav"

    return Response(content=body, media_type=media_type, headers={
        "X-Model": MODEL_ID,
        "X-Voice": voice.slug,
        "X-Backend": "qwen-local",
    })


# ----- audio helpers ---------------------------------------------------------


def _concatenate_audio(chunks) -> np.ndarray:
    """faster-qwen3-tts returns a list of numpy arrays — concatenate."""
    if isinstance(chunks, np.ndarray):
        return chunks.astype(np.float32, copy=False)
    arrays = [np.asarray(c, dtype=np.float32) for c in chunks if c is not None]
    if not arrays:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(arrays)


def _append_silence(audio: np.ndarray, sr: int, ms: int) -> np.ndarray:
    samples = max(0, int(sr * ms / 1000))
    if samples == 0:
        return audio
    silence = np.zeros(samples, dtype=audio.dtype)
    return np.concatenate([audio, silence])


def _encode_wav(audio: np.ndarray, sr: int) -> bytes:
    pcm = np.clip(audio, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sr)
        wav.writeframes(pcm.tobytes())
    return buf.getvalue()


def _encode_mp3(audio: np.ndarray, sr: int) -> bytes:
    """Encode via ffmpeg (already installed in the image). Single subprocess
    per request — slow on cold cache but plenty fast once warm. For latency-
    sensitive flows the client should request `wav` and let the browser decode
    natively."""
    wav_bytes = _encode_wav(audio, sr)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as wav_in:
        wav_in.write(wav_bytes)
        wav_in.flush()
        wav_path = wav_in.name
    mp3_path = wav_path.replace(".wav", ".mp3")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", wav_path, "-codec:a", "libmp3lame", "-b:a", "128k", mp3_path],
            check=True, capture_output=True,
        )
        return Path(mp3_path).read_bytes()
    finally:
        for p in (wav_path, mp3_path):
            try:
                os.unlink(p)
            except FileNotFoundError:
                pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8887")),
        log_level="warning",
    )
