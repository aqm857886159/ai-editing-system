#!/usr/bin/env python3
"""TikHub 抖音作品工具：拉作品元数据、批量转写音频、生成统计摘要。

用法（在仓库根目录运行）：
    python scripts/tikhub_douyin.py list <抖音号>          # 拉全部作品元数据
    python scripts/tikhub_douyin.py transcribe <抖音号>    # 逐条转写，可断点续跑
    python scripts/tikhub_douyin.py plays <抖音号>         # 补公开播放量（每 50 条一次请求）
    python scripts/tikhub_douyin.py stats <抖音号>         # 生成统计摘要
    python scripts/tikhub_douyin.py music-chart trending      # 音乐榜（hot / trending / original），带标签和副歌位置
    python scripts/tikhub_douyin.py music <music_id>          # 单首：标签、副歌、节拍、能量曲线，存到 research/music/<id>/

API key 读取顺序：环境变量 TIKHUB_API_KEY，其次仓库根目录 .env（已被 .gitignore 忽略）。
Whisper 模型从 Hugging Face 下载；国内网络可先设置 HF_ENDPOINT=https://hf-mirror.com。
输出在 data/douyin/<抖音号>/，只保留元数据（videos.json）、转写（transcripts.jsonl）和统计（stats.md）。
视频与音频都不落盘：转写时把视频下载到临时目录，抽成临时 wav 转写，用完立即删除。
播放链接会过期，所以 transcribe 每次运行都会重新拉一遍作品列表取新链接。
"""
import argparse
import datetime
import json
import os
import statistics
import subprocess
import sys
import tempfile
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
API = "https://api.tikhub.io"
CDN_HEADERS = {"User-Agent": "Mozilla/5.0", "Referer": "https://www.douyin.com/"}


def load_key():
    key = os.environ.get("TIKHUB_API_KEY")
    env_file = ROOT / ".env"
    if not key and env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("TIKHUB_API_KEY="):
                key = line.split("=", 1)[1].strip()
    if not key:
        sys.exit("缺少 TIKHUB_API_KEY：写进仓库根目录 .env 或设置环境变量")
    return key


def make_session():
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {load_key()}"
    return s


def get(session, path, retries=4, **params):
    """请求 TikHub；400/429/5xx 与网络错误会指数退避重试（实测分页偶发 400，重试即恢复）。"""
    for attempt in range(retries + 1):
        try:
            r = session.get(API + path, params=params, timeout=90)
            if r.status_code in (400, 429) or r.status_code >= 500:
                raise requests.HTTPError(f"HTTP {r.status_code}", response=r)
            r.raise_for_status()
            body = r.json()
            if body.get("code") != 200:
                raise RuntimeError(f"{path} 返回 code={body.get('code')}: {body.get('message')}")
            return body
        except (requests.RequestException, ValueError) as e:
            if attempt == retries:
                raise
            wait = 2 ** (attempt + 1)
            print(f"  请求失败（{e}），{wait}s 后重试", flush=True)
            time.sleep(wait)


def out_dir(unique_id):
    d = ROOT / "data" / "douyin" / unique_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def resolve_user(session, unique_id):
    body = get(session, "/api/v1/douyin/web/handler_user_profile_v2", unique_id=unique_id)
    u = body["data"]["user_info"]
    keys = ("nickname", "unique_id", "sec_uid", "signature", "aweme_count",
            "total_favorited", "mplatform_followers_count")
    return {k: u.get(k) for k in keys}


def list_posts(session, sec_uid, log=print):
    """分页拉全部作品，返回 TikHub 原始 aweme 字典（含播放链接，不落盘）。"""
    seen, items, cursor = set(), [], 0
    for _ in range(500):
        body = get(session, "/api/v1/douyin/app/v3/fetch_user_post_videos",
                   sec_user_id=sec_uid, max_cursor=cursor, count=20)
        data = body["data"]
        page = data.get("aweme_list") or []
        for a in page:
            if a["aweme_id"] not in seen:
                seen.add(a["aweme_id"])
                items.append(a)
        log(f"  已拉取 {len(items)} 条")
        if not data.get("has_more") or not page:
            break
        cursor = data["max_cursor"]
        time.sleep(0.2)
    return items


def summarize(a):
    v = a.get("video") or {}
    s = a.get("statistics") or {}
    ct = a.get("create_time") or 0
    return {
        "aweme_id": a["aweme_id"],
        "desc": a.get("desc", ""),
        "create_time": ct,
        "date": datetime.datetime.fromtimestamp(ct).strftime("%Y-%m-%d") if ct else "",
        "duration_s": round((v.get("duration") or 0) / 1000, 1),
        "has_video": bool((v.get("play_addr") or {}).get("url_list")),
        "digg": s.get("digg_count", 0),
        "comment": s.get("comment_count", 0),
        "share": s.get("share_count", 0),
        "collect": s.get("collect_count", 0),
        "is_top": bool(a.get("is_top")),
    }


def cmd_list(args):
    session = make_session()
    d = out_dir(args.unique_id)
    profile = resolve_user(session, args.unique_id)
    (d / "profile.json").write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"账号：{profile['nickname']}（{profile['unique_id']}），TikHub 报告作品数 {profile['aweme_count']}")
    items = list_posts(session, profile["sec_uid"])
    videos = sorted((summarize(a) for a in items), key=lambda x: x["create_time"], reverse=True)
    (d / "videos.json").write_text(json.dumps(videos, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已写入 {len(videos)} 条元数据 -> {d / 'videos.json'}")


def audio_url(a):
    urls = ((a.get("video") or {}).get("play_addr") or {}).get("url_list") or []
    return urls[0] if urls else None


def fetch_audio(url, video_tmp, wav_tmp):
    """把视频下载到临时文件（CDN 偶发断连，最多重试 3 次），再用 ffmpeg 只抽出 16k 单声道音频。"""
    last_err = None
    for attempt in range(3):
        try:
            with requests.get(url, stream=True, timeout=(15, 120), headers=CDN_HEADERS) as r:
                r.raise_for_status()
                with open(video_tmp, "wb") as f:
                    for chunk in r.iter_content(1 << 20):
                        f.write(chunk)
            break
        except requests.RequestException as e:
            last_err = e
            time.sleep(3 * (attempt + 1))
    else:
        raise last_err
    subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(video_tmp),
         "-vn", "-ac", "1", "-ar", "16000", str(wav_tmp)],
        check=True, timeout=900,
    )


def load_done(path):
    done = set()
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            rec = json.loads(line)
            if "error" not in rec:
                done.add(rec["aweme_id"])
    return done


def cmd_transcribe(args):
    from faster_whisper import BatchedInferencePipeline, WhisperModel

    session = make_session()
    d = out_dir(args.unique_id)
    out_path = d / "transcripts.jsonl"
    done = load_done(out_path)

    profile = resolve_user(session, args.unique_id)
    items = list_posts(session, profile["sec_uid"])
    todo = [a for a in items if audio_url(a) and a["aweme_id"] not in done]
    if args.limit:
        todo = todo[: args.limit]
    print(f"待转写 {len(todo)} 条（已完成 {len(done)} 条跳过）", flush=True)
    if not todo:
        return

    if args.device == "cuda":
        model = WhisperModel(args.model, device="cuda", compute_type="float16")
    else:
        model = WhisperModel(args.model, device="cpu", compute_type="int8", cpu_threads=16)
    pipe = BatchedInferencePipeline(model=model)

    def prepare(a, tmp):
        """下载并抽音频（在线程池里并行跑，CDN 单连接很慢）。"""
        video_tmp = Path(tmp) / f"{a['aweme_id']}.mp4"
        wav_tmp = Path(tmp) / f"{a['aweme_id']}.wav"
        t0 = time.time()
        try:
            fetch_audio(audio_url(a), video_tmp, wav_tmp)
        finally:
            video_tmp.unlink(missing_ok=True)
        return wav_tmp, time.time() - t0

    # 滑动窗口：同时最多 workers*2 条在途，避免音频临时文件堆满磁盘
    with out_path.open("a", encoding="utf-8") as f, tempfile.TemporaryDirectory() as tmp, \
            ThreadPoolExecutor(max_workers=args.workers) as ex:
        queue = iter(enumerate(todo, 1))
        pending = deque()

        def submit_next():
            nxt = next(queue, None)
            if nxt is not None:
                i, a = nxt
                pending.append((i, a, ex.submit(prepare, a, tmp)))

        for _ in range(args.workers * 2):
            submit_next()
        while pending:
            i, a, fut = pending.popleft()
            submit_next()
            wav_tmp = None
            try:
                wav_tmp, t_dl = fut.result()
                t0 = time.time()
                segs, _info = pipe.transcribe(str(wav_tmp), language="zh", vad_filter=True,
                                              batch_size=args.batch)
                segments = [{"s": round(x.start, 1), "e": round(x.end, 1), "t": x.text.strip()} for x in segs]
                rec = {"aweme_id": a["aweme_id"], "text": "".join(x["t"] for x in segments), "segments": segments}
                status = f"{len(rec['text'])} 字 | 下载 {t_dl:.0f}s，转写 {time.time() - t0:.0f}s"
            except Exception as e:  # 单条失败不中断整批，下次运行会自动重试
                rec = {"aweme_id": a["aweme_id"], "error": str(e)[:300]}
                status = f"失败：{rec['error'][:80]}"
            finally:
                if wav_tmp is not None:
                    Path(wav_tmp).unlink(missing_ok=True)
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            f.flush()
            print(f"[{i}/{len(todo)}] {a['aweme_id']} {status}", flush=True)


def cmd_plays(args):
    """作品列表接口不给播放量；公开统计接口给，按 50 条一批补进 videos.json。不需要登录。"""
    session = make_session()
    d = out_dir(args.unique_id)
    videos = json.loads((d / "videos.json").read_text(encoding="utf-8"))
    by_id = {v["aweme_id"]: v for v in videos}
    ids = list(by_id)
    for i in range(0, len(ids), 50):
        body = get(session, "/api/v1/douyin/app/v3/fetch_multi_video_statistics", aweme_ids=",".join(ids[i:i + 50]))
        for st in (body.get("data") or {}).get("statistics_list") or []:
            v = by_id.get(str(st.get("aweme_id")))
            if v is not None:
                v["play"] = st.get("play_count", 0)
        print(f"  已补 {min(i + 50, len(ids))} / {len(ids)}", flush=True)
    stamp = datetime.date.today().isoformat()
    for v in videos:
        v["play_checked"] = stamp
    (d / "videos.json").write_text(json.dumps(videos, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已写入播放量 -> {d / 'videos.json'}")


def cmd_stats(args):
    d = out_dir(args.unique_id)
    videos = json.loads((d / "videos.json").read_text(encoding="utf-8"))
    profile = json.loads((d / "profile.json").read_text(encoding="utf-8"))
    vids = [v for v in videos if v["has_video"]]
    total_h = sum(v["duration_s"] for v in vids) / 3600

    by_month = {}
    for v in vids:
        by_month.setdefault(v["date"][:7], []).append(v)

    def eng(v):
        return v["digg"] + v["comment"] + v["share"] + v["collect"]

    top = sorted(vids, key=eng, reverse=True)[:20]
    played = [v for v in vids if v.get("play")]
    rate = lambda v, k: v[k] / v["play"] * 100
    lines = [
        f"# {profile['nickname']}（{profile['unique_id']}）作品统计",
        "",
        f"- 作品总数（含图文）：{len(videos)}，视频：{len(vids)}，视频总时长：{total_h:.1f} 小时",
        f"- 单条视频时长中位数：{statistics.median(v['duration_s'] for v in vids):.0f} 秒",
        f"- 赞中位数：{statistics.median(v['digg'] for v in vids):.0f}，收藏中位数：{statistics.median(v['collect'] for v in vids):.0f}",
        (f"- 播放量（公开统计接口，{played[0]['play_checked']} 拉取，{len(played)} 条有数）：中位数 {statistics.median(v['play'] for v in played):.0f}；"
         f"每百次播放的赞 / 收藏 / 分享中位数 {statistics.median(rate(v, 'digg') for v in played):.2f} / "
         f"{statistics.median(rate(v, 'collect') for v in played):.2f} / {statistics.median(rate(v, 'share') for v in played):.2f}"
         if played else "- 还没有播放量：先运行 `plays`。完播率、留存曲线要登录创作者中心才看得到，不在这里。"),
        "",
        "## 按月发布数量与互动",
        "",
        "| 月份 | 条数 | 赞合计 | 收藏合计 | 评论合计 |",
        "|---|---|---|---|---|",
    ]
    for m in sorted(by_month):
        rows = by_month[m]
        lines.append(f"| {m} | {len(rows)} | {sum(r['digg'] for r in rows)} | "
                     f"{sum(r['collect'] for r in rows)} | {sum(r['comment'] for r in rows)} |")
    lines += ["", "## 互动总量 Top 20", "", "| 日期 | 赞 | 收藏 | 评论 | 分享 | 时长(秒) | 标题 |", "|---|---|---|---|---|---|---|"]
    for v in top:
        title = v["desc"].replace("|", "｜").replace("\n", " ")[:60]
        lines.append(f"| {v['date']} | {v['digg']} | {v['collect']} | {v['comment']} | {v['share']} | {v['duration_s']:.0f} | {title} |")
    if played:
        lines += ["", "## 播放量 Top 20", "", "| 日期 | 播放 | 赞/百播 | 收藏/百播 | 分享/百播 | 时长(秒) | 标题 |", "|---|---|---|---|---|---|---|"]
        for v in sorted(played, key=lambda v: v["play"], reverse=True)[:20]:
            title = v["desc"].replace("|", "｜").replace("\n", " ")[:60]
            lines.append(f"| {v['date']} | {v['play']} | {rate(v, 'digg'):.2f} | {rate(v, 'collect'):.2f} | {rate(v, 'share'):.2f} | {v['duration_s']:.0f} | {title} |")
        big = [v for v in played if v["play"] >= 5000]
        lines += ["", "## 播放 5000 以上、收藏率最高的 15 条（观众觉得“以后要用”）", "", "| 日期 | 播放 | 收藏/百播 | 赞/百播 | 时长(秒) | 标题 |", "|---|---|---|---|---|---|"]
        for v in sorted(big, key=lambda v: rate(v, "collect"), reverse=True)[:15]:
            title = v["desc"].replace("|", "｜").replace("\n", " ")[:60]
            lines.append(f"| {v['date']} | {v['play']} | {rate(v, 'collect'):.2f} | {rate(v, 'digg'):.2f} | {v['duration_s']:.0f} | {title} |")
    (d / "stats.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"已写入 {d / 'stats.md'}")


MUSIC_DIR = ROOT / "research" / "music"


def music_row(m):
    """把抖音 music_info 压成选曲要看的几项：平台自带的情绪/曲风标签、有没有人声、副歌位置、推荐起点、响度、节拍文件。"""
    try:
        extra = json.loads(m.get("extra") or "{}")
    except ValueError:
        extra = {}
    tags = extra.get("music_tagging") or {}
    beats = extra.get("beats") or {}
    return {
        "music_id": m.get("id_str") or str(m.get("id")),
        "title": m.get("title"),
        "author": m.get("author"),
        "duration_s": m.get("duration"),
        "is_original_sound": m.get("is_original_sound"),
        "moods": tags.get("Moods"),
        "genres": tags.get("Genres"),
        "themes": tags.get("Themes"),
        "vocal": tags.get("AEDs"),
        "languages": tags.get("Languages"),
        "chorus": (m.get("song") or {}).get("chorus"),   # 在整首歌里的位置（毫秒）；抖音上的音乐常是剪好的一段
        "preview_start_s": m.get("preview_start_time"),
        "loudness_lufs": extra.get("loudness"),
        "beats_url": beats.get("merged_beats"),            # {"time": [毫秒, ...]}
        "energy_url": beats.get("energy_trace"),            # {"energy": [...]}
    }


def cmd_music_chart(args):
    """音乐榜：hot 热门 / trending 飙升 / original 原创。每首带平台的情绪、曲风、人声标签和副歌位置。"""
    session = make_session()
    body = get(session, "/api/v1/douyin/app/v3/fetch_music_hot_search_list", chart_type=args.chart, cursor="0")
    rows = [dict(music_row(x["music_info"]), heat=x.get("heat")) for x in (body.get("data") or {}).get("music_list") or []]
    MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    path = MUSIC_DIR / f"chart-{args.chart}-{datetime.date.today().isoformat()}.json"
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    for r in rows:
        print(f"{r['music_id']} | {r['title'][:20]} | {r['duration_s']}s | {r['moods']} | {r['genres']} | {r['vocal']}")
    print(f"已写入 {path}")


def cmd_music(args):
    """单首：标签、副歌、推荐起点、响度，并把节拍和能量曲线存下来，估一个 BPM、找能量最高的位置。"""
    session = make_session()
    data = get(session, "/api/v1/douyin/app/v3/fetch_music_detail", music_id=args.music_id).get("data") or {}
    row = music_row(data.get("music_info") or data.get("music") or data)
    d = MUSIC_DIR / row["music_id"]
    d.mkdir(parents=True, exist_ok=True)
    for key, name in (("beats_url", "beats.json"), ("energy_url", "energy.json")):
        if row[key]:
            r = requests.get(row[key], headers=CDN_HEADERS, timeout=60)
            r.raise_for_status()
            (d / name).write_bytes(r.content)
    if (d / "beats.json").exists():
        b = json.loads((d / "beats.json").read_text())   # time 毫秒；value 是这一拍在小节里的位置 1–4
        t = b["time"]
        gaps = [y - x for x, y in zip(t, t[1:]) if y > x]
        row["beat_count"] = len(t)
        row["beats_cover_s"] = round(t[-1] / 1000, 1) if t else None   # 平台只分析了这一段，不一定是整首
        row["bpm_est"] = round(60000 / statistics.median(gaps)) if gaps else None
        row["downbeats_s"] = [round(x / 1000, 2) for x, v in zip(t, b.get("value") or []) if v == 1]   # 小节起点：进点、换段放这里
    if (d / "energy.json").exists():
        e = json.loads((d / "energy.json").read_text())
        en, et = e["energy"], e.get("time") or []
        if en and len(et) == len(en):
            k = max(1, len(en) // max(1, round(et[-1] / 1000)))   # 约 1 秒的滑动平均，原始曲线抖得很厉害
            smooth = [sum(en[i:i + k]) / k for i in range(len(en) - k + 1)]
            row["energy_peak_s"] = round(et[smooth.index(max(smooth)) + k // 2] / 1000, 1)
    (d / "info.json").write_text(json.dumps(row, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: v for k, v in row.items() if not k.endswith("_url")}, ensure_ascii=False, indent=1))
    print(f"已写入 {d}")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # Windows 控制台默认 gbk，中文日志会乱码
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("list", help="拉全部作品元数据")
    sp.add_argument("unique_id")
    sp.set_defaults(func=cmd_list)

    sp = sub.add_parser("transcribe", help="逐条转写（可断点续跑）")
    sp.add_argument("unique_id")
    sp.add_argument("--model", default="small", help="faster-whisper 模型名，默认 small")
    sp.add_argument("--device", default="cpu", choices=["cuda", "cpu"], help="默认 cpu；有 NVIDIA GPU 时用 cuda")
    sp.add_argument("--batch", type=int, default=16, help="GPU 批量推理的 batch 大小，显存不够时调小")
    sp.add_argument("--workers", type=int, default=6, help="并行下载线程数")
    sp.add_argument("--limit", type=int, default=0, help="只处理前 N 条（试跑用）")
    sp.set_defaults(func=cmd_transcribe)

    sp = sub.add_parser("plays", help="补公开播放量（不需要登录）")
    sp.add_argument("unique_id")
    sp.set_defaults(func=cmd_plays)

    sp = sub.add_parser("stats", help="根据 videos.json 生成统计摘要")
    sp.add_argument("unique_id")
    sp.set_defaults(func=cmd_stats)

    sp = sub.add_parser("music-chart", help="拉音乐榜，带平台的情绪、曲风、人声标签和副歌位置")
    sp.add_argument("chart", nargs="?", default="hot", choices=["hot", "trending", "original"])
    sp.set_defaults(func=cmd_music_chart)

    sp = sub.add_parser("music", help="单首音乐：标签、副歌、推荐起点、响度、节拍和能量曲线")
    sp.add_argument("music_id")
    sp.set_defaults(func=cmd_music)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
