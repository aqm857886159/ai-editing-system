# 素材去哪找、找谁做

先按 [视觉编辑指南 · 素材从哪来](../visual-editing.md#素材从哪来) 的三问决定一个画面需求走“自有 / 搜索 / 库存 / 生成”哪条路。本页回答下一步：这条路具体用什么渠道、什么命令、找到以后怎么登记。搜索方法和停止条件见 [素材规则](README.md)。

## 渠道总表

| 要找的 | 用什么 | 命令 / 入口 | 用法边界 |
|---|---|---|---|
| **自己做过的过程和结果** | 原始录制、后台、历史项目证据 | `scripts/focusee.py prep` 输出的 `screen.mp4`（见 [workflow 第 1 步](../workflow.md#1-登记来源与观看目标)）；`projects/*/evidence/` | 证明“我真的做过”时第一选择 |
| **官方原文、数据、新闻页** | 网页搜索 + 内置浏览器截图 | 搜“机构 + 指标 + 原始报告 + 年份”，在浏览器里打开原页截取需要的区域；数据表下载原文件 | 截图存项目 `evidence/`，记页面标题、网址、访问日期、裁切范围 |
| **平台上的真实作品**（新闻片段、热点事件、别人的案例、某人说过的话） | TikHub：抖音、B站、YouTube、微博、小红书 | `python3 scripts/find_media.py search douyin "关键词" --out projects/<片名>/research/media-search.json`，挑中后 `find_media.py download <链接> --dir projects/<片名>/media/found` | 只做**引用**：短（一般 10 秒以内）、画面标出处（作者 + 平台）、用来评论或证明；能截图说明的就不用视频。不当通用 B-roll |
| **具体对象的图片**（产品、人物、地点、界面） | 官方站和新闻图；维基共享资源（commons.wikimedia.org，授权写在每张图页面上）；平台图文 | `find_media.py search xhs-image / douyin-image "关键词"` | 平台图文是别人的作品，只作引用并标出处 |
| **通用情境**（城市、办公室、工厂、手部特写） | 库存：Pexels、Pixabay、Unsplash、Freesound | ChatCut `search_stock_media`（不需要自己的 key），下载 `downloadUrl` 后 `push_asset` | 商用免署名，但不覆盖画面里可识别的人和品牌；连续库存不超过一组镜头 |
| **抽象概念、隐喻、找不到的情境** | 生成图 / 生成视频 | 见下文“生成” | 是示意，不是证据；先写本片 `style-lock.md` |
| **音乐、音效** | ChatCut 音效库、库存音乐、生成 | 见 [声音](../sound.md) | 只用版权清楚的 |
| **学习参考**（别人怎么剪） | TikHub + 本地拆解 | `scripts/creator_breakdown.py` | 只在本地学方法，不进成片 |

TikHub 在本仓库有三个脚本，用途不同：

- `find_media.py`：为当前这条片找真实素材。
- `creator_breakdown.py`：下载参考创作者的视频，在本地拆解镜头。
- `tikhub_douyin.py`：拉本账号的作品数据和转写，用来复盘。

小红书、抖音这类有登录墙的页面，优先用 `find_media.py` 走接口搜；需要截网页原貌时，在内置浏览器里打开（用户已登录的站点保持登录状态）。

## 生成

| 要什么 | 工具 | 要点 |
|---|---|---|
| 进组件的静图、抽象示意、封面 | APIMart `gpt-image-2`：`python3 scripts/apimart_image.py --prompt-file p.txt --size 16:9 --resolution 2k --out out.png [--ref 参考图]` | `size` 支持 1:1、3:2、2:3、4:3、3:4、5:4、4:5、16:9、9:16、21:9 等，也可直接写像素如 `1881x836`；`resolution` 为 1k / 2k / 4k，按档计费，价格以 APIMart 控制台为准；`--ref` 最多 15 张 |
| 生成后直接进 ChatCut 项目的图 | ChatCut `submit_image` | 消耗 ChatCut 额度 |
| 需要参考图、首尾帧控制的视频镜头 | ChatCut `submit_video` | 见 [generation-tools](../generation-tools.md) |
| 单纯文生视频的情境镜头 | PixVerse V6 Max（APIMart） | 参数和价格见 [generation-tools](../generation-tools.md#pixverse-v6-maxapimart) |

- **预算默认值：** 一条片所有生成费用（图、视频、封面，含候选和高清）合计**争取 1 美元以内，最多 2 美元**，在这个范围内按普通步骤直接做；预计超过 2 美元时，先说明要生成什么、为什么、大约多少钱，等用户同意。TikHub 搜索每次约 0.001–0.01 美元，不计入。
  - **生图放开用。** APIMart `gpt-image-2` 一张约 0.0085 美元（1K）/ 0.015 美元（2K）/ 0.022 美元（4K）（2026-10-26 价格页，Gold 档）；封面三比例加候选也只要几毛钱。
  - **生视频要少。** 先想能不能用 explainer-kit 代码渲染、库存视频，或一张生成图加缓推（几乎不花钱）。确实要动态镜头才生成，一条片一般不超过 3–5 段、每段 5 秒左右。
  - **挑便宜模型、低分辨率。** 价格页起步价每秒：`seedance-1-0-pro-fast` 约 0.009 美元、`MiniMax-Hailuo-02` 约 0.010、`seedance-2.0-mini` 约 0.011、`pixverse-v6` 约 0.016、`pixverse-v6-max` 约 0.021（1080p 实测约 0.078）；Kling 系列 0.04–0.11，默认不用。起步价通常对应最低分辨率，出样用 540p / 720p，只给确定入片的镜头出高清。用某个模型前先在 APIMart 控制台确认价格和接口参数。
  - ChatCut `submit_video` / `submit_image` 扣 ChatCut 额度，同样算进这条片的生成预算，提交前先看工具返回的预估消耗。
  - 每次生成把模型、分辨率、时长和花费记进 `asset-register.csv` 的 `notes`，项目 `review.md` 记全片合计。
- **人像参考：** 用户本人获准用作身份参考的照片，可以作为 `--ref` 上传做封面。含账号、订单、聊天等隐私信息的截图，未遮挡前不能上传给任何生成服务。
- 提示词结构、风格锁、出图流程见 [generation-tools · 生成提示词模式](../generation-tools.md#生成提示词模式)。

## 登记

每个进成片的素材在项目 `asset-register.csv` 占一行，列见 [模板](../../templates/content-package/asset-register.csv)：

| 素材 | `asset_kind` | `source_url` | `source_title` | `rights` | `notes` |
|---|---|---|---|---|---|
| 官方 / 新闻截图 | `official` / `news` | 原页网址 | 页面标题 | `official-public` 等 | 裁切范围、版本 |
| 平台作品引用 | `platform-quote` | 作品链接 | 作者 + 标题 | `quote-with-credit` | 用了哪几秒、画面怎么标出处 |
| 库存 | `stock` | 素材页 | 平台 + 作者 | 该平台授权名 | 用在哪段 |
| 生成 | `generated` | 工具和模型，如 `apimart:gpt-image-2` | 提示词文件路径 | `generated` | seed、候选编号、入片位置 |
| 音乐 / 音效 | `music` / `sfx` | 来源或生成工具 | 名称 | 授权 | 用在哪段 |

## GitHub

- **证据源：** 官方仓库、Release、README、Issue 或 commit 用来证明项目、功能和版本。登记仓库 URL、commit 或 tag、访问日期；截图只截需要解释的区域。
- **不默认可搬：** 许可证、归属和时效要记录；确认不了权利时，改用自制图解或自己的录屏。
- token、私有 URL 或带权限的下载链接不进仓库。

## 失败降级

外部页面打不开、接口报错或权利不清时，保留已完成的部分，写清缺口，改用自有素材、自制图解或标明示意的生成图。不把未核验的截图、生成任务 ID 或搜索摘要写成已完成交付。
