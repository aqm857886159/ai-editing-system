#!/usr/bin/env python3
"""按关键词在各平台找真实视频和图片（TikHub），挑中的再下载到项目目录。

用法（在仓库根目录运行）：
    python3 scripts/find_media.py search douyin "青年失业率 统计局" --out projects/<片名>/research/media-search.json
    python3 scripts/find_media.py search bilibili "央视 新闻联播 就业" --sort new
    python3 scripts/find_media.py search xhs-image "深夜 写字楼 灯光"
    python3 scripts/find_media.py download <链接> --dir projects/<片名>/media/found

平台：douyin（抖音视频）、douyin-image（抖音图文）、bilibili、youtube、xhs（小红书笔记）、
xhs-image（小红书图片）、weibo（微博视频）。每次搜索约 0.001–0.01 美元，按次计费。
--out 会把结果追加进同一个 JSON（按平台和关键词分组），之后挑选、登记都从这里取链接。

download：抖音链接走 TikHub 拿无水印地址；B站 / YouTube / 微博用本机 yt-dlp；直接的图片链接直接下。
下载的文件放项目的 media/（*.mp4 不入库），下载完把来源写进 asset-register.csv。
这些是别人的作品：只用于核实、引用（短片段 + 标出处 + 用来评论或证明）或本地参考，
不当作通用 B-roll。什么时候用、怎么用，见 docs/content-packaging/providers.md。

API key：环境变量 TIKHUB_API_KEY，其次仓库根目录 .env。
"""
import argparse
import datetime
import json
import os
import re
import subprocess
import sys
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
        sys.exit("缺少 TIKHUB_API_KEY：写进仓库根目录 .env（见 .env.example）")
    return key


def call(method, path, params):
    kw = {"params": params} if method == "GET" else {"json": params}
    r = requests.request(method, API + path, headers={"Authorization": f"Bearer {load_key()}"}, timeout=120, **kw)
    r.raise_for_status()
    return r.json().get("data") or {}


def awemes(o, found=None):
    """抖音接口的嵌套层级经常变，按特征找作品字典。"""
    found = [] if found is None else found
    if isinstance(o, dict):
        if "aweme_id" in o and isinstance(o.get("author"), dict):
            found.append(o)
            return found
        for v in o.values():
            awemes(v, found)
    elif isinstance(o, list):
        for v in o:
            awemes(v, found)
    return found


def clean(s):
    return re.sub(r"<[^>]+>", "", s or "").replace("\n", " ").strip()


def date(ts):
    try:
        return datetime.date.fromtimestamp(int(ts)).isoformat()
    except (TypeError, ValueError):
        return str(ts or "")


def douyin(kw, sort, image=False):
    path = "/api/v1/douyin/search/fetch_image_search" if image else "/api/v1/douyin/search/fetch_video_search_v1"
    data = call("POST", path, {"keyword": kw, "cursor": 0, "sort_type": {"hot": "1", "new": "2"}.get(sort, "0")})
    out = []
    for a in awemes(data):
        v, s = a.get("video") or {}, a.get("statistics") or {}
        imgs = [((i.get("url_list") or [""])[0]) for i in a.get("images") or []]
        out.append({"id": a["aweme_id"], "title": clean(a.get("desc")).split("#")[0].strip(),
                    "author": a["author"].get("nickname"), "date": date(a.get("create_time")),
                    "duration_s": round((v.get("duration") or 0) / 1000), "size": f"{v.get('width')}x{v.get('height')}",
                    "likes": s.get("digg_count"), "url": f"https://www.douyin.com/video/{a['aweme_id']}",
                    "images": imgs or None})
    return out


def bilibili(kw, sort):
    data = call("GET", "/api/v1/bilibili/app/fetch_search_by_type",
                {"keyword": kw, "search_type": "video", "page_size": 20, "order": {"hot": "2", "new": "1"}.get(sort, "0")})
    out = []
    for it in (data.get("data") or data).get("items") or []:
        av = it.get("av") or {}
        if not av:
            continue
        out.append({"id": it.get("param"), "title": clean(av.get("title")), "author": av.get("author"),
                    "date": date(av.get("ptime")), "duration": av.get("duration"), "views": av.get("play"),
                    "cover": av.get("cover"), "url": f"https://www.bilibili.com/video/av{it.get('param')}"})
    return out


def youtube(kw, sort):
    data = call("GET", "/api/v1/youtube/web/search_video",
                {"search_query": kw, "order_by": "this_month" if sort == "new" else "this_year"})
    return [{"id": v["video_id"], "title": v.get("title"), "author": v.get("author"), "date": v.get("published_time"),
             "duration": v.get("video_length"), "views": v.get("number_of_views"),
             "url": f"https://www.youtube.com/watch?v={v['video_id']}"} for v in data.get("videos") or []]


def xhs(kw, sort):
    data = call("GET", "/api/v1/xiaohongshu/app_v2/search_notes",
                {"keyword": kw, "sort_type": {"hot": "popularity_descending", "new": "time_descending"}.get(sort, "general")})
    out = []
    for it in (data.get("data") or {}).get("items") or []:
        n = it.get("note") or {}
        if not n.get("id"):
            continue
        out.append({"id": n["id"], "title": clean(n.get("title") or n.get("desc"))[:60], "type": n.get("type"),
                    "author": (n.get("user") or {}).get("nickname"), "likes": n.get("liked_count"),
                    "collects": n.get("collected_count"), "date": date(n.get("timestamp")),
                    "images": [i.get("url") for i in n.get("images_list") or [] if i.get("url")] or None,
                    "url": f"https://www.xiaohongshu.com/explore/{n['id']}"})
    return out


def xhs_image(kw, sort):
    data = call("GET", "/api/v1/xiaohongshu/app_v2/search_images", {"keyword": kw})
    out = []
    for it in (data.get("data") or {}).get("items") or []:
        im, sh, no = it.get("image_info") or {}, it.get("share_info") or {}, it.get("note_info") or {}
        out.append({"id": no.get("note_id"), "title": clean(sh.get("title") or no.get("desc"))[:60],
                    "author": (it.get("user_info") or {}).get("nickname"), "size": f"{im.get('width')}x{im.get('height')}",
                    "likes": no.get("liked_count"), "images": [im.get("original") or im.get("url")], "url": sh.get("link")})
    return out


def weibo(kw, sort):
    data = call("GET", "/api/v1/weibo/web_v2/fetch_video_search", {"query": kw, "mode": "all" if sort == "new" else "hot"})
    out = []
    for p in (data.get("parsed_data") or {}).get("results") or []:
        url = p.get("post_url") or ""
        out.append({"id": p.get("weibo_id"), "title": clean(p.get("content"))[:60], "author": p.get("user_nick"),
                    "date": p.get("publish_time"), "likes": (p.get("interaction") or {}).get("like_count"),
                    "url": ("https:" + url if url.startswith("//") else url).split("?")[0]})
    return out


PLATFORMS = {"douyin": douyin, "douyin-image": lambda k, s: douyin(k, s, image=True), "bilibili": bilibili,
             "youtube": youtube, "xhs": xhs, "xhs-image": xhs_image, "weibo": weibo}


def cmd_search(a):
    items = PLATFORMS[a.platform](a.keyword, a.sort)[: a.limit]
    for i, m in enumerate(items):
        label = {"duration_s": "{}秒", "views": "播放{}", "likes": "赞{}", "collects": "收藏{}"}
        meta = " ".join(label.get(k, "{}").format(m[k]) for k in ("author", "date", "duration", "duration_s", "views", "likes", "collects", "size") if m.get(k))
        extra = f"  [{len(m['images'])} 图]" if m.get("images") else ""
        print(f"{i:2d}  {m['title'][:40]}  |  {meta}{extra}\n    {m['url']}")
    if a.out:
        out = Path(a.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        saved = json.loads(out.read_text(encoding="utf-8")) if out.exists() else []
        saved.append({"platform": a.platform, "keyword": a.keyword, "sort": a.sort,
                      "searched_at": datetime.datetime.now().isoformat(timespec="seconds"), "items": items})
        out.write_text(json.dumps(saved, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n已追加到 {out}")


def save_stream(url, path, headers=None):
    with requests.get(url, headers=headers or {"User-Agent": "Mozilla/5.0"}, stream=True, timeout=600) as r:
        r.raise_for_status()
        with open(path, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
    return path


def cmd_download(a):
    d = Path(a.dir)
    d.mkdir(parents=True, exist_ok=True)
    url = a.url
    m = re.search(r"douyin\.com/(?:video|note)/(\d+)", url)
    if m or "v.douyin.com" in url:
        data = call("GET", "/api/v1/douyin/web/fetch_one_video", {"aweme_id": m.group(1)}) if m else \
            call("GET", "/api/v1/douyin/web/fetch_one_video_by_share_url", {"share_url": url})
        a0 = awemes(data)[0]
        name = a.name or a0["aweme_id"]
        imgs = [(i.get("url_list") or [""])[0] for i in a0.get("images") or []]
        if imgs:
            paths = [save_stream(u, d / f"{name}-{k:02d}.jpg", CDN_HEADERS) for k, u in enumerate(imgs)]
        else:
            urls = ((a0.get("video") or {}).get("play_addr") or {}).get("url_list") or []
            paths = [save_stream(urls[0], d / f"{name}.mp4", CDN_HEADERS)]
    elif re.search(r"\.(jpe?g|png|webp)(\?|$)", url) or "xhscdn.com" in url or "douyinpic.com" in url:
        path = save_stream(url, d / f"{a.name or 'image'}.img")
        head = path.read_bytes()[:12]
        ext = "webp" if head[8:12] == b"WEBP" else "png" if head.startswith(b"\x89PNG") else "jpg"
        paths = [path.rename(path.with_suffix("." + ext))]
    else:
        tmpl = str(d / f"{a.name or '%(id)s'}.%(ext)s")
        subprocess.run(["yt-dlp", "-f", "bv*[height<=1080]+ba/b", "--merge-output-format", "mp4", "-o", tmpl, url], check=True)
        paths = sorted(d.glob(f"{a.name or '*'}.*"))
    for p in paths:
        print(p, f"{p.stat().st_size / 1e6:.1f} MB")
    print(f"\n来源：{url}\n记得登记到 asset-register.csv（source_url、captured_at、rights、用途），并在画面里标出处。")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(required=True)
    p = sub.add_parser("search", help="按关键词搜某个平台")
    p.add_argument("platform", choices=PLATFORMS)
    p.add_argument("keyword")
    p.add_argument("--sort", choices=["relevant", "hot", "new"], default="relevant")
    p.add_argument("--limit", type=int, default=15)
    p.add_argument("--out", help="追加保存到这个 JSON")
    p.set_defaults(fn=cmd_search)
    p = sub.add_parser("download", help="下载一个挑中的作品或图片")
    p.add_argument("url")
    p.add_argument("--dir", required=True, help="保存目录，一般是 projects/<片名>/media/found")
    p.add_argument("--name", help="文件名（不含扩展名）")
    p.set_defaults(fn=cmd_download)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
