#!/bin/bash
# build-object.sh — one command from a build script to a manifest record.
#
#   forge/blender/build-object.sh <round-app> <script.py> [--stage model|bake|export|all]
#                                 [--size 4096] [--samples 96] [--via-eyes PORT]
#
# What it does, in order:
#   1. runs the script through Blender headless, with cwd = the round's app,
#      so every path the script writes is the round's own. Blender cannot run
#      inside a seat's sandbox (it segfaults at Metal detection), so when it
#      refuses this prints the eyes' /bake call to make instead and stops.
#   2. reads the receipt the script wrote (`build.json` in the object's work
#      folder): the tiers, their raw glbs, their atlas sizes.
#   3. packs each tier with gltfpack: meshopt geometry, ETC1S KTX2 maps, and
#      the tier's own texture limit (4096 / 2048 / 1024). A ninety megabyte
#      export becomes thirteen.
#   4. writes one manifest record per tier into the STORE's manifest for the
#      wing, naming the script and its hash, the blend, the model and the date.
#   5. prints the size and the triangle count per tier.
#
# NO BAKED LIGHT CROSSES. The kit's bake scene has no lamp and no sky in it,
# the export builds no emissive channel and carries no light atlas, and the
# occlusion the bake measures travels in the ORM texture, which is where glTF
# puts occlusion and where the museum's loader gives it to the ambient term
# alone. The stack's own key light models the brick.
set -euo pipefail

BLENDER=${BLENDER:-/opt/homebrew/bin/blender}
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GLTFPACK=${GLTFPACK:-"$HERE/../../../../internal/night-agora/tools/bin/gltfpack"}

APP=""; SCRIPT=""; STAGE="all"; SIZE=""; SAMPLES=""; EYES="${NA_EYES_PORT:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --stage) STAGE="${2:-all}"; shift ;;
    --size) SIZE="${2:-}"; shift ;;
    --samples) SAMPLES="${2:-}"; shift ;;
    --via-eyes) EYES="${2:-}"; shift ;;
    -h|--help) grep '^#' "$0" | sed 's/^#\{1,\} \{0,1\}//'; exit 0 ;;
    *) if [ -z "$APP" ]; then APP="$1"; elif [ -z "$SCRIPT" ]; then SCRIPT="$1";
       else echo "unexpected argument: $1" >&2; exit 2; fi ;;
  esac
  shift
done
[ -n "$APP" ] && [ -n "$SCRIPT" ] || { grep '^#' "$0" | sed 's/^#\{1,\} \{0,1\}//'; exit 2; }
APP="$(cd "$APP" && pwd)"
case "$SCRIPT" in /*) SCRIPT_ABS="$SCRIPT" ;; *) SCRIPT_ABS="$APP/$SCRIPT" ;; esac
[ -f "$SCRIPT_ABS" ] || { echo "no build script at $SCRIPT_ABS" >&2; exit 2; }
SCRIPT_REL="${SCRIPT_ABS#"$APP"/}"

ARGS=( --stage "$STAGE" )
[ -n "$SIZE" ] && ARGS+=( --size "$SIZE" )
[ -n "$SAMPLES" ] && ARGS+=( --samples "$SAMPLES" )

# --- 1. Blender, or the call to make instead -------------------------------
if ! "$BLENDER" --version >/dev/null 2>&1; then
  ARGJSON="$(printf '"%s",' "${ARGS[@]}" | sed 's/,$//')"
  cat >&2 <<MSG
Blender does not run here (a sandboxed seat cannot reach Metal). Run it
through the round's eyes instead, which run it outside the sandbox with
cwd = this app:

  curl -s -X POST http://127.0.0.1:${EYES:-<eyesPort>}/bake \\
    -H 'content-type: application/json' \\
    -d '{"script":"$SCRIPT_REL","args":[$ARGJSON],"timeoutSec":2400}'

Then run this script again with --stage export to pack and record.
MSG
  exit 3
fi

# the log lives beside the store with the blends and the atlases: a build log
# written into the repository is the work folder moving into public git
WORK_ROOT="$(python3 "$HERE/record.py" --work-root "$APP")"
[ -n "$WORK_ROOT" ] || { echo "no asset store found above $APP" >&2; exit 1; }
LOG="$WORK_ROOT/logs/build-$(basename "${SCRIPT_ABS%.py}").log"
mkdir -p "$(dirname "$LOG")"
echo "blender: $SCRIPT_REL --stage $STAGE (log: $LOG)"
( cd "$APP" && "$BLENDER" -b --factory-startup --python "$SCRIPT_ABS" -- "${ARGS[@]}" ) 2>&1 | tee "$LOG" | grep -E '^KIT|^Error|^Traceback' || true
grep -q '^KIT' "$LOG" || { echo "the build script printed nothing the kit recognises; see $LOG" >&2; exit 1; }

RECEIPT="$(grep '^KIT receipt ' "$LOG" | tail -1 | awk '{print $3}')"
if [ -z "$RECEIPT" ]; then
  echo "no receipt written (stage $STAGE): nothing to pack or record."
  exit 0
fi

# --- 2. the receipt --------------------------------------------------------
read -r ID SCOPE MODELS TIERS <<<"$(python3 - "$RECEIPT" <<'PY'
import json, sys
r = json.loads(open(sys.argv[1]).read())
print(r['id'], r['scope'], r['models'], ' '.join(sorted(r['tiers'])))
PY
)"
echo "object: $ID -> $MODELS"
mkdir -p "$MODELS"

# --- 3. the pack, one per tier --------------------------------------------
[ -x "$GLTFPACK" ] || { echo "no gltfpack at $GLTFPACK" >&2; exit 1; }
PAIRS=()
for TIER in $TIERS; do
  read -r RAW LIMIT <<<"$(python3 - "$RECEIPT" "$TIER" <<'PY'
import json, sys
r = json.loads(open(sys.argv[1]).read())
t = r['tiers'][sys.argv[2]]
print(f"{r['work']}/{t['file']}", t['texture_limit'])
PY
)"
  OUT="$MODELS/$ID-$TIER.glb"
  echo "gltfpack: $TIER  -cc -tc -tq 8 -tl $LIMIT"
  "$GLTFPACK" -i "$RAW" -o "$OUT" -cc -tc -tq 8 -tl "$LIMIT" -tj 8 >/dev/null
  PAIRS+=( "$TIER=$OUT" )
done

# --- 4. the record, and 5. the table --------------------------------------
python3 "$HERE/record.py" "$RECEIPT" "${PAIRS[@]}"
