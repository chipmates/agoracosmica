#!/usr/bin/env bash
# Agora Cosmica — Voice essences R2 upload (Local Mode v1.1.0)
#
# Uploads the 10 archetype voice references + precomputed embeddings + a
# manifest to the R2 bucket backing `media.agoracosmica.org`. The Qwen3-TTS
# container reads from these paths at startup.
#
# Prerequisites:
#   - npx wrangler (Cloudflare CLI) configured with R2 access
#   - The handover bundle present at sage/internal/agora-local-tts-handover/
#     (10 .wav files in refs/ and 10 .json files in embeddings/)
#   - Michel's confirmation that the 12 s R1/R2 originals are ChipMates-owned
#     (so the 8 s Qwen-clones are safe to redistribute via our CDN)
#
# Usage:
#   AGORA_R2_BUCKET=agora-cosmica ./scripts/upload-voice-essences.sh
#
# After running, verify:
#   curl -I https://media.agoracosmica.org/voices/m1_warm_elder_v2/reference.wav

set -euo pipefail

BUCKET="${AGORA_R2_BUCKET:-agora-cosmica}"
HANDOVER_DIR="${AGORA_VOICE_BUNDLE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../internal/agora-local-tts-handover" && pwd)}"
GENERATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ ! -d "${HANDOVER_DIR}" ]]; then
  echo "ERROR: voice handover bundle not found at ${HANDOVER_DIR}" >&2
  echo "Set AGORA_VOICE_BUNDLE to override the path." >&2
  exit 1
fi

VOICES=(
  "f1_warm_mentor_v2:f"
  "f1_warm_wise_v1:f"
  "f1_warm_wise_v2:f"
  "f2_commanding_thinker_v1:f"
  "f5_deep_commanding_v2:f"
  "m1_warm_elder_v2:m"
  "m1_warm_elder_v3:m"
  "m3_intellectual_v2:m"
  "m3_rich_narrator_v3:m"
  "m5_rich_baritone_v1:m"
)

echo "==> Uploading 10 voices to R2 bucket: ${BUCKET}"
echo "    handover dir: ${HANDOVER_DIR}"
echo ""

MANIFEST_ENTRIES=()

for entry in "${VOICES[@]}"; do
  slug="${entry%%:*}"
  gender="${entry##*:}"

  wav="${HANDOVER_DIR}/refs/${slug}.wav"
  emb="${HANDOVER_DIR}/embeddings/${slug}.json"

  if [[ ! -f "${wav}" ]]; then
    echo "ERROR: missing reference WAV: ${wav}" >&2
    exit 1
  fi
  if [[ ! -f "${emb}" ]]; then
    echo "ERROR: missing embedding JSON: ${emb}" >&2
    exit 1
  fi

  # File metadata
  if command -v stat >/dev/null 2>&1; then
    size=$(stat -f%z "${wav}" 2>/dev/null || stat -c%s "${wav}")
  else
    size=$(wc -c < "${wav}")
  fi

  if command -v ffprobe >/dev/null 2>&1; then
    duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "${wav}" 2>/dev/null || echo "0")
  else
    duration="0"
  fi

  if command -v shasum >/dev/null 2>&1; then
    sha_wav=$(shasum -a 256 "${wav}" | awk '{print $1}')
    sha_emb=$(shasum -a 256 "${emb}" | awk '{print $1}')
  else
    sha_wav=$(sha256sum "${wav}" | awk '{print $1}')
    sha_emb=$(sha256sum "${emb}" | awk '{print $1}')
  fi

  # Embedding dim — count floats in the JSON array
  emb_dim=$(python3 -c "import json; print(len(json.load(open('${emb}'))))" 2>/dev/null || echo "0")

  meta_tmp="$(mktemp -t agora-voice-meta.XXXXXX)"
  cat > "${meta_tmp}" <<EOF
{
  "slug": "${slug}",
  "gender": "${gender}",
  "sample_rate": 24000,
  "duration_s": ${duration},
  "file_size_bytes": ${size},
  "sha256_reference": "${sha_wav}",
  "sha256_embedding": "${sha_emb}",
  "embedding_dim": ${emb_dim},
  "license": "© ChipMates gemeinnützige GmbH, CC-BY 4.0 in coming months",
  "source": "Qwen3-TTS clone of ChipMates R1/R2 reference (originals not redistributed)"
}
EOF

  echo "==> ${slug}"
  npx wrangler r2 object put "${BUCKET}/voices/${slug}/reference.wav" \
    --file "${wav}" \
    --content-type audio/wav \
    --cache-control "public, max-age=31536000, immutable"
  npx wrangler r2 object put "${BUCKET}/voices/${slug}/embedding.json" \
    --file "${emb}" \
    --content-type application/json \
    --cache-control "public, max-age=31536000, immutable"
  npx wrangler r2 object put "${BUCKET}/voices/${slug}/metadata.json" \
    --file "${meta_tmp}" \
    --content-type application/json \
    --cache-control "public, max-age=31536000, immutable"

  MANIFEST_ENTRIES+=("{\"slug\":\"${slug}\",\"gender\":\"${gender}\",\"duration_s\":${duration},\"sha256_reference\":\"${sha_wav}\"}")

  rm -f "${meta_tmp}"
done

# Top-level manifest
manifest_tmp="$(mktemp -t agora-voice-manifest.XXXXXX)"
{
  printf '{\n  "version": 1,\n  "generated_at": "%s",\n  "voices": [\n    ' "${GENERATED_AT}"
  printf '%s' "${MANIFEST_ENTRIES[0]}"
  for ((i=1; i<${#MANIFEST_ENTRIES[@]}; i++)); do
    printf ',\n    %s' "${MANIFEST_ENTRIES[$i]}"
  done
  printf '\n  ]\n}\n'
} > "${manifest_tmp}"

echo ""
echo "==> manifest.json"
npx wrangler r2 object put "${BUCKET}/voices/manifest.json" \
  --file "${manifest_tmp}" \
  --content-type application/json \
  --cache-control "public, max-age=300"
rm -f "${manifest_tmp}"

echo ""
echo "==> Upload complete. Verifying with HEAD requests..."
sleep 2  # allow R2 propagation
for entry in "${VOICES[@]}"; do
  slug="${entry%%:*}"
  status=$(curl -sI "https://media.agoracosmica.org/voices/${slug}/reference.wav" | head -n1 | awk '{print $2}')
  echo "  ${slug}: HTTP ${status}"
done
status=$(curl -sI "https://media.agoracosmica.org/voices/manifest.json" | head -n1 | awk '{print $2}')
echo "  manifest.json: HTTP ${status}"

echo ""
echo "==> Done."
