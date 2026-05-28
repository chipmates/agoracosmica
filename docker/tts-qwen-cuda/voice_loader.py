"""Voice essence loader for the Local Mode Qwen3-TTS server.

Fetches the 10 archetype voice references + precomputed speaker embeddings
from R2 (`media.agoracosmica.org/voices/...`) at server startup and caches
them on disk. The hot path (every TTS request) reads from the local cache;
the only network call is the one-time fetch on first run.

Layout on R2:
    voices/
        manifest.json
        <slug>/
            reference.wav
            embedding.json
            metadata.json
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import httpx

log = logging.getLogger("voice_loader")


@dataclass
class Voice:
    slug: str
    gender: str
    reference_path: Path
    embedding: Optional[List[float]]
    sample_rate: int


class VoiceLoader:
    def __init__(self, r2_base: str, cache_dir: Path) -> None:
        self.r2_base = r2_base.rstrip("/")
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.voices: Dict[str, Voice] = {}

    def load(self) -> Dict[str, Voice]:
        """Load the manifest (local cache first, R2 fetch as fallback) and
        ensure all referenced files are cached.

        This lets the loader work in two deployment shapes:
          1. Hosted/agoracosmica: empty cache on first start, fetches from
             VOICES_R2_BASE, persists locally.
          2. OSS-shipped (chipmates/qwen3-tts-mlx): cache_dir is
             pre-populated by the install script with bundled voices;
             VOICES_R2_BASE is irrelevant and never reached.
        """
        local_manifest = self.cache_dir / "manifest.json"
        if local_manifest.exists():
            log.info("Loading voice manifest from local cache: %s", local_manifest)
            manifest = json.loads(local_manifest.read_text())
        else:
            manifest = self._fetch_json("manifest.json")
            local_manifest.write_text(json.dumps(manifest))
        for entry in manifest.get("voices", []):
            slug = entry["slug"]
            try:
                voice = self._load_voice(slug, entry)
            except Exception as exc:  # noqa: BLE001 — a single bad voice shouldn't kill startup
                log.warning("Failed to load voice %s: %s", slug, exc)
                continue
            self.voices[slug] = voice
        log.info("Loaded %d voices: %s", len(self.voices), sorted(self.voices.keys()))
        return self.voices

    def get(self, slug: str) -> Optional[Voice]:
        return self.voices.get(slug)

    def fallback_slug(self, requested: str) -> Optional[str]:
        """Pick a same-gender alternative when the requested slug isn't loaded."""
        if requested in self.voices:
            return requested
        gender = requested[:1] if requested else ""
        candidates = [s for s, v in self.voices.items() if v.gender == gender]
        if candidates:
            return sorted(candidates)[0]
        return next(iter(sorted(self.voices.keys())), None)

    # ------------------------------------------------------------ internals

    def _load_voice(self, slug: str, entry: dict) -> Voice:
        voice_dir = self.cache_dir / slug
        voice_dir.mkdir(parents=True, exist_ok=True)

        ref_path = voice_dir / "reference.wav"
        emb_path = voice_dir / "embedding.json"
        meta_path = voice_dir / "metadata.json"

        if not ref_path.exists():
            self._fetch_binary(f"{slug}/reference.wav", ref_path)
        if not emb_path.exists():
            self._fetch_binary(f"{slug}/embedding.json", emb_path)
        if not meta_path.exists():
            self._fetch_binary(f"{slug}/metadata.json", meta_path)

        try:
            embedding = json.loads(emb_path.read_text())
            if not isinstance(embedding, list):
                embedding = None
        except Exception:
            embedding = None

        try:
            metadata = json.loads(meta_path.read_text())
            sample_rate = int(metadata.get("sample_rate", 24000))
            gender = str(metadata.get("gender") or entry.get("gender") or slug[:1])
        except Exception:
            sample_rate = 24000
            gender = str(entry.get("gender") or slug[:1])

        return Voice(
            slug=slug,
            gender=gender,
            reference_path=ref_path,
            embedding=embedding,
            sample_rate=sample_rate,
        )

    def _fetch_json(self, path: str) -> dict:
        url = f"{self.r2_base}/{path}"
        log.info("Fetching %s", url)
        with httpx.Client(timeout=30.0) as client:
            response = client.get(url)
            response.raise_for_status()
            return response.json()

    def _fetch_binary(self, path: str, dest: Path) -> None:
        url = f"{self.r2_base}/{path}"
        log.info("Fetching %s → %s", url, dest)
        with httpx.Client(timeout=60.0) as client:
            response = client.get(url)
            response.raise_for_status()
            dest.write_bytes(response.content)
