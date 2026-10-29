# 从剪辑版 script.md 生成只有口播文字的朗读版 script-read.md
#   python3 scripts/make_read.py projects/<片名>
# 去掉〔画面〕、待确认、表格、清单、说明，只留要说的话；改稿只改 script.md，再重跑。
import re
import sys
from pathlib import Path

proj = Path(sys.argv[1])
src = (proj / 'script.md').read_text(encoding='utf-8')

title = re.sub(r'（[^）]*）\s*$', '', src.split('\n', 1)[0].lstrip('# ').strip())

# 正文从第一个“开头”标题开始，到附录类标题为止
START = re.compile(r'^## .*开头', re.M)
STOP = ('## 提示词', '## 拆分表', '## 改动清单', '## 录之前', '## 结构参考', '## 附录')
m = START.search(src)
body = src[m.start():] if m else src
cut = min([i for i in (body.find('\n' + s) for s in STOP) if i >= 0], default=len(body))
body = body[:cut]

# 这些标记要留给录制的人看，其余【…】是写给剪辑或给我自己的说明
KEEP = ('【可剪】', '【长版专用】', '【补录', '【亲历位', '【反应位', '【可选】')
SKIP_START = ('〔', '---', '|', '- ', '* ', '>', '```')

out = [f'# {title} · 朗读版', '',
       '> 从 script.md 生成，别直接改这里。【可剪】前后停半秒；【可选】不合适就跳过；【亲历位】讲你自己的事；【反应位】留真实反应。', '']
for line in body.split('\n'):
    s = line.strip()
    if not s or s.startswith(SKIP_START) or re.match(r'^\d+\.\s', s):
        continue
    if s.startswith('【') and not s.startswith(KEEP):
        continue
    if s.startswith('## '):
        s = '## ' + re.sub(r'（约[^）]*）', '', s[3:]).strip()
    elif not s.startswith('### '):
        s = re.sub(r'【(?!可剪|长版专用|补录|亲历位|反应位|可选】)[^】]*】', '', s)  # 句中的说明
        s = re.sub(r'(?<=[。：，？！])\s+', '', s.replace('**', ''))  # 去掉粗体后留下的空格
    out.extend([s.replace('【长版专用】', '【可剪】'), ''])  # 原稿一段就是一段，不合并，读着不累

text = '\n'.join(out).rstrip() + '\n'
(proj / 'script-read.md').write_text(text, encoding='utf-8')
spoken = re.sub(r'\*\*[^*]+\*\*|【[^】]*】|[#>\s]', '', text.split('\n', 4)[-1])
print(f'{proj / "script-read.md"}：口播约 {len(spoken)} 字，按每秒 4.5–5 字约 {len(spoken)/5/60:.0f}–{len(spoken)/4.5/60:.0f} 分钟')
