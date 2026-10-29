# 踩坑库索引（一条一个文件）

| 编号 | 一句话 |
|---|---|
| [L-001](L-001-asr-boundary-leak.md) | 剪口边缘的残字会漏进字幕 |
| [L-002](L-002-sentence-level-cuts.md) | 句内抠字 = 卡顿/剪辑感重；以句子为单位剪 |
| [L-003](L-003-zoom-only-on-real-cuts.md) | 跳剪是检查线索，不机械交替缩放 |
| [L-004](L-004-mg-box-immutable.md) | MG 自然盒创建后不可改；轨道不能重叠 |
| [L-005](L-005-safe-zones-9x16.md) | 9:16 安全区，卡片别压脸 |
| [L-006](L-006-finalize-aroll-first.md) | A-roll 定稿前不做动画/字幕 |
| [L-007](L-007-preview-single-frame.md) | 单帧范围才是大图；必须亲眼看渲染帧 |
| [L-008](L-008-verify-numbers.md) | 数字别信音频转写，上屏前核实 |
| [L-009](L-009-rebuild-script-from-library.md) | 用原稿 token 区间重建 A-roll |
| [L-010](L-010-asr-dictionary.md) | ASR 错字词典 |
| [L-011](L-011-no-global-speedup.md) | 先算语速再谈加速 |

## 执行入口

工序与交付门槛统一在 [workflow](../workflow.md)；效果、正常字幕、更正和隐私细则在 [视觉编辑指南](../visual-editing.md)，素材搜索在 [内容包装规则](../content-packaging/README.md)。本索引不另存一套重复清单。

## 封面
- [L-012](L-012-cover-generation.md) 生图结果要实查字形、人物、尺寸与可读性
- [L-013](L-013-cover-master-first.md) 参考方法，为本期写新提示词；旧母版脚本仅按需

## 代码渲染短片
- [L-014](L-014-code-rendered-3d-film.md) 3D 短片：竖屏视角窄、剪影会合并、静音要切混响尾巴
- [L-016](L-016-landscape-explainer-scenes.md) 横屏口播配代码讲解场景：先分区再做画面，改字幕后逐场景复查，改完再导出

## 发布
- [L-015](L-015-platform-publish-receipts.md) 四平台发布：核对裁剪、读回字段、区分审核与公开，未知结果先查后重试
