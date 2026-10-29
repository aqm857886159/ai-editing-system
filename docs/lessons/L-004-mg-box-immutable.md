# L-004 MG 自然盒创建后不可改
- `create_motion_graphic_from_code` 的 `width/height` 之后不能改（`edit_asset` 不支持）；给 item 强行改宽高会被宽高比锁拦住，硬改会拉伸变形。
- **做法**：先决定盒尺寸再创建；要改尺寸 = 删 item + 删 asset + 重建。被别的时间轴（如备份）引用的 asset 不要强删。
- 同轨道 item 不能重叠 → 常驻控件与卡片分开两条轨道。
- 资产时长固定；要铺更长就重建更长的资产（并用 props 传「第几帧切到第几项」）。
