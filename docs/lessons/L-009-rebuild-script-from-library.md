# L-009 重建 A-roll：用原稿 token 区间
- `apply_script` 的行必须是原稿词的连续子串；要「恢复被删词」→ 从 `library/*.md` 取 token 区间重写 `timeline.md`。
- 行内**不要带** `[silence=…]`（报「Inline silence rewrites may delete spoken words but cannot change them」）。
- 每行前保留 `### <素材名>` 行。重建后先预览并听句尾；必要时只清明显冗长静音，`longSilence=600` 是历史起始值，不自动删除操作等待或自然呼吸。修改后重查受影响字幕和画面时间映射。
