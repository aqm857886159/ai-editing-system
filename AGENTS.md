# 视频工作台入口

在本仓库执行任务前，读取并遵循 [CLAUDE.md](CLAUDE.md) 中的工作规则，以及它指向的审美、工序和验收文件。这里沿用同一套规则，避免 Codex 与 Claude 各维护一份。

视频发布默认调用 [video-to-platform-package](skills/video-to-platform-package/SKILL.md)：核验成片、适配三比例封面、准备各平台文案和链接，按用户授权保存草稿或实际发布，最后记录逐平台回执。用户已经要求一路做完时，继续完成普通步骤；实际发布状态以平台回执为准。

制作顺序由 [workflow](docs/workflow.md) 维护；素材搜索与证据登记见 [内容包装规则](docs/content-packaging/README.md)，效果和字幕选型见 [视觉编辑指南](docs/visual-editing.md)。本入口只路由，不重复维护原则或工具参数。
