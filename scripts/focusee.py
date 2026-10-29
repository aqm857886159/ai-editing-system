#!/usr/bin/env python3
"""FocuSee 原始工程 → 能在 ChatCut 里剪的素材。

FocuSee 把摄像头、屏幕、麦克风、系统声音分开存在 <工程>.focusee/recording/ 里，各轨开始时间
差几到几十毫秒，记在 metadata.json 的 processTimeStartMs。本脚本按它对齐，输出：

    aroll.mp4     摄像头画面 + 麦克风声音（没有摄像头时用屏幕画面）；在 ChatCut 里转写和剪的就是它
    screen.mp4    屏幕录制，和 aroll.mp4 同一个时间原点（有摄像头时才单独输出）
    mic.wav       16 kHz 单声道麦克风，给 whisper-cli 出逐词时间
    tracks.json   各轨来源、偏移、时长，以及对齐方式

因为 aroll 和 screen 时间原点相同，在 ChatCut 里剪完 A-roll 后，把屏幕放到上层轨道时，
用和 A-roll 条目相同的 sourceIn / startFrame / durationFrames 就能逐段对上（见 docs/workflow.md 第 1、4 步）。

用法（在仓库根目录运行）：
    python3 scripts/focusee.py list                         # 列出全部工程：录制时间、时长、有哪些轨
    python3 scripts/focusee.py prep "WPS Office 2026-10-09" --out projects/<片名>/media/focusee

prep 的工程参数可以是工程目录路径，也可以是名字里的一段（唯一匹配即可）。
系统声音默认不混进去；演示里软件提示音是内容时加 --with-system-audio。
输出是大文件，放在项目的 media/ 下（*.mp4 / *.wav 不入库）。依赖 ffmpeg / ffprobe。
"""
import argparse
import datetime
import json
import subprocess
import sys
from pathlib import Path

HOME = Path.home() / "Movies" / "FocuSee Project"
TRACKS = {"webcam": "camera", "display": "screen", "microphone": "mic", "systemAudio": "system"}


def read_project(proj):
    rec = proj / "recording"
    meta = json.loads((rec / "metadata.json").read_text())
    tracks = {}
    for r in meta.get("recorders", []):
        name = TRACKS.get(r.get("type"))
        for s in r.get("sessions") or []:
            f = rec / s.get("outputFilename", "")
            if name and f.is_file():
                tracks[name] = {"file": str(f), "start_ms": s["processTimeStartMs"], "duration_s": s["durationMs"] / 1000,
                                "size": s.get("videoSize") or s.get("bounds")}
    return tracks


def probe(f):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
                          "-of", "csv=p=0", f], capture_output=True, text=True).stdout.strip()
    if not out:
        return None
    w, h, r = out.split(",")
    num, den = r.split("/")
    return int(w), int(h), float(num) / float(den)


def find(arg):
    p = Path(arg).expanduser()
    if (p / "recording" / "metadata.json").exists():
        return p
    hits = [d for d in HOME.glob("*.focusee") if arg in d.name]
    if len(hits) != 1:
        sys.exit(f"“{arg}”匹配到 {len(hits)} 个工程，先用 list 看全名" + "".join(f"\n  {h.name}" for h in hits))
    return hits[0]


def cmd_list(a):
    rows = []
    for d in sorted(HOME.glob("*.focusee")):
        try:
            t = read_project(d)
        except (OSError, ValueError, KeyError):
            continue
        dur = max((x["duration_s"] for x in t.values()), default=0)
        cam = probe(t["camera"]["file"]) if "camera" in t else None
        rows.append((d.stat().st_birthtime if hasattr(d.stat(), "st_birthtime") else d.stat().st_mtime, d.name, dur, t, cam))
    for ts, name, dur, t, cam in sorted(rows, reverse=True):
        when = datetime.datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M")
        cam_s = f"摄像头 {cam[0]}x{cam[1]}" if cam else "无摄像头"
        print(f"{when}  {dur / 60:5.1f} 分钟  {cam_s:16s}  轨：{'、'.join(t)}\n    {name}")


def cmd_prep(a):
    proj = find(a.project)
    t = read_project(proj)
    if "mic" not in t:
        sys.exit("这个工程没有麦克风轨")
    picture = "camera" if "camera" in t else "screen"
    used = [picture, "mic"] + (["screen"] if picture == "camera" and "screen" in t else []) + \
        (["system"] if a.with_system_audio and "system" in t else [])
    origin = max(t[k]["start_ms"] for k in used)  # 所有轨都有画面 / 声音的最早时刻
    off = {k: (origin - t[k]["start_ms"]) / 1000 for k in used}
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    report = {"project": str(proj), "origin_process_time_ms": origin, "tracks": {}}

    def video_args(k):
        """偏移不到一帧时直接拷贝视频流（快、不损失）；超过一帧才重新编码裁准。"""
        fps = probe(t[k]["file"])[2]
        if off[k] < 1 / fps:
            return ["-i", t[k]["file"]], ["-c:v", "copy"], "copy"
        return ["-ss", f"{off[k]:.3f}", "-i", t[k]["file"]], ["-c:v", "libx264", "-crf", "16", "-preset", "fast"], "re-encoded"

    vin, vcodec, how = video_args(picture)
    ain = ["-ss", f"{off['mic']:.3f}", "-i", t["mic"]["file"]]
    if "system" in used:
        ain += ["-ss", f"{off['system']:.3f}", "-i", t["system"]["file"]]
        amap = ["-filter_complex", "[1:a][2:a]amix=inputs=2:duration=first:normalize=0[a]", "-map", "0:v", "-map", "[a]"]
    else:
        amap = ["-map", "0:v", "-map", "1:a"]
    subprocess.run(["ffmpeg", "-v", "error", "-y", *vin, *ain, *amap, *vcodec, "-c:a", "aac", "-b:a", "256k", "-shortest",
                    str(out / "aroll.mp4")], check=True)
    report["tracks"]["aroll.mp4"] = {"picture": t[picture]["file"], "audio": [t["mic"]["file"]] + ([t["system"]["file"]] if "system" in used else []),
                                     "offset_s": {k: round(off[k], 4) for k in used if k != "screen"}, "video": how}
    if "screen" in used:
        vin, vcodec, how = video_args("screen")
        subprocess.run(["ffmpeg", "-v", "error", "-y", *vin, "-an", *vcodec, str(out / "screen.mp4")], check=True)
        report["tracks"]["screen.mp4"] = {"picture": t["screen"]["file"], "offset_s": round(off["screen"], 4), "video": how,
                                          "size": "x".join(map(str, probe(t["screen"]["file"])[:2]))}
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{off['mic']:.3f}", "-i", t["mic"]["file"], "-ac", "1", "-ar", "16000",
                    str(out / "mic.wav")], check=True)
    (out / "tracks.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    for f in sorted(out.iterdir()):
        print(f, f"{f.stat().st_size / 1e6:.0f} MB")
    print("\n下一步：push_asset 导入 aroll.mp4（和 screen.mp4），转写并剪 aroll；屏幕段按 A-roll 条目的 sourceIn 镜像到上层轨道。")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(required=True)
    sub.add_parser("list", help="列出全部 FocuSee 工程").set_defaults(fn=cmd_list)
    p = sub.add_parser("prep", help="对齐各轨，输出 aroll.mp4 / screen.mp4 / mic.wav")
    p.add_argument("project")
    p.add_argument("--out", required=True)
    p.add_argument("--with-system-audio", action="store_true")
    p.set_defaults(fn=cmd_prep)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
