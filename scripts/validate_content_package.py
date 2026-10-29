#!/usr/bin/env python3
"""Validate the small, auditable publish package for one video project.

The default mode checks structure and reports warnings. ``--ready`` applies the
release gate: selected structure, evidence-backed copy, three readable covers,
and a passed independent audience review are required.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import struct
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover - optional local quality enhancement
    Image = None


RATIOS = {"3:4": (3 / 4), "4:3": (4 / 3), "16:9": (16 / 9)}
PLATFORMS = ("xiaohongshu", "douyin", "bilibili", "x")
FORBIDDEN = ("APIMART_API_KEY", "TIKHUB_API_KEY", "Authorization: Bearer", "Bearer sk-")


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def read_json(path: Path, errors: list[str]) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(errors, f"缺少 {path.name}")
        return {}
    except (OSError, json.JSONDecodeError) as exc:
        fail(errors, f"无法读取 {path.name}: {exc}")
        return {}
    if not isinstance(data, dict):
        fail(errors, f"{path.name} 必须是 JSON 对象")
        return {}
    return data


def text_len(value: str) -> int:
    return len(value.strip())


def png_size(path: Path) -> tuple[int, int] | None:
    """Read PNG dimensions without requiring Pillow; return None for other formats."""
    if path.suffix.lower() != ".png":
        return None
    try:
        header = path.read_bytes()[:24]
        if header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
            return None
        return struct.unpack(">II", header[16:24])
    except (OSError, struct.error):
        return None


def readable_image_size(path: Path) -> tuple[int, int] | None:
    """Verify image readability when Pillow is available, then return dimensions."""
    if Image is not None:
        try:
            with Image.open(path) as image:
                size = image.size
                image.verify()
                return size
        except (OSError, ValueError):
            return None
    return png_size(path)


def validate(project_dir: Path, ready: bool) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    manifest_path = project_dir / "packaging.json"
    data = read_json(manifest_path, errors)
    if not data:
        return errors, warnings

    raw = ""
    for path in (manifest_path, project_dir / "asset-register.csv", project_dir / "audience-review.md"):
        if path.exists():
            raw += path.read_text(encoding="utf-8", errors="ignore")
    for token in FORBIDDEN:
        if token in raw:
            fail(errors, f"检测到疑似凭证内容: {token}")

    for key in ("schema_version", "project", "status", "content_kernel", "structure_variants", "platforms", "covers", "audience_review", "gates"):
        if key not in data:
            fail(errors, f"packaging.json 缺少字段 {key}")

    kernel = data.get("content_kernel", {})
    if not isinstance(kernel, dict):
        fail(errors, "content_kernel 必须是对象")
        kernel = {}
    for key in ("audience_state", "promise", "mechanism", "boundary", "cta"):
        if not str(kernel.get(key, "")).strip():
            fail(errors, f"content_kernel.{key} 为空")
    proof_claim_ids = kernel.get("proof_claim_ids", []) or []
    if not isinstance(proof_claim_ids, list):
        fail(errors, "content_kernel.proof_claim_ids 必须是数组")
        proof_claim_ids = []
    claim_ids = set(proof_claim_ids)

    owned_links = data.get("owned_links", {})
    if not isinstance(owned_links, dict):
        fail(errors, "owned_links 必须是对象")
        owned_links = {}
    for key in ("github", "website"):
        if ready and key in owned_links and not re.match(r"^https?://", str(owned_links[key])):
            fail(errors, f"owned_links.{key} 缺少可访问 URL")

    variants = data.get("structure_variants", [])
    if not isinstance(variants, list):
        fail(errors, "structure_variants 必须是数组")
        variants = []
    if len(variants) < 3:
        fail(errors, "structure_variants 至少保留 3 个结构候选")
    selected = [v for v in variants if isinstance(v, dict) and v.get("selected")]
    if ready and len(selected) != 1:
        fail(errors, "ready 需要且只能选择 1 个结构候选")
    for variant in variants:
        if not isinstance(variant, dict):
            fail(errors, "结构候选必须是对象")
            continue
        if variant.get("selected") and (not variant.get("fit") or not variant.get("beats")):
            fail(errors, f"结构 {variant.get('id', '?')} 已选但缺少 fit 或 beats")

    platforms = data.get("platforms", {})
    if not isinstance(platforms, dict):
        fail(errors, "platforms 必须是对象")
        platforms = {}
    for platform in PLATFORMS:
        item = platforms.get(platform, {})
        if not item:
            fail(errors, f"缺少平台包装: {platform}")
            continue
        if not isinstance(item, dict):
            fail(errors, f"平台包装必须是对象: {platform}")
            continue
        if platform == "x":
            if ready:
                post = str(item.get("post", "")).strip()
                if not post:
                    fail(errors, "X/Twitter 缺少 post")
                elif text_len(post) > 280:
                    fail(errors, "X/Twitter 单条 post 超过 280 字符")
            continue
        titles = item.get("titles", [])
        if not isinstance(titles, list):
            fail(errors, f"{platform}.titles 必须是数组")
            titles = []
        if ready and len(titles) < 3:
            fail(errors, f"{platform} 至少提供 3 个标题候选")
        for index, title in enumerate(titles, 1):
            if not isinstance(title, dict) or not str(title.get("text", "")).strip():
                fail(errors, f"{platform} 标题 {index} 缺少 text")
                continue
            if not title.get("formula_id"):
                fail(errors, f"{platform} 标题 {index} 缺少 dbskill formula_id")
            if not title.get("tension"):
                fail(errors, f"{platform} 标题 {index} 缺少 tension")
            if platform == "xiaohongshu" and text_len(title["text"]) > 20:
                fail(errors, f"小红书标题 {index} 超过 20 字")
        if ready and not str(item.get("description_short", "")).strip():
            fail(errors, f"{platform} 缺少 description_short")

    bilibili_item = platforms.get("bilibili", {})
    bilibili_long = str(bilibili_item.get("description_long", "")) if isinstance(bilibili_item, dict) else ""
    if ready:
        for key in ("github", "website"):
            url = str(owned_links.get(key, "")).strip()
            if url and url not in bilibili_long:
                fail(errors, f"B 站长简介缺少自有链接: {key}")

    covers = data.get("covers", {})
    if not isinstance(covers, dict):
        fail(errors, "covers 必须是对象")
        covers = {}
    master = covers.get("master", {})
    if not isinstance(master, dict):
        fail(errors, "covers.master 必须是对象")
        master = {}
    for key in ("headline", "hero", "anchor"):
        if ready and not str(master.get(key, "")).strip():
            fail(errors, f"covers.master.{key} 为空")
    ratios = covers.get("ratios", {})
    if not isinstance(ratios, dict):
        fail(errors, "covers.ratios 必须是对象")
        ratios = {}
    for ratio, target in RATIOS.items():
        item = ratios.get(ratio, {})
        if not item:
            fail(errors, f"缺少 {ratio} 封面记录")
            continue
        if not isinstance(item, dict):
            fail(errors, f"{ratio} 封面记录必须是对象")
            continue
        width, height = item.get("width"), item.get("height")
        if not isinstance(width, (int, float)) or not isinstance(height, (int, float)) or height == 0:
            fail(errors, f"{ratio} 封面缺少有效尺寸")
        elif abs(width / height - target) > 0.02:
            fail(errors, f"{ratio} 封面尺寸与比例不符: {width}x{height}")
        cover_path = project_dir / str(item.get("path", ""))
        if ready:
            if not cover_path.exists():
                fail(errors, f"缺少封面文件: {item.get('path', '')}")
            else:
                actual = readable_image_size(cover_path)
                if actual is None:
                    fail(errors, f"{ratio} 封面不是可读图片")
                elif actual and isinstance(width, (int, float)) and isinstance(height, (int, float)) and actual != (int(width), int(height)):
                    fail(errors, f"{ratio} 封面实际尺寸 {actual[0]}x{actual[1]} 与 manifest 不符")
            if not str(item.get("prompt", "")).strip():
                fail(errors, f"{ratio} 封面缺少 prompt")

    asset_path = project_dir / "asset-register.csv"
    asset_ids: set[str] = set()
    if not asset_path.exists():
        fail(errors, "缺少 asset-register.csv")
    else:
        try:
            with asset_path.open(newline="", encoding="utf-8") as handle:
                rows = list(csv.DictReader(handle))
            for row in rows:
                if row.get("claim_id"):
                    asset_ids.add(row["claim_id"])
                if ready and row.get("claim_id") and row.get("evidence_status") not in {"verified", "used"}:
                    warnings.append(f"素材 {row['claim_id']} 仍是 {row.get('evidence_status', '空')} 状态")
        except (OSError, csv.Error) as exc:
            fail(errors, f"无法读取 asset-register.csv: {exc}")
    missing_claims = sorted(claim_ids - asset_ids)
    if missing_claims:
        fail(errors, f"proof_claim_ids 没有对应素材证据: {', '.join(missing_claims)}")

    review = data.get("audience_review", {})
    if not isinstance(review, dict):
        fail(errors, "audience_review 必须是对象")
        review = {}
    review_path = project_dir / str(review.get("path", "audience-review.md"))
    if not review_path.exists():
        fail(errors, f"缺少观众审稿文件: {review_path.name}")
    if ready and review.get("status") != "pass":
        fail(errors, "ready 要求 audience_review.status=pass")
    if ready and review.get("blocking_findings"):
        fail(errors, "audience_review 仍有 blocking_findings")

    gates = data.get("gates", {})
    if not isinstance(gates, dict):
        fail(errors, "gates 必须是对象")
        gates = {}
    if ready:
        pending = [key for key, value in gates.items() if value != "pass"]
        if pending:
            fail(errors, f"以下 gate 未通过: {', '.join(pending)}")
        if data.get("status") not in {"ready", "published"}:
            fail(errors, "ready 检查要求 status=ready 或 published")
    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project", type=Path, help="一个 projects/<name> 目录")
    parser.add_argument("--ready", action="store_true", help="执行发布前阻断检查")
    args = parser.parse_args()
    errors, warnings = validate(args.project, args.ready)
    for warning in warnings:
        print(f"WARN  {warning}")
    for error in errors:
        print(f"ERROR {error}")
    if errors:
        print(f"FAIL  {len(errors)} 个问题")
        return 1
    print("PASS  内容包装结构检查通过" + ("（发布门槛）" if args.ready else "（草稿）"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
