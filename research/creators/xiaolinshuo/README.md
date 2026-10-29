# 参考博主：小Lin说

- **账号**：抖音 小Lin说。2026-10-26 TikHub 用户搜索显示粉丝约 1342 万、作品 778 条。注意：该账号的作品列表接口返回为空，只能用视频搜索取作品
- **为什么选**：财经科普，横屏口播配大量讲解卡，抽象概念讲得清楚，收藏率高，和我们“口播 + 讲解画面”的形式最接近
- **结论**：见 [breakdown.md](breakdown.md)

## 选了哪几条

用 TikHub 视频搜索（关键词“小Lin说”，按点赞排序，时长 5 分钟以上）取前 7 条，记在 `search-top-long.json`。从中选 3 条：

| 短名 | 标题 | 理由 |
|---|---|---|
| `wealth-freedom` | 你需要多少钱，才能财富自由？ | 收藏/点赞最高（0.32），纯讲解型 |
| `mrbeast` | 全球第一网红，一边撒钱，一边赚钱 | 采访 + 纪录片形式，看开头钩子和快节奏剪辑 |
| `ai-power` | 电，怎么卡住了AI的脖子？ | 竖屏，主题接近 AI；品牌合作内容 |

## 怎么做的（可复用）

```bash
python3 scripts/creator_breakdown.py search 小Lin说 xiaolinshuo
python3 scripts/creator_breakdown.py download xiaolinshuo 7700132354437745954:wealth-freedom
python3 scripts/creator_breakdown.py analyze xiaolinshuo wealth-freedom
```

1. TikHub 搜索并下载原视频（`media/`，不入库）
2. ffmpeg 场景检测切镜头（阈值 0.25），每个镜头取一帧拼成带时间码的联系表
3. whisper.cpp（large-v3-turbo）转写，和镜头时间对齐
4. 逐张看联系表，挑关键帧放大，按“原句 / 画面形式 / 出现时机 / 停留时长 / 版面”记录

## 入库与边界

- 入库：搜索数据、镜头时间、转写、联系表和放大帧，只用于学习拆解（仓库为私有）
- 不入库：原视频、音频、逐帧截图
- 不把他们的画面剪进我们的成片，也不复刻他们的标志性外观（深紫卡片、人民币边框、卡通形象）。学的是“什么时候用什么”，具体样式按我们自己的风格做
