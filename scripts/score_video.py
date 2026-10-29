#!/usr/bin/env python3
"""给成片或样片打自动分：镜头节奏、静止段、声音，并和参考创作者的区间对比。

用法（在仓库根目录运行）：
    python3 scripts/score_video.py <video.mp4> [--out score.json] [--ref xiaolinshuo linchao bidao]

输出：
    镜头数、每分钟切换、镜头时长中位数 / P90、超过 8 秒的镜头占比、
    最长静止段（ffmpeg freezedetect：画面几乎不动的时长，慢推镜头不算静止）、
    第一次画面变化的时间；声音：整体响度（LUFS）、响度范围（LRA）、峰值（dBTP）、
    完全静音的占比（低于 -50 dB 超过 0.4 秒，有音乐垫底的片子接近 0）；
    以及参考创作者在同一指标上的范围。

这些数只用来发现问题（例如 40 秒没有任何变化），不是越快越好：需要读、需要算的画面
本来就该停得久。判断标准见 docs/video-scorecard.md。
依赖：ffmpeg / ffprobe。参考数据来自 research/creators/<slug>/work/*.shots.json 和
research/creators/sound-reference.json（用 --sound-ref 重新测：需要本地 research/creators/*/media/*.mp4）。
"""
import argparse
import json
import statistics as st
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXPLAINERS = ["xiaolinshuo", "linchao", "bidao"]  # 讲解类参考；纪实类节奏不可比


def duration(src):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(src)],
                                capture_output=True, text=True).stdout)


def cuts(src, threshold=0.25):
    log = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(src), "-an",
                          "-vf", f"select='gt(scene,{threshold})',showinfo", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    return [float(p.split(":")[1].split()[0]) for p in log.split("pts_time")[1:]]


def freezes(src, noise=0.003, min_d=3):
    """返回画面几乎不动的区间 [(start, end), ...]。"""
    log = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(src), "-an",
                          "-vf", f"freezedetect=n={noise}:d={min_d}", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    starts = [float(l.split("freeze_start:")[1]) for l in log.splitlines() if "freeze_start:" in l]
    ends = [float(l.split("freeze_end:")[1]) for l in log.splitlines() if "freeze_end:" in l]
    return list(zip(starts, ends + [None] * (len(starts) - len(ends))))


def sound(src):
    """整体响度、响度范围、峰值和静音占比。没有音轨返回空。"""
    log = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(src), "-vn",
                          "-af", "ebur128=peak=true,silencedetect=n=-50dB:d=0.4", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    if "Integrated loudness" not in log:
        return {}
    tail = log.split("Integrated loudness")[-1]
    num = lambda key: float(tail.split(key)[1].split()[0])
    silent = sum(float(l.split("silence_duration:")[1]) for l in log.splitlines() if "silence_duration:" in l)
    return {"loudness_lufs": num("I:"), "loudness_range_lu": num("LRA:"), "true_peak_dbtp": num("Peak:"),
            "silent_share": round(silent / duration(src), 3)}


def shot_stats(edges_or_shots, dur):
    if edges_or_shots and isinstance(edges_or_shots[0], dict):
        L = [s["end"] - s["start"] for s in edges_or_shots]
    else:
        e = [0.0] + list(edges_or_shots) + [dur]
        L = [b - a for a, b in zip(e, e[1:]) if b - a > 0.3]
    L = L or [dur]
    return {"shots": len(L), "cuts_per_min": round(len(L) / dur * 60, 1), "median_shot_s": round(st.median(L), 1),
            "p90_shot_s": round(sorted(L)[int(len(L) * .9)], 1), "share_over_8s": round(sum(x > 8 for x in L) / len(L), 2)}


def reference(slugs):
    rows = {}
    for slug in slugs:
        for f in sorted((ROOT / "research" / "creators" / slug / "work").glob("*.shots.json")):
            s = json.loads(f.read_text())
            if len(s) < 20:  # 竖屏口播叠图，镜头检测切不出来，不参与比较
                continue
            rows[f"{slug}/{f.name[:-11]}"] = shot_stats(s, s[-1]["end"])
    keys = ["cuts_per_min", "median_shot_s", "p90_shot_s", "share_over_8s"]
    return rows, {k: [min(r[k] for r in rows.values()), max(r[k] for r in rows.values())] for k in keys} if rows else {}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("--out")
    ap.add_argument("--ref", nargs="*", default=EXPLAINERS)
    ap.add_argument("--sound-ref", action="store_true", help="重新测参考创作者的声音，写入 sound-reference.json")
    a = ap.parse_args()
    if a.sound_ref:
        rows = {f"{m.parent.parent.name}/{m.stem}": sound(m) for m in sorted((ROOT / "research" / "creators").glob("*/media/*.mp4"))}
        (ROOT / "research" / "creators" / "sound-reference.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
        for k, v in rows.items():
            print(k, v)
        return
    if not Path(a.video).is_file():
        ap.error(f"找不到视频：{a.video}")
    dur = duration(a.video)
    c = cuts(a.video)
    fz = [(s, e if e is not None else dur) for s, e in freezes(a.video)]
    score = {"video": a.video, "duration_s": round(dur, 1), **shot_stats(c, dur),
             "first_change_s": round(c[0], 1) if c else None,
             "longest_static_s": round(max((e - s for s, e in fz), default=0), 1),
             "static_over_6s": [[round(s, 1), round(e, 1)] for s, e in fz if e - s > 6]}
    score.update(sound(a.video))
    rows, rng = reference(a.ref)
    ref_sound = ROOT / "research" / "creators" / "sound-reference.json"
    if ref_sound.exists():
        sr = [v for v in json.loads(ref_sound.read_text()).values() if v]
        rng.update({k: [min(v[k] for v in sr), max(v[k] for v in sr)] for k in sr[0] if all(v.get(k) is not None for v in sr)} if sr else {})
    score["reference_range"] = rng
    print(f"{Path(a.video).name}  {dur / 60:.1f} min")
    for k in ["shots", "cuts_per_min", "median_shot_s", "p90_shot_s", "share_over_8s", "first_change_s", "longest_static_s",
              "loudness_lufs", "loudness_range_lu", "true_peak_dbtp", "silent_share"]:
        if k not in score:
            continue
        r = rng.get(k)
        print(f"  {k:18s} {score[k]!s:>8}" + (f"   参考 {r[0]}–{r[1]}" if r else ""))
    if score["static_over_6s"]:
        print("  超过 6 秒没有变化：", ", ".join(f"{s}–{e}s" for s, e in score["static_over_6s"]))
    if a.out:
        Path(a.out).write_text(json.dumps({**score, "reference": rows}, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
