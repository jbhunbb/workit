#!/usr/bin/env python3
"""Generate Workit.icns from scratch using only stdlib + Pillow."""
import struct, zlib, math, subprocess, shutil
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow", "-q"])
    from PIL import Image, ImageDraw, ImageFont

SIZES = [16, 32, 64, 128, 256, 512, 1024]

def make_icon_png(size: int) -> Image.Image:
    scale = size / 1024
    img   = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw  = ImageDraw.Draw(img)

    # Rounded-rect background with indigo gradient approximation
    r = int(size * 0.22)
    # Draw gradient by layering horizontal lines
    top    = (79, 70, 229)   # #4f46e5
    bottom = (129, 140, 248) # #818cf8
    for y in range(size):
        t   = y / size
        col = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        draw.line([(0, y), (size, y)], fill=col + (255,))

    # Mask to rounded rect
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    img.putalpha(mask)

    # Draw "W"
    pad   = int(size * 0.14)
    w_h   = size - pad * 2
    lw    = max(2, int(size * 0.075))  # stroke width
    pts   = [
        (pad,          pad),
        (pad + w_h//4, size - pad),
        (size // 2,    pad + int(w_h * 0.45)),
        (size - pad - w_h//4, size - pad),
        (size - pad,   pad),
    ]
    draw2 = ImageDraw.Draw(img)
    for i in range(len(pts) - 1):
        draw2.line([pts[i], pts[i+1]], fill=(255, 255, 255, 255), width=lw)

    return img


def build_iconset(out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    for s in SIZES:
        img = make_icon_png(s)
        img.save(out_dir / f"icon_{s}x{s}.png")
        if s <= 512:
            img2 = make_icon_png(s * 2)
            img2.save(out_dir / f"icon_{s}x{s}@2x.png")


if __name__ == "__main__":
    iconset = Path("Workit.iconset")
    build_iconset(iconset)
    result = subprocess.run(
        ["iconutil", "-c", "icns", str(iconset), "-o", "workit.icns"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print("iconutil error:", result.stderr)
        raise SystemExit(1)
    shutil.rmtree(iconset)
    print("workit.icns 생성 완료")
