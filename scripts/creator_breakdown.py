#!/usr/bin/env python3
"""拆解参考博主的视频：搜索作品 → 下载 → 切镜头 → 联系表 → 转写。

用法（在仓库根目录运行）：
    python3 scripts/creator_breakdown.py search  小Lin说 xiaolinshuo          # 按点赞排序搜 5 分钟以上作品
    python3 scripts/creator_breakdown.py download xiaolinshuo <aweme_id>:<短名> ...
    python3 scripts/creator_breakdown.py analyze  xiaolinshuo <短名> ...       # 切镜头、联系表、转写

产物在 research/creators/<目录>/：
    search-top-long.json   搜索到的作品与互动数据（入库）
    work/<短名>.shots.json 镜头起止时间（入库）
    work/<短名>.json       whisper.cpp 转写（入库）
    work/<短名>-sheet-*.jpg 每镜头一帧的联系表（入库，仅供学习）
    media/                 原视频与音频（不入库，*.mp4 / *.wav 已被忽略）

依赖：TikHub key（.env 的 TIKHUB_API_KEY）、ffmpeg、Pillow、whisper-cli 与
~/.cache/whisper-cpp/ggml-large-v3-turbo-q5_0.bin（Hugging Face ggerganov/whisper.cpp）。
下载的视频只用于本地拆解学习，不剪进成片。
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tikhub_douyin import API, CDN_HEADERS, load_key  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MODEL = Path.home() / ".cache/whisper-cpp/ggml-large-v3-turbo-q5_0.bin"
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"


def base(slug):
    d = ROOT / "research" / "creators" / slug
    (d / "work").mkdir(parents=True, exist_ok=True)
    (d / "media").mkdir(exist_ok=True)
    return d


def search(keyword):
    """视频搜索：最多点赞、5 分钟以上。返回 TikHub 原始 aweme 字典（含播放链接）。"""
    r = requests.post(API + "/api/v1/douyin/search/fetch_video_search_v1",
                      headers={"Authorization": f"Bearer {load_key()}"},
                      json={"keyword": keyword, "cursor": 0, "sort_type": "1",
                            "publish_time": "0", "filter_duration": "5-10000"}, timeout=120)
    r.raise_for_status()
    found = []

    def walk(o):
        if isinstance(o, dict):
            if "aweme_id" in o and isinstance(o.get("author"), dict):
                found.append(o)
                return
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(r.json())
    return found


def summarize(a):
    v, s = a.get("video") or {}, a.get("statistics") or {}
    return {"aweme_id": a["aweme_id"], "author": a["author"].get("nickname"),
            "desc": a.get("desc", "").split("#")[0].strip(), "create_time": a.get("create_time"),
            "duration_s": round((v.get("duration") or 0) / 1000), "w": v.get("width"), "h": v.get("height"),
            "digg": s.get("digg_count"), "collect": s.get("collect_count"),
            "comment": s.get("comment_count"), "share": s.get("share_count"),
            "url": f"https://www.douyin.com/video/{a['aweme_id']}"}


def cmd_search(args):
    items = [summarize(a) for a in search(args.keyword)]
    out = base(args.slug) / "search-top-long.json"
    out.write_text(json.dumps({"keyword": args.keyword, "items": items}, ensure_ascii=False, indent=2), encoding="utf-8")
    for m in items:
        print(m["aweme_id"], m["author"], m["digg"], m["collect"], f"{m['duration_s']}s", f"{m['w']}x{m['h']}", m["desc"][:30])


def cmd_download(args):
    d = base(args.slug)
    want = dict(x.split(":", 1) for x in args.items)
    saved = json.loads((d / "search-top-long.json").read_text())
    keyword = saved["keyword"] if isinstance(saved, dict) else saved[0]["author"]  # 旧格式是作品列表
    for a in search(keyword):
        if a["aweme_id"] not in want:
            continue
        out = d / "media" / f"{want[a['aweme_id']]}.mp4"
        for url in ((a.get("video") or {}).get("play_addr") or {}).get("url_list") or []:
            with requests.get(url, headers=CDN_HEADERS, stream=True, timeout=600) as r:
                if r.ok:
                    with open(out, "wb") as f:
                        for chunk in r.iter_content(1 << 20):
                            f.write(chunk)
            if out.exists() and out.stat().st_size > 1_000_000:
                print(out.name, out.stat().st_size)
                break


def shots(d, name, threshold=0.25):
    """ffmpeg 场景检测切镜头，丢掉短于 0.3 秒的碎片。"""
    src = d / "media" / f"{name}.mp4"
    log = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(src), "-an",
                          "-vf", f"select='gt(scene,{threshold})',showinfo", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    cuts = [float(p.split(":")[1].split()[0]) for p in log.split("pts_time")[1:]]
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                "-of", "csv=p=0", str(src)], capture_output=True, text=True).stdout)
    edges = [0.0] + cuts + [dur]
    return [{"i": i, "start": a, "end": b} for i, (a, b) in enumerate((a, b) for a, b in zip(edges, edges[1:]) if b - a > 0.3)]


def sheets(d, name, shot_list, cols=6, rows=5, width=320):
    """每个镜头取一帧，按 6×5 拼成带时间码的联系表。"""
    frames = d / "work" / f"{name}-frames"
    frames.mkdir(exist_ok=True)
    font = ImageFont.truetype(FONT, 22)
    paths = []
    for s in shot_list:
        p = frames / f"{s['i']:04d}.jpg"
        t = s["start"] + min(1.2, (s["end"] - s["start"]) * 0.6)
        if not p.exists():
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", str(d / "media" / f"{name}.mp4"),
                            "-frames:v", "1", "-q:v", "4", str(p)])
        paths.append((p, s))
    w, h = Image.open(paths[0][0]).size
    tw, th = width, int(h * width / w)
    per = cols * rows
    for n in range(0, len(paths), per):
        chunk = paths[n:n + per]
        sheet = Image.new("RGB", (cols * tw, ((len(chunk) + cols - 1) // cols) * (th + 26)), "white")
        draw = ImageDraw.Draw(sheet)
        for k, (p, s) in enumerate(chunk):
            x, y = (k % cols) * tw, (k // cols) * (th + 26)
            sheet.paste(Image.open(p).resize((tw, th)), (x, y + 26))
            a = s["start"]
            draw.text((x + 4, y + 2), f"#{s['i']} {int(a // 60)}:{a % 60:04.1f} ({s['end'] - a:.1f}s)", fill="black", font=font)
        sheet.save(d / "work" / f"{name}-sheet-{n // per:02d}.jpg", quality=82)


def transcribe(d, name):
    wav = d / "media" / f"{name}.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(d / "media" / f"{name}.mp4"), "-ar", "16000", "-ac", "1", str(wav)])
    subprocess.run(["whisper-cli", "-m", str(MODEL), "-l", "zh", "-f", str(wav), "-oj", "-of", str(d / "work" / name),
                    "-t", str(os.cpu_count() or 8), "--prompt", "以下是普通话的句子。"], capture_output=True)


def cmd_analyze(args):
    d = base(args.slug)
    for name in args.names:
        s = shots(d, name)
        (d / "work" / f"{name}.shots.json").write_text(json.dumps(s), encoding="utf-8")
        sheets(d, name, s)
        transcribe(d, name)
        print(name, len(s), "shots")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("search"); p.add_argument("keyword"); p.add_argument("slug"); p.set_defaults(fn=cmd_search)
    p = sub.add_parser("download"); p.add_argument("slug"); p.add_argument("items", nargs="+"); p.set_defaults(fn=cmd_download)
    p = sub.add_parser("analyze"); p.add_argument("slug"); p.add_argument("names", nargs="+"); p.set_defaults(fn=cmd_analyze)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
