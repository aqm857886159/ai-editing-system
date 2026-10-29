#!/usr/bin/env python3
"""对标板：把我们的画面和参考创作者的画面拼在一张图上，按同一把尺子看。

用法（在仓库根目录运行）：
    python3 scripts/reference_board.py --ours 样片.mp4 --out board.jpg
    python3 scripts/reference_board.py --ours a.jpg b.jpg c.jpg --ref xiaolinshuo linchao --n 6 --out board.jpg

--ours 可以是一个视频（均匀取 n 帧，跳过首尾 5%），也可以是若干张截图。
参考帧从 research/creators/<slug>/work/<视频>-frames/ 里固定随机取（同样的参数每次结果一样），
所以先要用 scripts/creator_breakdown.py analyze 生成过这些帧。参考帧只在本地看，不入库、不进成片。
打分方法见 docs/video-scorecard.md 第 3 节。
"""
import argparse
import random
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = "/System/Library/Fonts/Hiragino Sans GB.ttc"
TW, TH, LABEL = 480, 270, 34


def our_frames(paths, n, tmp):
    if len(paths) == 1 and Path(paths[0]).suffix.lower() in {".mp4", ".mov", ".m4v", ".mkv"}:
        src = paths[0]
        dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src],
                                   capture_output=True, text=True).stdout)
        out = []
        for k in range(n):
            t = dur * (.05 + .9 * k / max(1, n - 1))
            p = Path(tmp) / f"ours-{k:02d}.jpg"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", src, "-frames:v", "1", "-q:v", "3", str(p)])
            out.append((p, f"{int(t // 60)}:{t % 60:04.1f}"))
        return out
    return [(Path(p), Path(p).stem[-14:]) for p in paths[:n]]


def ref_frames(slug, n, seed):
    pool = sorted((ROOT / "research" / "creators" / slug / "work").glob("*-frames/*.jpg"))
    if not pool:
        raise SystemExit(f"{slug} 没有逐帧截图，先运行 creator_breakdown.py analyze")
    rnd = random.Random(f"{slug}-{seed}")
    return [(p, f"{p.parent.name[:-7]} #{int(p.stem)}") for p in sorted(rnd.sample(pool, min(n, len(pool))))]


def tile(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    if h > w:  # 竖屏放在中间，两边留黑，不拉伸
        im = im.resize((int(w * TH / h), TH))
        bg = Image.new("RGB", (TW, TH), "black")
        bg.paste(im, ((TW - im.width) // 2, 0))
        return bg
    return im.resize((TW, TH))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ours", nargs="+", required=True)
    ap.add_argument("--ref", nargs="+", default=["xiaolinshuo", "linchao", "bidao"])
    ap.add_argument("--n", type=int, default=6)
    ap.add_argument("--seed", default="1")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    font, small = ImageFont.truetype(FONT, 26), ImageFont.truetype(FONT, 18)
    with tempfile.TemporaryDirectory() as tmp:
        rows = [("我们", our_frames(a.ours, a.n, tmp))] + [(s, ref_frames(s, a.n, a.seed)) for s in a.ref]
        side = 160
        board = Image.new("RGB", (side + TW * a.n, len(rows) * (TH + LABEL)), (245, 245, 245))
        d = ImageDraw.Draw(board)
        for r, (name, frames) in enumerate(rows):
            y = r * (TH + LABEL)
            d.text((14, y + TH // 2), name, font=font, fill=(200, 30, 30) if r == 0 else "black")
            for k, (p, cap) in enumerate(frames):
                board.paste(tile(p), (side + k * TW, y + LABEL))
                d.text((side + k * TW + 6, y + 8), cap, font=small, fill="black")
        board.save(a.out, quality=85)
    print(a.out)


if __name__ == "__main__":
    main()
