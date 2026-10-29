# dbskill（仓库内快照）

本目录保存本视频工作台实际采用的 dbskill 资料快照。上游是 [dontbesilent2025/dbskill](https://github.com/dontbesilent2025/dbskill)（dontbesilent 内容方法论，CC BY-NC 4.0，引用时注明出处）；早期快照来自本机 `~/.agents/skills/`。快照用于让仓库内的规则、标题和复盘可以独立追溯。

## 本次采用的资料

| 快照 | 用途 |
|---|---|
| [`source/dbs-title-cover-intro.SKILL.md`](source/dbs-title-cover-intro.SKILL.md) | 先定选题，再让标题、封面、开头说同一个许诺；冷开场怎么从原素材里挑（2026-10-26，v3.0.2） |
| [`source/dbs-script-flow.SKILL.md`](source/dbs-script-flow.SKILL.md) | 逐段找观众会划走的位置：逻辑断裂、信息密度掉、口播卡壳（2026-10-26，v3.0.2） |
| [`source/dbs-content-value.SKILL.md`](source/dbs-content-value.SKILL.md) | 内容对观众的价值判断（2026-10-26，v3.0.2） |
| [`source/dbs-xhs-title.SKILL.md`](source/dbs-xhs-title.SKILL.md) | 标题公式、痛点、悬念、数字锚定和标题长度检查 |
| [`source/dbs-hook.SKILL.md`](source/dbs-hook.SKILL.md) | 开头钩子与前几秒停留设计 |
| [`source/dbs-resonate.SKILL.md`](source/dbs-resonate.SKILL.md) | 核心机制、沉默解除、立场和行动冲动检查 |
| [`source/dbs-content.SKILL.md`](source/dbs-content.SKILL.md) | 形式匹配、表达效率、认知落差和内容诊断 |
| [`source/dbs-content-system.SKILL.md`](source/dbs-content-system.SKILL.md) | 内容单元、来源、版本和可复用资产的管理方式 |
| [`source/references/`](source/references/) | 上面两份 2026-10-26 快照引用的参考文件；上游缺 `angle-development`、`angle-theory-sources`、`candidate-selection`、`module-handoff` 四份，原文里这几处链接打不开。许可证见 [`source/LICENSE`](source/LICENSE) |
| [`content-system/`](content-system/) | 内容系统的字段、处理流程、来源命名和验收规则 |
| [`../content-packaging/`](../content-packaging/) | 结构变体、事实素材、标题/简介/封面发布包和独立观众审稿 |

## 使用边界

标注 2026-10-26 的三份取自上游 v3.0.2，其余是 2026-10-04 的本地快照，都不自动代表上游最新版本；上游已用 `dbs-title-cover-intro` 取代旧的开头钩子写法，两者冲突时以新的为准。修改规则时先改本仓库的 [`rules.md`](rules.md)，并在引用中注明来源文件和章节；需要同步上游时重新复制快照并记录日期。
