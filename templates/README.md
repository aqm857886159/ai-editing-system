# templates

| 路径 | 用途 | 状态 |
|---|---|---|
| `explainer-kit/` | 横屏讲解画面组件库：设计系统、19+ 个组件、渲染与体检，见 [README](explainer-kit/README.md) | **现行**，每条讲解片都从这里取 |
| `caption-style.apple.json` | ChatCut 普通字幕样式；`fontSizeByCanvas` 按画幅给字号 | 现行 |
| `content-package/` | 一条片的项目文件模板：`edit-plan.md`、`visual-plan.csv`、`asset-register.csv`、`style-lock.md`、`packaging.json`、`publish.md`、`audience-review.md` | 现行，用到哪个复制哪个 |
| `mg/` | 早期 9:16 竖屏片的 ChatCut Motion Graphics 源码（`*.jsx` + `*.props.json`），自然盒尺寸以 `props.json` 的 `box` 为准、创建后不可改 | 历史参考：横屏讲解画面用 kit；需要在 ChatCut 里改字的叠加小卡可以照它的写法新建 |
| `design-tokens.json` | 早期 Apple 风竖屏 token（1080×1920） | 历史参考：横屏以 kit 的 `TOKENS` 为准 |

简单任务在 `edit-plan.md` 里记录即可；复杂片再用 `visual-plan.csv` 逐句列“原句 → 观众问题 → 素材 / 效果 → 实际预览”，不为填表给每句话加效果。
