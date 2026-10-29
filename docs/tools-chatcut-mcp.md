# 工具笔记：ChatCut Desktop MCP（`mcp__chatcut_desktop__*`）

本仓库的剪辑都在 ChatCut Desktop 里做：用户交原片让剪，就算要用 ChatCut（见 [workflow 第 0 节](workflow.md#0-开工前读什么用户没说时按什么做)）；只是问问题、改文档时不打开它。连接：每次先 `get_active_project`，确认项目；再 `read_project`。

## 常用工具与真实行为
| 工具 | 要点 |
|---|---|
| `push_asset` | 参数是 `filePath`（不是 path）。本地素材只在本机。 |
| `trigger_transcript` | 参数是 `asset`（id 前缀即可，不是 assetId）。 |
| `track_progress` | `target=transcription` + `assetIds`；`wait` 会立刻返回，要自己隔一阵再 `status`。 |
| `inspect_asset` | `sourceFrameCount`(≤25) 看全片；`transcriptRanges`(≤6 段，单位微秒) 取词与时间。 |
| `read_script` | 产出 `timeline.md` 与 `library/*.md`；`showSilence:true` 才带 `[silence=]`。 |
| `apply_script` | `preview:true` 先看窗口；行内不能改字，只能 `~~删~~`；**不要在行里夹 `[silence]`**（会报错）。每行前需要 `### <素材名>` 标题。 |
| `clean_script` | only 可区分 fillers／silence；先预览实际语音。`only=silence,longSilence=600` 是旧片示例，不应当作自动清口癖或裁所有停顿的默认。 |
| `manage_timelines update` | 画布是 **timeline** 属性，不是 project；ratio/fit 按当前工具与素材选择。不要无条件 cover 裁掉教程 UI。 |
| `edit_item` | `adds/updates/deletes`；`left/top/width/height` 是画布像素；`playbackRate`、`audioFadeIn/OutDurationFrames`、`propertyOverrides` 可用；id 可用前缀；有宽高比锁，改宽高要保持比例。 |
| `create_motion_graphic_from_code` | 自然盒 `width/height` 创建后**不可改**；不要用 emoji / Unicode 箭头当图标；字体用 `search_fonts` 校验（Noto Sans SC、Inter 可用）。 |
| `edit_asset` | 可改 `code`、`propertyDefaults`；删除被其他时间轴引用的资产需 `confirmImpact`。 |
| `edit_captions` | `template`(预设) / `style`(合并样式) / `set_card_text`。字幕底色：`normalBackground:{color,borderRadius,paddingX,paddingY}`。改字号/行数会让字幕重新分段，**文字修正放最后做**。 |
| `preview_timeline` | `views:["viewer"]` + `fromFrame/toFrame` → 9 张均分帧；**范围只含 1 帧 → 一张全分辨率大图**（看细节用）。传 `frames:[…]` 无效。 |
| `manage_timelines duplicate` | 做大改前先复制备份（`activate:false`）。 |
| `edit_track` | 轨道 `order` 0 在最底层，新建轨道默认落在最上面，要放到下层需改 order。人声闪避：人声轨 `audioDucking {role:"anchor"}`，音乐轨设为跟随并给 `duckDepthDb`。 |
| `edit_item` 裁切 | crop 裁的是条目自己的盒子：要做“侧边人物卡”，先 `keepAspectRatio:false`，保持完整画面比例的盒子，再用 `cropLeft/cropRight` 和 `borderRadius` 裁出卡片；只改宽高会把画面压扁。`deletes` 只传 `{id}`。 |
| MG 代码校验 | 属性要从名为 `props` 的变量读（`const props = item.props \|\| {}`），否则报“声明未使用”；`alert` 等浏览器全局名不能当变量名。插件环境里 `inspect_asset includeCodeFile` 不可用，要改 MG 就重新创建资产再替换条目。 |
| `edit_captions` 补充 | 字幕样式是全局的，位置只能逐卡 `set_card_layout`；关闭逐词高亮用 `highlightUnit:"off"`（不是 none）。 |
| `edit_item` 音量 | 音频 / 视频条目用 `volume`（0–1 线性）或 `decibelAdjustment`，二选一；`muted:true` 静音。音效库的声音用 `type:"audio"`、`assetId:"library:sound:<id>"`、`fromFrame` 对准事件帧（`browse_library category:sound-effects` 找 id）。2026-10-06 那片记录的“没有音量控制”已过时 |
| 声音工具 | `isolate_voice`（只用于有人声的片段，去底噪和回声）、`smooth_audio`（剪口短交叉淡化）、`submit_music`（生成器乐）、`submit_sound`（生成音效，先查音效库）。怎么用见 [声音](sound.md) |
| `search_stock_media` | 一次搜 Pexels、Pixabay、Unsplash、Freesound，`kind` 选 video / image / music / audio；下载结果的 `downloadUrl` 到项目目录后 `push_asset`。用前看每条的授权 |
| 导入讲解场景 | kit 渲染的 mp4 / 透明 mov 用 `push_asset` 导入，放在 A-roll 上方轨道；重新渲染到同一路径会自动刷新。ProRes 4444 透明 mov 在 ChatCut 里能正确叠加；2026-10-27 之前 kit 的叠加层其实是不透明的（`html` 背景没清掉，已修），旧渲染的“透明”文件要重渲。导入前用 PIL 看一个空白处像素的 alpha 是不是 0 |
| 音效库加不上 | 少数音效按 `fromFrame` 加会报“source range exceeds asset”（时长取整的问题）。改用 `startFrame`，`durationFrames` 取**整段时长减 1 帧**，起点提前到声音最响那一帧对准事件（嗖声一般在开头后 13–18 帧才最响）。不要截成 5 帧、10 帧：2026-10-27 查出 Anthropic S-1 那片的嗖声全被截在最响之前，剩下的能量只有原来的 0%–1%，等于没加 |
| 字幕卡拆分 | `edit_captions split_card` 的 `beforeTokenId` 要传源转写的 token id（`sourceTokenIds` 里的值），传字幕卡自己的 token id 会报边界无效 |
| 剪口单帧残字 | 片段结尾多出 1 帧下一个字，字幕会闪一帧残字：1 帧长的片段直接删，其余片段末尾减 1–2 帧，再 `edit_track tighten`。工程文件在 `~/Library/Application Support/ChatCut/projects/<id>/project.chatcutproject/`（timelines、captions、assets/transcription 都是 JSON），只读，可用来批量算这些位置和口播词在剪后时间线上的时间 |
| `local_export` | 返回路径只代表已排队，文件写完才出现在目标位置（渲染时在隐藏的临时目录里）。多次调用会排队，旧任务不会自动取消，要在导出记录里取消。`format:"jianying"` 可直接出可编辑的剪映草稿（美颜等后期交给剪映时用）。 |

## 布局与验证

画幅和分区按 [视觉编辑指南](visual-editing.md) 与实际素材判断；[L-005](lessons/L-005-safe-zones-9x16.md) 的竖屏样片不能套用到所有画布。上表是已观察的工具行为，调用前以当前 MCP schema 为准；返回成功后仍需看真实渲染与相关连续区间。
