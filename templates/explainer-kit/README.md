# explainer-kit：讲解画面组件库

每条片的讲解画面都从这里取。同一套设计系统、同一套组件，质感才稳定。
- 组件从 5 位创作者的拆解里归纳出来，见 [讲解组件总表](../../research/creators/component-catalog.md)；外观是本仓库自己的风格。
- 怎么检查、什么时候放行，见 [视频评分卡](../../docs/video-scorecard.md)。

## 文件

| 文件 | 作用 |
|---|---|
| `kit.js` | 设计系统（`TOKENS`、`KIT_CSS`）、机位与背景（`frame`、`frameRender`）、全部组件（`KIT.*`）、启动（`bootKit`） |
| `gallery.html` | 每个组件的样例：`gallery.html#组件名`，加 `&guides` 显示字幕带和人物小窗，叠加层组件会垫一张底图 |
| `render.js` | 出静帧或视频。叠加层组件自动输出透明 ProRes 4444 `.mov` |
| `lint.js` | 讲解画面体检：字幕带、小窗、字号、覆盖率、有没有真实画面 |
| `assets/samples/` | 样例用的图标和画面，只为演示 |

依赖 `playwright-core` 与本机缓存的 chrome-headless-shell（`npm install` 后，或设 `CHROME_EXE`）。

```bash
node render.js 'gallery.html#formula&guides' stills out/ 3.6 12.2   # 看关键时刻的静帧
node render.js 'gallery.html#formula' video out/formula.mp4          # 整段渲染（时长取组件的 dur）
node render.js 'gallery.html#callout' video out/callout.mov          # 叠加层 → 透明 .mov
node lint.js 'gallery.html#formula'                                  # 体检
```

## 设计系统（`TOKENS`）

- **颜色**：
  - `accent` 蓝 `#0A84FF` 表示结构和“正在讲”；
  - `signal` 金 `#FFC24A` 表示此刻最该记住的一个东西，**一屏最多一处**；
  - `bad` 红、`good` 绿只用于对错。
- **字号**：display 200 / hero 136 / h1 96 / h2 76 / h3 52 / body 40 / label 30 / micro 18。
  - 讲解卡最大与最小字差 4 倍以上。
  - micro 只给装饰性小英文（`.en`），不承担信息。
- **机位**：
  - 全景带倾斜（`WIDE`：缩放 .95，rx 9°，ry −14°）；
  - 推近时保留一点倾斜；
  - 亮起的元素浮起 46 px；
  - 推近要柔和（1.08–1.16 倍，并向画面中心收），不能把标题、总结句推出画面或推进字幕带。
- **安全区（1920×1080）**：
  - 字幕带 y ≥ 880，不放讲解文字；
  - 人物小窗默认右下（x 1630, y 790, 直径 250），用于讲解画面几乎占满全屏的时候；讲解较长、表情仍有用时改用侧边人物卡（[视觉编辑指南 · 人物画面](../../docs/visual-editing.md#人物画面怎么处理)），这时讲解内容只用另一侧，体检加 `--no-pip`；
  - 讲解面板 100, 60, 1720×800。
- **背景**：光晕 + 网格 + 斜置碎片 + 逐帧颗粒，和镜头一起视差移动。

改设计系统就改 `TOKENS`，所有组件一起变。不要在单片里另写一套颜色和字号。

## 组件

时间参数都是秒，取自剪后转写里对应词的时间。整屏组件自带背景；**叠加层**组件透明，叠在口播或录屏上。

| 组件 | 用在 | 主要参数 |
|---|---|---|
| `interlude` | 进入新段落，情境画面 + 大标题 | `frames` 或 `image`、`kicker`、`title`、`sub` |
| `definition` | 第一次给概念下本片的定义 | `term`、`en`、`text`（`[关键词]` 会加下划线）、`marks` |
| `question` | 请观众停下来代入自己 | `question`、`blank`、`hint` |
| `bigNumber` | 一个数据第一次出现 | `image`、`label`、`value`、`unit`、`note`（口径和来源） |
| `compare` | 两三个数值比大小 | `items[{label,value,note,t,image}]`（image 放数字出处的截图）、`focus[[t,i]]`、`pushFocus`、`verdict` |
| `scaleCompare` | 两个量级差很多 | `a`、`b`（`{label,value,display}`）、`ratio`、`source` |
| `categoryNav` | 几个并列部分，当前项亮；每项给 `image` 时变成一排画面卡，讲之前先把几种情况一起亮出来 | `items[{label,en,icon,kicker,image,pos}]`、`active[[t,i]]` |
| `layerStack` | N 层 / N 项逐项推进，回全景对比 | `items[{label,en,icon,sub}]`、`active`、`overview`、`compare{cols,marks,t}`、`bottomUp` |
| `chain` | 有先后顺序的流程 | `steps[{label,en,t,sub}]` |
| `formula` | 贯穿全片、逐项长大的主线 | `eq`、`slots`、`changes`（每格 `[t,'on'|'off'|'wait'|'sig',说明]`）、`header` |
| `docZoom` | 真实截图（财报、条款、网页）：整页一眼 → 推到那一行 → 画住 + 压暗其余 → 中文翻译标签；一行一步 | `image`、`iw`、`ih`、`steps[{t,box,cell,col,label,en,value,unit,sub,note,tone,hold,win,tagX,tagY}]`、`source`、`startStep`、`win`（图表、目录这种要整张露出的，给那一步 `win:[x,y,w,h]`；高的框用 `tagX/tagY` 把标签放到空处） |
| `evidence` | 没有截图、只有文字时的原文示意（有截图一律用 `docZoom`） | `cover`、`lines`、`hl{line,from,to,t}`、`source` |
| `splitBar` | 一个总数拆成几块，哪块大一眼看出；可作一章的主线，每讲完一块回到它、点亮那块、标题下写一句刚讲完的结论 | `total`、`parts[{label,value,display,sub,tone,t}]`、`focus`、`notes[[t,text]]`、`thumb`、`source` |
| `sideNav` | 叠加层：几个并列项竖排在人物一侧，讲到哪项亮哪项、展开一句解释，可整组划掉；也可做结尾的评论引导（`head` 放问题，讲到哪个角度亮哪个，`off` 不划任何项、只用来在底部加一行免责） | `title`、`head`、`items[{label,en,sub,note,noteT}]`、`active[[t,i,'sig']]`、`off[[t,[i]]]`、`show[[a,b]]` |
| `nextUp` | 系列片尾预告：下一集的问题，配一张真实截图裁到证据那一格并画住，底部合集名和集数 | `kicker`、`title`、`image`、`iw`、`ih`、`crop`、`ring`、`ringT`、`tag{value,unit,label,note}`、`source`、`series`、`eps`、`next` |
| `chart` | 趋势 | `values`、`xLabels`、`annotate{text,t}`、`source` |
| `tableHighlight` | 一张表只看一行 / 一格 | `cols`、`rows`、`hl{row,col,t}`、`source` |
| `abCompare` | 两种方案、前后效果并排 | `a`、`b`（`{label,image,note}`）、`winner`、`verdict` |
| `verdict` | 叠加层：人物下方一句判断 | `tag`、`parts[{text,key}]`、`en` |
| `callout` | 叠加层：指出画面里某处叫什么 | `items[{x,y,label,en,side,t}]` |
| `citationOverlay` | 叠加层：不切走画面，补来源和数据 | `title`、`lines` |
| `lowerThird` | 叠加层：第三方第一次出现 | `role`、`name`、`sub`、`x`、`y` |
| `wordWall` | 一连串名词砸出来再上墙，最后收成一个标题 | `terms[{text,t}]`、`spreadT`、`kicker`、`title`、`titleT`、`cols` |
| `sourceFrame` | 外来的视频或照片（新闻、发布会、采访、纪录片）：缩进窗口、四周压暗、左上角挂出处，和自己的录屏分开。视频出透明层，在 ChatCut 里把片段缩放到 `win`（默认 `[256,58,1408,792]`）放在它下面；照片给 `image` 出整屏 mp4 | `source`、`sub`、`image`、`backdrop`（片段截图做模糊底）、`win`、`fit`、`pos`、`push` |
| `replayTag` | 叠加层：关键的那一下先原速放完，重放时挂“回放 · 0.5×”、顶部进度线和四角取景框；`pip` 留一个白边小窗放自己的反应 | `label`、`speed`、`en`、`pip`（`true` 或 `{x,y,w,h}`）、`pipLabel` |
| `sectionTag` | 叠加层：整段挂着的小标签，告诉观众这是第几种情况、第几把剑 | `kicker`、`text`、`step:[当前,总数]`、`x`、`y`、`center` |
| `backText` | 叠加层：本章关键词第一次出现时，大字放在人物身后，一章最多一次。ChatCut 里三层：A-roll → 本层 → 同一段 A-roll 加“AI Portrait Cutout” | `words`（一到两个）、`key`、`gap`、`cx`、`y`、`size` |
| `roleCard` | 讲“这一方是谁、想要什么”，几方之间谁给谁什么：每方一张卡配一两句诉求气泡，相邻两方之间一条关系箭头 | `roles[{label,en,photo,pos,image,says[{text,t}]}]`（`photo` 真人或现场照片，`image` 放 logo）、`links[{from,to,label,t}]`、`active`、`kicker`、`title` |

### 选组件的顺序

1. 先找全片主线：有没有一个对象能贯穿全片、随讲解长大（`formula`、`layerStack`、`categoryNav`）。有的话，每段讲完都回到它。
2. 再按每句话缺什么选，见 [视觉编辑指南](../../docs/visual-editing.md)。原画面已经讲清楚的地方不加。
3. 画面是录屏或实拍时，优先用叠加层（`callout`、`citationOverlay`、`verdict`），不切走画面。

## 在一条片里用

在项目的 `scenes/` 下新建页面，引用 kit，写本片的内容：

```html
<script src="../../../templates/explainer-kit/kit.js"></script>
<script>
bootKit(KIT.layerStack({ title: '…', items: [...], active: [[2.1, 0], [5.4, 1]] }));
</script>
```

- 渲染：整屏场景出 mp4，叠加层出透明 `.mov`；在 ChatCut 里 `push_asset` 导入，放在 A-roll 上方的轨道，起点对齐剪后时间。改了 A-roll 就重排受影响的场景再渲染到同一路径。
- 本片需要新组件时，先加进 `kit.js` 和 `gallery.html`，过一遍 `lint.js`，再在片里用，下一片就能直接复用。
- 不在片里复制一份 kit 去改。
