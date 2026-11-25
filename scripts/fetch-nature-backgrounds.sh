#!/usr/bin/env bash
# fetch-nature-backgrounds.sh — download 5 nature clips from Mixkit (free
# commercial-use license, no attribution required) and re-encode them as
# compressed seamless-friendly vertical loops for the built-in background
# library: public/assets/bg-library/nature-{1..5}-*.mp4
#
# Re-run safe: skips files that already pass the ffprobe checks.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/assets/bg-library"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# id|name|url|source-page|duration-sec (dense motion clips use 6s to stay ≤3MB)
CLIPS=(
  "nature-1-clouds|غيوم فوق الجبال|https://assets.mixkit.co/videos/2168/2168-1080.mp4|https://mixkit.co/free-stock-video/clouds/|9"
  "nature-2-waves|أمواج البحر|https://assets.mixkit.co/videos/1191/1191-1080.mp4|https://mixkit.co/free-stock-video/waves/|9"
  "nature-3-sunset|غروب السحر|https://assets.mixkit.co/videos/1780/1780-360.mp4|https://mixkit.co/free-stock-video/sunset/|9"
  "nature-4-leaves|أوراق تتمايل|https://assets.mixkit.co/videos/1188/1188-1080.mp4|https://mixkit.co/free-stock-video/leaves/|6|720"
  "nature-5-river|جدول رقراق|https://assets.mixkit.co/videos/1494/1494-360.mp4|https://mixkit.co/free-stock-video/river/|9"
)

encode() { # $1=src $2=dst $3=crf $4=duration $5=short-side (1080 default)
  local side="${5:-}"
  side="${side:-1080}"
  local h=$((side * 16 / 9))
  ffmpeg -y -loglevel error -i "$1" -t "$4" -an \
    -vf "scale=${side}:${h}:force_original_aspect_ratio=increase,crop=${side}:${h},fps=24" \
    -c:v libx264 -crf "$3" -preset veryfast -pix_fmt yuv420p \
    -movflags +faststart "$2"
}

probe_ok() { # $1=file $2=want-dur $3=short-side → 0 when valid and ≤3MB
  local f="$1"
  local info dur
  info="$(ffprobe -v error -select_streams v:0 \
    -show_entries stream=codec_name,width,height,pix_fmt -of csv=p=0 "$f")"
  dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"
  local size want
  size=$(stat -c%s "$f")
  want="${2:-9}"
  local exp_size="${3:-1080}"
  local exp_h=$((exp_size * 16 / 9))
  [[ "$info" == "h264,${exp_size},${exp_h},yuv420p" ]] || return 1
  awk -v d="$dur" -v w="$want" 'BEGIN{exit !(d >= w - 0.5)}' || return 1
  (( size <= 3 * 1024 * 1024 )) || return 1
  return 0
}

for entry in "${CLIPS[@]}"; do
  IFS='|' read -r id name url page dur side <<<"$entry"
  dst="$OUT/$id.mp4"
  echo "== $id ($name)"
  if [[ -f "$dst" ]] && probe_ok "$dst" "$dur" "$side"; then
    echo "   already OK — skipping"
    continue
  fi
  src="$TMP/$id-raw.mp4"
  curl -sL --max-time 120 -o "$src" "$url"
  [[ $(stat -c%s "$src") -gt 100000 ]] || { echo "   download too small — FAILED"; exit 1; }
  # Try crf ladder until ≤3MB (visual quality stays high; 9s of soft nature)
  for crf in 28 30 32 34; do
    encode "$src" "$dst" "$crf" "$dur" "$side"
    if probe_ok "$dst" "$dur" "$side"; then echo "   OK ($(numfmt --to=iec --suffix=B $(stat -c%s "$dst")), crf=$crf)"; break; fi
    [[ "$crf" == 34 ]] && { echo "   cannot fit 3MB even at crf34 — FAILED"; exit 1; }
  done
done

echo "all nature backgrounds ready."
