#!/usr/bin/env python3
"""
generate-islamic-backgrounds.py — procedural Islamic animated backgrounds
for the Mushaf Studio built-in library (public/assets/bg-library/).

Generates 5 seamless 8-second loops (96 frames @ 12fps, 1080x1920 vertical,
H.264 yuv420p, silent) rendered with numpy + PIL and piped to ffmpeg:

  islamic-1-star-rotate   — rotating eight-point star + gold dust on navy
  islamic-2-arabesque     — breathing arabesque fan pattern
  islamic-3-geometry      — twinkling octagon lattice
  islamic-4-lanterns      — swaying Ramadan lanterns with flickering flames
  islamic-5-light-rays    — light rays streaming from a heavenly opening

Every animation parameter is a multiple of the loop frequency so frame 96
equals frame 0 (seamless loop). Run once; outputs are committed assets.
"""
import io
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

W, H = 1080, 1920
FRAMES, FPS = 96, 12
LOOP = FRAMES / FPS  # 8 seconds
OUT = Path(__file__).resolve().parents[1] / "public" / "assets" / "bg-library"
OUT.mkdir(parents=True, exist_ok=True)


def lerp(a, b, t):
    return a + (b - a) * t


def vgrad(top, bottom):
    """Vertical gradient background as HxWx3 float array."""
    t = np.linspace(0, 1, H)[:, None, None]  # (H,1,1)
    col = top[None, None, :] * (1 - t) + bottom[None, None, :] * t  # (H,1,3)
    return np.broadcast_to(col, (H, W, 3)).copy()


def rgba_frame(arr):
    """Float HxWx3 (0..255) → RGB PIL image (opaque base)."""
    rgb = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(rgb, "RGB")


def draw_layer(img):
    """Transparent overlay layer; composite with alpha_composite for real
    alpha blending (ImageDraw's "RGBA" mode replaces alpha, it doesn't blend)."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    return layer, ImageDraw.Draw(layer, "RGBA")


def encode(name, frames_iter, crf=26):
    """Pipe RGBA PIL frames into ffmpeg → seamless H.264 loop."""
    out_file = OUT / f"{name}.mp4"
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-framerate", str(FPS), "-f", "image2pipe", "-i", "-",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", str(crf),
        "-preset", "veryfast", "-movflags", "+faststart", "-an",
        str(out_file),
    ]


    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for frame in frames_iter:
        buf = io.BytesIO()
        frame.save(buf, format="PNG")
        proc.stdin.write(buf.getvalue())
    proc.stdin.close()
    if proc.wait() != 0:
        sys.exit(f"ffmpeg failed for {name}")
    size_mb = out_file.stat().st_size / 1024 / 1024
    print(f"  {name}.mp4 — {size_mb:.2f} MB")
    return out_file


# ---------------------------------------------------------------- 1. star
def gen_star_rotate():
    """Eight-point star (two rotated squares) slowly spinning over a navy
    gradient, outlined in gold with a soft glow, plus drifting gold dust."""
    navy_top = np.array([26, 36, 64], dtype=float)
    navy_bot = np.array([13, 18, 32], dtype=float)

    def star_points(cx, cy, r, rot):
        pts = []
        for k in range(8):  # 8-pointed star: alternate outer/inner radii
            ang = rot + k * np.pi / 4
            rad = r if k % 2 == 0 else r * 0.55
            pts.append((cx + rad * np.sin(ang), cy - rad * np.cos(ang)))
        return pts

    dust = np.array([
        (np.random.RandomState(i).rand(), 0.1 + 0.8 * np.random.RandomState(i + 50).rand(),
         2 + 4 * np.random.RandomState(i + 100).rand())
        for i in range(40)
    ])

    for i in range(FRAMES):
        t = i / FRAMES * LOOP
        img = rgba_frame(vgrad(navy_top, navy_bot))
        layer, d = draw_layer(img)
        rot = t / LOOP * 2 * np.pi  # exactly one revolution per loop → seamless
        cx, cy = W / 2, H * 0.42
        for grow, alpha in ((1.0, 120), (0.72, 170)):
            r = 340 * grow
            pts = star_points(cx, cy, r, rot)
            d.polygon(pts, fill=(201, 162, 39, 0), outline=(201, 162, 39, alpha), width=6)
            d.polygon(star_points(cx, cy, r * 0.8, rot + np.pi / 8),
                      fill=(201, 162, 39, 0), outline=(201, 162, 39, int(alpha * 0.7)), width=3)
        # small satellite stars echoing the pattern
        for sx, sy, sr in ((W * 0.16, H * 0.2, 70), (W * 0.84, H * 0.66, 90), (W * 0.22, H * 0.82, 55)):
            pts = star_points(sx, sy, sr, -rot * 0.5)
            d.polygon(pts, fill=(201, 162, 39, 0), outline=(230, 199, 90, 130), width=3)
        # gold dust drifting upward, wrapped (loop-periodic by construction)
        for fx, fy, fr in dust:
            y = (fy - t / LOOP) % 1.0
            alpha = int(160 * (0.5 + 0.5 * np.sin(t * 2 * np.pi + fx * 10)))
            d.ellipse((fx * W - fr, y * H - fr, fx * W + fr, y * H + fr),
                      fill=(230, 199, 90, alpha))
        yield Image.alpha_composite(img.convert('RGBA'), layer)


# ----------------------------------------------------------- 2. arabesque
def gen_arabesque():
    """Breathing arabesque: radial fan of palmette arcs whose radii oscillate
    on emerald/deep-teal gradient. Breathing completes N whole cycles per loop."""
    top = np.array([16, 46, 44], dtype=float)
    bot = np.array([8, 22, 26], dtype=float)

    def palmette(d, cx, cy, base_r, wob, rot, alpha):
        # Draw a 6-petal rosette: petals are circular arcs at 60° spacing
        for k in range(6):
            ang = rot + k * np.pi / 3
            px = cx + base_r * 0.62 * np.cos(ang)
            py = cy + base_r * 0.62 * np.sin(ang)
            r = base_r * (0.30 + 0.12 * wob)
            d.ellipse((px - r, py - r, px + r, py + r),
                      fill=(68, 178, 152, alpha // 3), outline=(201, 226, 190, alpha), width=3)

    for i in range(FRAMES):
        t = i / FRAMES * LOOP
        img = rgba_frame(vgrad(top, bot))
        layer, d = draw_layer(img)
        phase = t / LOOP * 2 * np.pi * 2  # 2 breaths per 8s loop
        wob = np.sin(phase)
        cx, cy = W / 2, H / 2
        for ring in range(3):
            r = 250 + ring * 210
            palmette(d, cx, cy, r, wob * (1 - ring * 0.25), ring * 0.35 + phase * 0.5,
                     max(24, 90 - ring * 26))
        yield Image.alpha_composite(img.convert('RGBA'), layer)


# ------------------------------------------------------------ 3. geometry
def gen_geometry():
    """Twinkling octagon lattice: grid of octagon outlines whose opacities
    oscillate with random (but fixed-seed) phases; gold on midnight blue."""
    top = np.array([24, 30, 56], dtype=float)
    bot = np.array([10, 12, 28], dtype=float)
    cols, rows = 4, 7
    cell = W / cols
    rng = np.random.RandomState(7)
    phases = rng.rand(rows, cols) * 2 * np.pi
    rates = 1 + (rng.rand(rows, cols) * 3).astype(int)  # integer cycles per loop → seamless

    for i in range(FRAMES):
        t = i / FRAMES * LOOP
        img = rgba_frame(vgrad(top, bot))
        layer, d = draw_layer(img)
        for row in range(rows):
            for col in range(cols):
                cx = (col + 0.5) * cell
                cy = (row + 0.5) * (H / rows) * (rows * cell / H) + (row * (H - rows * 0) / rows) * 0
                cy = (row + 0.5) * (H / rows)
                pulse = 0.5 + 0.5 * np.sin(t / LOOP * 2 * np.pi * rates[row, col] + phases[row, col])
                s = cell * (0.30 + 0.10 * pulse)  # breathing size (loop-periodic)
                oct_pts = []
                for k in range(8):
                    ang = k * np.pi / 4 + np.pi / 8
                    oct_pts.append((cx + s * np.cos(ang), cy + s * np.sin(ang)))
                a = int(40 + 60 * pulse)
                d.polygon(oct_pts, outline=(230, 199, 90, a), width=5)
                d.polygon(oct_pts, fill=(201, 162, 39, max(0, int(a * 0.35))), outline=None)
        yield Image.alpha_composite(img.convert('RGBA'), layer)


# ------------------------------------------------------------ 4. lanterns
def gen_lanterns():
    """Swaying lanterns: three hanging Ramadan lanterns on pendulum arcs with
    flickering warm flames, over a deep indigo night."""
    top = np.array([30, 24, 58], dtype=float)
    bot = np.array([12, 10, 28], dtype=float)

    def lantern(d, x, y, sway, size, flick):
        # pendulum offset (2 whole swings per loop → seamless)
        dx = sway * np.sin(2 * np.pi * 2 * (y * 0))
        # swing angle over time passed via caller
        d.line((x, 0, x + dx, y), fill=(120, 110, 90, 160), width=3)
        lx, ly = x + dx, y
        # body: tapered dome + cage
        w_, h_ = size, size * 1.55
        d.polygon([(lx - w_ / 2, ly), (lx + w_ / 2, ly),
                   (lx + w_ * 0.32, ly + h_), (lx - w_ * 0.32, ly + h_)],
                  fill=(201, 162, 39, 70), outline=(230, 199, 90, 200), width=3)
        d.polygon([(lx - w_ * 0.34, ly), (lx + w_ * 0.34, ly), (lx, ly - h_ * 0.38)],
                  fill=(201, 162, 39, 110), outline=(230, 199, 90, 210), width=3)
        # flame glow flickering at 12 cycles/loop (integer → seamless)
        fr = size * (0.22 + 0.05 * np.sin(2 * np.pi * 12 * (y * 0) + flick))
        d.ellipse((lx - fr * 2, ly + h_ * 0.35 - fr * 2, lx + fr * 2, ly + h_ * 0.35 + fr * 2),
                  fill=(255, 196, 87, 120 + int(30 * np.sin(flick))))

    for i in range(FRAMES):
        t = i / FRAMES * LOOP
        img = rgba_frame(vgrad(top, bot))
        layer, d = draw_layer(img)
        for x, y, size, ph in ((W * 0.22, 330, 120, 0.0), (W * 0.62, 480, 150, 2.1),
                               (W * 0.38, 660, 100, 4.2)):
            ang = 0.16 * np.sin(2 * np.pi * 2 * t / LOOP + ph)  # pendulum: 2 swings/loop
            dx = np.sin(ang) * y
            lx = x + dx
            ly = y * np.cos(ang)
            d.line((x, 0, lx, ly), fill=(120, 110, 90, 150), width=3)
            w_, h_ = size, size * 1.55
            d.polygon([(lx - w_ / 2, ly), (lx + w_ / 2, ly),
                       (lx + w_ * 0.32, ly + h_), (lx - w_ * 0.32, ly + h_)],
                      fill=(201, 162, 39, 60), outline=(230, 199, 90, 200), width=3)
            d.polygon([(lx - w_ * 0.34, ly), (lx + w_ * 0.34, ly), (lx, ly - h_ * 0.38)],
                      fill=(201, 162, 39, 100), outline=(230, 199, 90, 210), width=3)
            fr = size * 0.16 * (1 + 0.25 * np.sin(2 * np.pi * 12 * t / LOOP + ph))
            fy = ly + h_ * 0.38
            d.ellipse((lx - fr * 1.6, fy - fr * 1.9, lx + fr * 1.6, fy + fr * 1.9),
                      fill=(255, 196, 87, 150))
        yield Image.alpha_composite(img.convert('RGBA'), layer)


# ----------------------------------------------------------- 5. light rays
def gen_light_rays():
    """Light rays streaming down from a bright opening near the top; each
    ray's opacity oscillates (integer cycles per loop) over a dawn gradient."""
    top = np.array([64, 58, 88], dtype=float)
    bot = np.array([18, 16, 36], dtype=float)
    rng = np.random.RandomState(21)
    rays = [(rng.rand() * W, 0.10 + rng.rand() * 0.22, 1 + rng.randint(1, 4),
             rng.rand() * 2 * np.pi) for _ in range(9)]
    ox, oy = W * 0.5, -H * 0.18  # origin above the frame

    for i in range(FRAMES):
        t = i / FRAMES * LOOP
        img = rgba_frame(vgrad(top, bot))
        layer, d = draw_layer(img)
        # radiant core
        for r, a in ((W * 0.55, 34), (W * 0.34, 52), (W * 0.16, 74)):
            d.ellipse((ox - r, oy - r * 0.6, ox + r, oy + r * 0.6), fill=(255, 240, 200, a))
        for bx, slope, cycles, ph in rays:
            a = int(38 + 30 * np.sin(2 * np.pi * cycles * t / LOOP + ph))
            x0 = ox + (bx - W / 2) * 0.4
            d.polygon([(x0 - 60, oy), (x0 + 60, oy),
                       (x0 + 60 + slope * H, H), (x0 - 60 + slope * H, H)],
                      fill=(255, 236, 180, a))
        yield Image.alpha_composite(img.convert('RGBA'), layer)


GENS = {
    "islamic-1-star-rotate": gen_star_rotate,
    "islamic-2-arabesque": gen_arabesque,
    "islamic-3-geometry": gen_geometry,
    "islamic-4-lanterns": gen_lanterns,
    "islamic-5-light-rays": gen_light_rays,
}

if __name__ == "__main__":
    print(f"Generating {len(GENS)} Islamic backgrounds → {OUT}")
    for name, gen in GENS.items():
        encode(name, gen())
    print("done.")
