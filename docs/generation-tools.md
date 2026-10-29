# 素材生成与获取工具

什么时候用哪一类素材，见[视觉编辑指南 · 素材从哪来](visual-editing.md#素材从哪来)；去哪找、用哪个命令、预算和登记，见 [素材渠道](content-packaging/providers.md)。本文只记生成和代码渲染工具怎么用、多少钱、有什么坑。核查日期：2026-10-26。

## 一览

| 工具 | 产出 | 入口 | 适合 |
|---|---|---|---|
| 代码渲染（HTML / Canvas / SVG / Three.js 逐帧） | 任意时长的精确动画 mp4 / 透明 mov | 2D 讲解画面一律用 [explainer-kit](../templates/explainer-kit/README.md)；3D 短片参考 `projects/2026-10-09-big-theory-era/short-film/` | 概念、关系、数据、历史演进；需要准确文字和统一风格 |
| ChatCut Motion Graphics（JSX） | 时间线上可改字的卡片 | `create_motion_graphic_from_code`，见 [tools-chatcut-mcp](tools-chatcut-mcp.md) | 叠在录屏或口播上、需要在 ChatCut 里反复改字的小卡；整段讲解画面用 kit |
| ChatCut 库存素材 | 实拍视频 / 图片 / 音乐 / 音效 | `search_stock_media`（Pexels、Pixabay、Unsplash、Freesound，不需要自己的 key） | 通用情境（教室、作坊、城市） |
| ChatCut AI 视频 / 图片 | Seedance、Kling、Gemini Omni、MiniMax；GPT Image、Nano Banana | `submit_video` / `submit_image`（消耗 ChatCut 额度） | 生成后直接进项目，适合要首尾帧、参考图控制的镜头 |
| PixVerse V6 Max（APIMart） | 1–15 秒视频，可带原生音频 | REST API，下见 | 库存找不到的特定场景、隐喻画面、风格化过渡；要省钱时先看同平台更便宜的模型 |
| Nomi | 多模型生成 | 本机 Nomi MCP（`nomi_*`）；付费生成走 Run 门 | 需要 Nomi 的分镜 / 一致性工作流时 |

## 代码渲染讲解场景（2D）

用 [explainer-kit](../templates/explainer-kit/README.md)：组件、设计系统、渲染和体检都在那里，每条片在项目 `scenes/` 下引用它，不复制一份去改。`projects/2026-10-24-ai-apprenticeship/scenes/` 是 kit 之前的单片实现，只作历史参考。

- 画面只由时间 t 决定，可以跳到任意时刻出静帧检查，再整段渲染；重新渲染到同一路径，ChatCut 会自动读到新文件，不用重新导入
- 检查 t=0 的静帧：入场动画失效时，元素会从第一帧就全部可见

## PixVerse V6 Max（APIMart）

- 密钥：仓库根目录 `.env` 的 `APIMART_API_KEY`（已被 `.gitignore` 忽略，**不要写进任何被跟踪的文件**）
- 提交：`POST https://api.apimart.ai/v1/videos/generations`，返回 `task_id`
- 查询：`GET https://api.apimart.ai/v1/tasks/{task_id}`
- 参数：`model: "pixverse-v6-max"`；`prompt`（文生视频必填，≤5000 字）；`duration` 1–15 秒（默认 5）；`resolution` 360p / 540p / 720p / 1080p（默认 540p）；`aspect_ratio`（仅文生视频）；`audio`（默认 false）；`seed`
- 图生视频：`image_urls` 只能放 **1 个公网 URL**（JPEG / PNG / WebP，≤20 MB）。本地图要先放到可公开访问的地址；不支持首尾帧和参考图，需要的话改用 ChatCut 的 `submit_video`
- 价格（2026-10-25，按秒）：1080p 约 $0.078/s，720p 约 $0.039/s，带音频更贵。5 秒 1080p ≈ $0.39，占掉单片预算的很大一块；更便宜的模型和单片预算见 [素材渠道 · 生成](content-packaging/providers.md#生成)
- 建议：先 540p / 720p 出样，看构图和运动对了再出 1080p；同一场景固定 `seed` 方便微调
- 文档：[生成接口](https://docs.apimart.ai/cn/api-reference/videos/pixverse-v6-max/generation)

## 库存素材的授权

Pexels 和 Pixabay 允许商用、无需署名，但都**不覆盖画面里可识别的人、商标和品牌**，也不能当素材转卖。用前看单条素材的授权；涉及人物和品牌的画面避免用在可能被理解为代言的位置。

## 生成提示词模式

什么时候该生成，见 [视觉编辑指南 · 素材从哪来](visual-editing.md#素材从哪来)：现实里拍不到的抽象概念直接生成；通用情境先搜库存，找不到或画风不统一再生成；具体存在的人、产品、页面和数据**不生成**。

### 1. 每片先写一份风格锁

同一片里所有生成画面共用一份 `style-lock.md`（模板 [templates/content-package/style-lock.md](../templates/content-package/style-lock.md)），写一次，每条提示词都把它带上。风格锁要和讲解组件的设计系统一致，否则生成图放进组件里会像贴上去的：

- **色调**：和 kit 的 `TOKENS` 对齐，深色底、冷蓝为主，暖金只做点缀
- **光线和质感**：例如低照度、侧光、轻微胶片颗粒
- **镜头**：焦段、景深、视角
- **人物**：默认不出现可识别的正脸，用背影、剪影、手部或远景
- **禁止项**：画面里不要文字、logo、水印、真实品牌和真实产品界面

### 2. 单条提示词的结构

按顺序写五块，缺一块就容易跑偏：

1. **主体和动作**：画什么，正在发生什么。要具体，不写“科技感”“未来感”这类空词
2. **在本段的作用**：这张图替口播里的哪句话说明什么，例如“表现‘买不起’时的无力感”
3. **构图**：主体在画面哪里、留出哪块给组件叠字、画幅比例（进组件的图按组件的格子比例，全屏用 16:9）
4. **风格锁**：整段贴上 `style-lock.md` 的内容
5. **禁止项**：同上，再加本条特有的

生成视频再加第六块：**运动**，即镜头怎么动、多长、开头和结尾是什么状态，方便和前后画面接上。

### 3. 出图流程

1. 同一需求一次出 2–4 个候选，先用低分辨率或小尺寸
2. 放进组件或时间线里看，不单独看图：比例对不对、叠字区够不够、和前后画面色调接不接得上
3. 选定后出高清；同一场景固定 seed，或用选定的图做参考图，保持一致
4. 登记进 `asset-register.csv`，`asset_kind=generated`，各列怎么填见 [素材渠道 · 登记](content-packaging/providers.md#登记)

### 4. 用哪个工具、花多少

工具选择、单片预算默认值和人像参考的边界见 [素材渠道 · 生成](content-packaging/providers.md#生成)。先查自有和库存素材，确实需要再生成；出样阶段用低分辨率。

## 生成素材的通用规则

- AI 生成画面是**示意**：不能当证据，不能出现可被误认为真实的人物、产品界面或文件
- 讲解素材里不要让 AI 写字（会出错），文字一律由代码或 Motion Graphics 叠加。封面例外：按发布 Skill 可以把精确标题写进提示词，生成后逐字检查（[L-012](lessons/L-012-cover-generation.md)），写错就重生或改用代码叠字
- 不生成具体存在的人、产品、页面、新闻或数据的“相似图”；这些只能搜真实来源
- 每个生成镜头记入项目的 `asset-register.csv`，各列怎么填见 [素材渠道 · 登记](content-packaging/providers.md#登记)
