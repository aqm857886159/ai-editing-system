# GitHub：任何 Agent 怎么提交和合并

仓库：你自己的 GitHub 仓库，默认分支 `main`。

## 账号

- **本机：** 先装 GitHub CLI（`gh`），运行 `gh auth login` 登录一次，再用 `git config --global user.name` 配好提交身份。之后任何 Agent 都直接用 `git` 和 `gh`，开工前 `gh auth status` 确认一下。
- **云端或别的电脑：** 那边要由用户自己 `gh auth login` 登录一次。`.env` 里的 TikHub / APIMart key 不在 GitHub 上，要在那边的环境变量里另配；没配就跳过要用 key 的步骤并说明。
- 不把任何 token、cookie、登录信息写进仓库、提交信息或 PR 描述。

## 每次改仓库的流程

1. 从最新的 `main` 开分支：`git fetch origin && git checkout -b <类型>/<短名> origin/main`。类型用 `docs`、`rules`、`feature`、`content`、`research`。
2. 只 `git add` 本次改动的文件，**不用 `git add -A`**。工作区里常有别的会话留下的未跟踪文件，不是你的就不碰。
3. 提交信息用英文写一句概括，下面列要点，结尾加 `Co-Authored-By` 那行（以系统给的为准）。
4. `git push -u origin <分支>`，`gh pr create --base main`，PR 描述写：为什么改、改了什么、怎么验证的、没解决什么。
5. **用户说“合入”“合并”才合：** `gh pr merge <号> --merge`，然后 `git checkout main && git merge --ff-only origin/main`。用户说“传到 GitHub”“推上去”，意思是推分支、开 PR，再问要不要合。

## 红线

- `.env` 永远不入库；`git status` 里看到它被跟踪，`git rm --cached .env`（只动索引）。
- 单文件不超过 50 MB：`*.mp4`、`*.mov`、`*.wav` 已经被忽略，新增其他媒体类型时补 `.gitignore`，不用 `git add -f` 绕。推送前可以查：`find . -type f -size +50M -not -path "./.git/*"`。
- 参考创作者的视频、逐帧截图只在本地，见 `research/creators/.gitignore`。

## 常见冲突

- **`data/projects.csv`**：两边的行都保留，按 `date` 排序；行的列数要和表头一致，合并后用 Python 的 `csv` 模块读一遍检查。
- **同一条视频两个目录名**：两边内容常常互补，不要擅自删除，列出来让用户决定。
