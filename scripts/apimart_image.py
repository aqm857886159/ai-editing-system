#!/usr/bin/env python3
"""apimart GPT-Image-2 出图（文生图 / 图生图）。
用法：
  python3 scripts/apimart_image.py --prompt-file p.txt --size 3:4 --out out.png [--ref a.jpg --ref b.jpg] [--resolution 2k]
key 从环境变量 APIMART_API_KEY 或仓库根目录 .env 读取（.env 不入库）。
文档：https://docs.apimart.ai/cn/api-reference/images/gpt-image-2/generation
流程：POST /v1/images/generations -> task_id -> 轮询 GET /v1/tasks/{id} -> data.result.images[0].url[0]
"""
import argparse, base64, json, mimetypes, os, sys, time, urllib.request, pathlib

def load_key():
    k = os.environ.get("APIMART_API_KEY")
    if k: return k
    env = pathlib.Path(__file__).resolve().parent.parent / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("APIMART_API_KEY="): return line.split("=",1)[1].strip()
    sys.exit("缺少 APIMART_API_KEY")

def call(method, url, key, body=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())

def data_uri(p):
    mt = mimetypes.guess_type(p)[0] or "image/jpeg"
    return f"data:{mt};base64," + base64.b64encode(open(p, "rb").read()).decode()

ap = argparse.ArgumentParser()
ap.add_argument("--prompt-file", required=True); ap.add_argument("--size", default="1:1")
ap.add_argument("--resolution", default="2k"); ap.add_argument("--out", required=True)
ap.add_argument("--ref", action="append", default=[]); ap.add_argument("--model", default="gpt-image-2")
a = ap.parse_args()
key = load_key()
body = {"model": a.model, "prompt": open(a.prompt_file, encoding="utf-8").read().strip(), "n": 1, "size": a.size, "resolution": a.resolution}
if a.ref: body["image_urls"] = [data_uri(p) for p in a.ref]
r = call("POST", "https://api.apimart.ai/v1/images/generations", key, body)
tid = r["data"][0]["task_id"]; print("task", tid, flush=True)
for i in range(120):
    time.sleep(5)
    t = call("GET", f"https://api.apimart.ai/v1/tasks/{tid}", key)["data"]
    st = t.get("status"); print(i, st, flush=True)
    if st == "completed":
        url = t["result"]["images"][0]["url"][0]; print(url)
        urllib.request.urlretrieve(url, a.out); print("saved", a.out); break
    if st == "failed": sys.exit("failed: " + json.dumps(t, ensure_ascii=False))
else: sys.exit("timeout")
