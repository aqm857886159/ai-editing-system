# 抖音作品转写与分析（<抖音号>）

> 交接文档：给下一个接手的人（或 Codex）看。目标：转写该账号全部作品，并分析内容方向、受众偏好与可优化点，服务之后的选题。

## 现状

| 文件 | 内容 |
|---|---|
| `data/douyin/<抖音号>/profile.json` | 账号基本信息 |
| `data/douyin/<抖音号>/videos.json` | 817 条作品元数据（日期、时长、赞/评/转/藏、标题）。不含视频文件和播放链接 |
| `data/douyin/<抖音号>/transcripts.jsonl` | 逐条转写，每行 `{aweme_id, text, segments:[{s,e,t}]}`。失败的记录带 `error` 字段，重跑会自动补上 |
| `data/douyin/<抖音号>/stats.md` | 脚本生成的统计摘要（按月发布量、互动 Top 20） |

转写是 ASR 原文，可能把 500 听成 50；先听原音修识别，再用原始来源核验数字与事实。音频只能证明说过什么，不能单独证明其为真（见 [事实核验规则](../lessons/L-008-verify-numbers.md)）。

## 继续转写

脚本会跳过已成功的条目，只处理剩下的，可以放心重复运行：

```bash
python scripts/tikhub_douyin.py transcribe <抖音号> --model small --workers 6
```

前置条件：
- 仓库根目录 `.env` 里有 `TIKHUB_API_KEY`（`.env` 不入库，见 `.env.example`）
- 已安装 `pip install faster-whisper`；有 NVIDIA GPU 时再装 `nvidia-cublas-cu12 nvidia-cudnn-cu12` 并加 `--device cuda`，Mac 上用默认的 cpu
- 系统 PATH 里有 `ffmpeg`
- 国内网络下载模型慢时，先设置 `HF_ENDPOINT=https://hf-mirror.com`

视频和音频都不落盘：每条视频先下载到临时目录，抽成临时 wav，转写后立即删除。

## 统计脚本

```bash
python scripts/tikhub_douyin.py stats <抖音号>
```

注意：接口没有返回播放量（`play_count` 恒为 0），所以只有赞、藏、评、转的绝对值，没有完播率和点击率。比较时要考虑老作品积累的互动更多。

## 分析任务（待做）

产出 `docs/douyin/analysis-<抖音号>.md`，结构如下：

1. **内容主题聚类**：按标题和转写归类，每类的数量、时间分布、互动中位数。
2. **高低表现对比**：互动最高和最低的作品在时长、开头方式、主题、口播形式上有什么差异。
3. **开头钩子**：每条作品前 15 秒的转写（取 `segments` 前几段），归纳常见开头模式，并标出表现最好的几个开头。
4. **作者偏好方向**：从高互动作品归纳作者最擅长、受众最买账的内容方向。
5. **可优化点**：发布频率变化、时长分布、标题和开头、表现下滑的时段。
6. **选题建议**：若干条，每条附依据的作品 `aweme_id`，方便回查原文。

分析结论要引用具体作品（`aweme_id`），不要只给印象式判断。转写里的数字和专有名词有 ASR 错误的风险，引用前要标注。

## 完成后

把 `transcripts.jsonl`、`stats.md` 和分析文档一起提交到仓库，提交信息写清楚转写进度（已完成条数、失败条数）。

## 拆解其他博主的作品

用 `scripts/creator_breakdown.py`（搜索 → 下载 → 切镜头 → 联系表 → 转写），产物放 `research/creators/<博主>/`，原视频不入库。第一个例子：[小Lin说](../../research/creators/xiaolinshuo/README.md)。有些账号的作品列表接口返回为空，可以改用视频搜索取作品。
