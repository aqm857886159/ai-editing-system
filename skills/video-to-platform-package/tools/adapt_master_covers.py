#!/usr/bin/env python3
"""Adapt the repository's existing cover master to a new video's copy.

The master is intentionally kept as the source of visual identity. This tool
only clears the old copy in the text-safe area and types two new focal points.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


FONT = "/System/Library/Fonts/STHeiti Medium.ttc"


def load_font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT, size=size, index=0)


def clear_text_area(im: Image.Image, label: str) -> None:
    w, h = im.size
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    if label == "3x4":
        # Existing master keeps the portrait below the upper text block.
        draw.rectangle((0, 0, w, int(h * 0.38)), fill=(0, 0, 0, 255))
    elif label == "4x3":
        draw.rectangle((0, 0, int(w * 0.57), h), fill=(0, 0, 0, 255))
    else:
        draw.rectangle((0, 0, int(w * 0.68), h), fill=(0, 0, 0, 255))
    # Fade the mask into the existing master instead of leaving a hard panel edge.
    if label == "3x4":
        fade = Image.new("L", (w, h), 0)
        fd = ImageDraw.Draw(fade)
        fd.rectangle((0, 0, w, int(h * 0.38)), fill=255)
        fade = fade.filter(ImageFilter.GaussianBlur(max(8, int(w * 0.02))))
        overlay.putalpha(fade)
    else:
        fade = Image.new("L", (w, h), 0)
        fd = ImageDraw.Draw(fade)
        fd.rectangle((0, 0, int(w * 0.66), h), fill=255)
        fade = fade.filter(ImageFilter.GaussianBlur(max(8, int(w * 0.025))))
        overlay.putalpha(fade)
    im.paste(overlay, (0, 0), overlay)
    # A very soft blue glow keeps the repository master language without adding a shape.
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow, "RGBA")
    if label == "3x4":
        gd.ellipse((int(w * 0.18), int(h * 0.31), int(w * 0.82), int(h * 0.72)), fill=(0, 92, 255, 42))
    else:
        gd.ellipse((int(w * 0.28), int(h * 0.24), int(w * 0.82), int(h * 0.88)), fill=(0, 92, 255, 38))
    glow = glow.filter(ImageFilter.GaussianBlur(max(20, int(w * 0.08))))
    im.paste(glow, (0, 0), glow)


def draw_copy(im: Image.Image, label: str, title1: str, title2: str, subtitle: str) -> None:
    w, h = im.size
    draw = ImageDraw.Draw(im, "RGBA")
    if label == "3x4":
        x, y = int(w * 0.07), int(h * 0.08)
        size = int(w * 0.115)
        subtitle_size = int(w * 0.038)
        gap = int(size * 1.05)
    elif label == "4x3":
        x, y = int(w * 0.065), int(h * 0.34)
        size = int(h * 0.145)
        subtitle_size = int(h * 0.045)
        gap = int(size * 1.05)
    else:
        x, y = int(w * 0.047), int(h * 0.29)
        size = int(h * 0.16)
        subtitle_size = int(h * 0.048)
        gap = int(size * 1.05)
    # Scale both focal lines to the safe text width so copy cannot run into the portrait.
    max_width = int(w * (0.86 if label == "3x4" else 0.50))
    while size > 40:
        probe = load_font(size)
        if max(probe.getbbox(title1)[2], probe.getbbox(title2)[2]) <= max_width:
            break
        size -= 2
    title_font = load_font(size)
    sub_font = load_font(subtitle_size)
    draw.text((x, y), title1, font=title_font, fill=(249, 249, 251, 255))
    draw.text((x, y + gap), title2, font=title_font, fill=(10, 132, 255, 255))
    draw.text((x, y + gap * 2 + int(size * 0.06)), subtitle, font=sub_font, fill=(204, 204, 210, 255))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--master-dir", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--title1", default="AI 越用越省心")
    parser.add_argument("--title2", default="沉淀成规则")
    parser.add_argument("--subtitle", default="自动化的底层机制")
    args = parser.parse_args()
    master = Path(args.master_dir)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for label in ("3x4", "4x3", "16x9"):
        src = master / f"cover_agent_system_{label}.png"
        im = Image.open(src).convert("RGB")
        clear_text_area(im, label)
        draw_copy(im, label, args.title1, args.title2, args.subtitle)
        target = out / f"cover-final-{label}.png"
        im.save(target, "PNG", optimize=True)
        print(f"{target} {im.size[0]}x{im.size[1]}")


if __name__ == "__main__":
    main()
