#!/usr/bin/env python3
"""统计语速：python3 scripts/pace.py projects/<name>/script.final.md <成片秒数>"""
import re, sys
text = open(sys.argv[1], encoding="utf-8").read()
body = "\n".join(l for l in text.splitlines() if not l.startswith("#"))
chars = len(re.sub(r"\s+", "", body))
sec = float(sys.argv[2])
print(f"chars={chars} seconds={sec} pace={chars/sec:.2f} 字/秒")
for k in (1.05, 1.1, 1.15):
    print(f"  x{k}: {chars/(sec/k):.2f} 字/秒")
