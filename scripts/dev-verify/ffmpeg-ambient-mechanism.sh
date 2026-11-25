#!/bin/bash
# Empirical verification of the ambient-overlay FFmpeg mechanism:
# 1) -stream_loop -1 with an image2 sequence (ambient particle frames) loops correctly
# 2) 3-layer composite (backdrop -> animated ambient -> transparent top -> slides) works
# 3) aurora sway via overlay x-expression sin(t) works
# 4) PNG size budget at realistic dimensions
set -u
cd /tmp/fftest || exit 1
rm -f amb_*.png aurora.png below.png top.png slide.png out_*.mp4 frame_*.png

python3 - <<'PY'
from PIL import Image, ImageDraw
# 8 particle frames: a dot drifting right (simulates stars/gold-dust motion)
for i in range(8):
    im = Image.new('RGBA', (320, 480), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([40 + i * 20, 100, 52 + i * 20, 112], fill=(245, 248, 255, 180))
    im.save(f'amb_{i:03d}.png')
# aurora: one wide soft gradient frame (transparent bg)
im = Image.new('RGBA', (372, 480), (0, 0, 0, 0))  # 320*1.16 = 371.2 -> 372
d = ImageDraw.Draw(im)
for x in range(372):
    a = int(60 * (1 - abs(x - 186) / 186))
    d.line([(x, 60), (x, 480)], fill=(68, 178, 152, max(0, a)))
im.save('aurora.png')
below = Image.new('RGB', (320, 480), (16, 32, 48))
below.save('below.png')
top = Image.new('RGBA', (320, 480), (0, 0, 0, 0))
dt = ImageDraw.Draw(top)
for y in range(480):
    a = int(120 * (y / 480) ** 2)  # fake vignette-ish gradient
    dt.line([(0, y), (320, y)], fill=(0, 0, 0, a))
top.save('top.png')
slide = Image.new('RGBA', (320, 480), (0, 0, 0, 0))
ds = ImageDraw.Draw(slide)
ds.text((110, 220), 'AYAH', fill=(255, 255, 255, 255))
slide.save('slide.png')
print('fixtures ok')
PY

echo "=== TEST 1: particle frames loop + 3-layer composite ==="
ffmpeg -y -loglevel error \
  -loop 1 -framerate 10 -t 6 -i below.png \
  -stream_loop -1 -framerate 4 -start_number 0 -i amb_%03d.png \
  -loop 1 -framerate 10 -i top.png \
  -loop 1 -framerate 10 -i slide.png \
  -filter_complex "\
[1:v]scale=320:480,setsar=1,format=rgba[amb];\
[0:v][amb]overlay=0:0[b1];\
[2:v]scale=320:480,setsar=1,format=rgba[top];\
[b1][top]overlay=0:0[b2];\
[3:v]scale=320:480,setsar=1,format=rgba[sl];\
[b2][sl]overlay=0:0,format=yuv420p[vout]" \
  -map "[vout]" -t 6 -c:v libx264 -pix_fmt yuv420p out_particles.mp4 \
&& echo "PARTICLES_ENCODE_OK" || { echo "PARTICLES_ENCODE_FAIL"; exit 1; }

ffmpeg -y -loglevel error -ss 1 -i out_particles.mp4 -frames:v 1 frame_p1.png
ffmpeg -y -loglevel error -ss 3 -i out_particles.mp4 -frames:v 1 frame_p3.png
python3 - <<'PY'
from PIL import Image, ImageChops
a = Image.open('frame_p1.png').convert('RGB')
b = Image.open('frame_p3.png').convert('RGB')
diff = ImageChops.difference(a, b)
bbox = diff.getbbox()
# region WITHOUT text (top-left quadrant) must differ (dot moved)
region = diff.crop((0, 0, 160, 200))
changed = sum(1 for p in region.getdata() if p != (0, 0, 0))
print('dot-moved pixels in text-free region:', changed)
assert changed > 20, 'AMBIENT DID NOT ANIMATE'
print('PARTICLES_ANIMATION_OK')
PY

echo "=== TEST 2: aurora single-frame sway expression ==="
ffmpeg -y -loglevel error \
  -loop 1 -framerate 10 -t 6 -i below.png \
  -loop 1 -framerate 10 -i aurora.png \
  -loop 1 -framerate 10 -i slide.png \
  -filter_complex "\
[1:v]scale=372:480,setsar=1,format=rgba[amb];\
[0:v][amb]overlay=x='(W-w)/2+sin(t*0.6)*W*0.08':y=0[b1];\
[2:v]scale=320:480,setsar=1,format=rgba[sl];\
[b1][sl]overlay=0:0,format=yuv420p[vout]" \
  -map "[vout]" -t 6 -c:v libx264 -pix_fmt yuv420p out_aurora.mp4 \
&& echo "AURORA_ENCODE_OK" || { echo "AURORA_ENCODE_FAIL"; exit 1; }

ffmpeg -y -loglevel error -ss 1 -i out_aurora.mp4 -frames:v 1 frame_a1.png
ffmpeg -y -loglevel error -ss 5 -i out_aurora.mp4 -frames:v 1 frame_a5.png
python3 - <<'PY'
from PIL import Image, ImageChops
a = Image.open('frame_a1.png').convert('RGB')
b = Image.open('frame_a5.png').convert('RGB')
diff = ImageChops.difference(a, b)
changed = sum(1 for p in diff.getdata() if p != (0, 0, 0))
print('aurora sway changed pixels:', changed)
assert changed > 500, 'AURORA DID NOT MOVE'
print('AURORA_ANIMATION_OK')
PY

echo "=== TEST 3: PNG size budget at realistic dims ==="
python3 - <<'PY'
from PIL import Image, ImageDraw
import os
# particles frame at half of 1080x1920
im = Image.new('RGBA', (540, 960), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
import math, random
random.seed(7)
for i in range(68):
    x, y = random.random() * 540, random.random() * 960
    r = 1 + random.random() * 2
    a = int(120 + random.random() * 100)
    d.ellipse([x - r, y - r, x + r, y + r], fill=(245, 248, 255, a))
im.save('/tmp/fftest/size_particles.png', optimize=True)
# aurora wide frame at half res (626x960)
im2 = Image.new('RGBA', (626, 960), (0, 0, 0, 0))
d2 = ImageDraw.Draw(im2)
for x in range(626):
    dx = abs(x - 313) / 313
    a = int(56 * (1 - dx) ** 2)
    d2.line([(x, 0), (x, 960)], fill=(68, 178, 152, max(0, a)))
im2.save('/tmp/fftest/size_aurora.png', optimize=True)
p = os.path.getsize('/tmp/fftest/size_particles.png')
q = os.path.getsize('/tmp/fftest/size_aurora.png')
print(f'particles frame (540x960): {p/1024:.1f} KB  -> x96 frames = {p*96/1024/1024:.1f} MB')
print(f'aurora frame   (626x960): {q/1024:.1f} KB  -> single upload')
PY
echo "ALL_EMPIRICAL_TESTS_DONE"
