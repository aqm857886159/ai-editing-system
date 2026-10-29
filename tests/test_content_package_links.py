"""Editorial videos need no promotional links; supplied links remain checked."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("package_validator", ROOT / "scripts/validate_content_package.py")
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class ContentPackageLinksTest(unittest.TestCase):
    def validate_package(self, links, description="真实案例与证据"):
        with tempfile.TemporaryDirectory() as directory:
            project = Path(directory)
            data = json.loads((ROOT / "templates/content-package/packaging.json").read_text())
            data.update(project="editorial-video", status="ready", owned_links=links)
            data["content_kernel"] = dict(audience_state="卡住的用户", promise="先查一步", mechanism="降低调查成本", boundary="不保证结果", cta="核实信息", proof_claim_ids=["case"])
            data["structure_variants"][0].update(selected=True, fit="案例先建立信任", beats=["结果", "过程", "行动"])
            for platform in ("xiaohongshu", "douyin", "bilibili"):
                data["platforms"][platform].update(titles=[dict(text=t, formula_id="editorial", tension="反差") for t in ("先查一步", "别急着说无解", "一次真实尝试")], description_short="先查一步", description_long=description)
            data["platforms"]["x"]["post"] = "先查一步，真实结果待验证。"
            data["covers"]["master"].update(headline="先查一步", hero="本人", anchor="真实场景")
            for ratio, size in {"3:4": (108, 144), "4:3": (144, 108), "16:9": (160, 90)}.items():
                filename = ratio.replace(":", "x") + ".png"
                Image.new("RGB", size).save(project / filename)
                data["covers"]["ratios"][ratio].update(path=filename, width=size[0], height=size[1], prompt="test cover")
            data["audience_review"].update(status="pass", blocking_findings=[])
            data["gates"] = {key: "pass" for key in data["gates"]}
            (project / "audience-review.md").write_text("独立审稿通过")
            (project / "asset-register.csv").write_text("claim_id,evidence_status\ncase,verified\n")
            (project / "packaging.json").write_text(json.dumps(data, ensure_ascii=False))
            return validator.validate(project, ready=True)[0]

    def test_editorial_video_without_promotional_links_is_ready(self):
        self.assertEqual(self.validate_package({}), [])

    def test_supplied_link_must_be_valid_and_present_in_long_copy(self):
        url = "https://github.com/example/project"
        self.assertEqual(self.validate_package({"github": url}, "入口：" + url), [])
        self.assertTrue(any("长简介缺少" in e for e in self.validate_package({"github": url})))
        self.assertTrue(any("可访问 URL" in e for e in self.validate_package({"github": "invalid"})))


if __name__ == "__main__":
    unittest.main()
