#!/bin/bash
# Test which mitigation fixes the OOM: measure peak RSS per variant.
set -u
DIR=/tmp/repro-job
run_variant() {
  local name="$1"; shift
  local filt="$1"
  local out="/tmp/repro-job/v_${name}.mp4"
  rm -f "$out"
  ( timeout 120 /usr/bin/ffmpeg -y \
      -loop 1 -framerate 30 -t 12 -i "$DIR/backdrop.png" \
      -stream_loop -1 -framerate 12 -start_number 0 -i "$DIR/ambient_%03d.png" \
      -f concat -safe 0 -i "$DIR/slides_list.txt" \
      -i "$DIR/audio_final.m4a" \
      -filter_complex "$filt" \
      -map "[vout]" -map 3:a:0 \
      -c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p \
      -fps_mode cfr -r 30 -c:a copy -t 10 "$out" >/dev/null 2>&1 ) &
  local pid=$!
  local MAXRSS=0
  while kill -0 $pid 2>/dev/null; do
    local RSS=$(ps -o rss= -C ffmpeg 2>/dev/null | awk '{s+=$1} END {print s+0}')
    [ "$RSS" -gt "$MAXRSS" ] && MAXRSS=$RSS
    sleep 0.3
  done
  wait $pid; local RC=$?
  local SIZE=$(stat -c%s "$out" 2>/dev/null || echo 0)
  echo "[$name] rc=$RC size=$SIZE maxRSS=$((MAXRSS/1024))MB"
}

SLIDES="[2:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1,fps=30,format=rgba[slides]"

echo "== A: CURRENT CODE (fps=30 upsample + full-res rgba) =="
run_variant A_current "[1:v]scale=1080:1920:force_original_aspect_ratio=decrease,setsar=1,fps=30,format=rgba[amb];[0:v][amb]overlay=0:0,format=rgba[bgamb];${SLIDES};[bgamb][slides]overlay=0:0,format=yuv420p[vout]"

echo "== B: no fps upsample (12fps ambient, overlay repeats frames) =="
run_variant B_noUpsample "[1:v]scale=1080:1920:force_original_aspect_ratio=decrease,setsar=1,format=rgba[amb];[0:v][amb]overlay=0:0,format=rgba[bgamb];${SLIDES};[bgamb][slides]overlay=0:0,format=yuv420p[vout]"

echo "== C: yuv420p ambient (no rgba intermediate) =="
run_variant C_yuv "[1:v]scale=1080:1920:force_original_aspect_ratio=decrease,setsar=1,fps=30,format=yuva420p[amb];[0:v][amb]overlay=0:0,format=yuv420p[bgamb];${SLIDES/yuv420p/yuva420p};[bgamb][slides]overlay=0:0,format=yuv420p[vout]"

echo "== D: half-res ambient scaled up at overlay =="
run_variant D_halfres "[1:v]scale=540:960:force_original_aspect_ratio=decrease,setsar=1,fps=30,format=rgba[amb];[0:v]scale2ref[amb][bgref];[bgref][amb]overlay=(W-w)/2:(H-h)/2,format=rgba[bgamb];${SLIDES};[bgamb][slides]overlay=0:0,format=yuv420p[vout]"
