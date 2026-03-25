import importlib.util
import json
import os
import pathlib
import re
import unittest
from unittest import mock

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT_PATH = REPO_ROOT / "scripts" / "minimax_summary.py"

spec = importlib.util.spec_from_file_location("minimax_summary", SCRIPT_PATH)
minimax_summary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(minimax_summary)


class FakeResponse:
    def __init__(self, content: str):
        self._payload = json.dumps({
            "choices": [{"message": {"content": content}}]
        }).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return self._payload


class MiniMaxSummaryTests(unittest.TestCase):
    def setUp(self):
        self.env = mock.patch.dict(os.environ, {"MINIMAX_API_KEY": "test-key"}, clear=False)
        self.env.start()
        self.request_bodies = []

    def tearDown(self):
        self.env.stop()

    def fake_urlopen(self, request, timeout=20):
        self.request_bodies.append(json.loads(request.data.decode("utf-8")))
        return FakeResponse("这是一个用于测试的中文摘要，长度足够，而且不会混入英文提示词。")

    def test_request_completion_does_not_send_max_tokens_limit(self):
        with mock.patch.object(minimax_summary.urllib.request, "urlopen", side_effect=self.fake_urlopen):
            summary = minimax_summary.summarize("OpenAI released GPT-5")

        self.assertTrue(summary)
        self.assertGreaterEqual(len(self.request_bodies), 1)
        self.assertNotIn("max_tokens", self.request_bodies[0])

    def test_request_completion_uses_longer_timeout_without_token_limit(self):
        timeouts = []

        def fake_urlopen_with_timeout(request, timeout=20):
            timeouts.append(timeout)
            return FakeResponse("这是一个用于测试的中文摘要，长度足够，而且不会混入英文提示词。")

        with mock.patch.object(minimax_summary.urllib.request, "urlopen", side_effect=fake_urlopen_with_timeout):
            summary = minimax_summary.summarize("OpenAI released GPT-5")

        self.assertTrue(summary)
        self.assertGreaterEqual(len(timeouts), 1)
        self.assertGreaterEqual(timeouts[0], 180)

    def test_strips_instruction_prefix_from_summary(self):
        raw = (
            "为以下内容写100-200字中文摘要：OpenAI released GPT-5 "
            "这是 OpenAI 最新发布的大模型，在推理、多模态理解和安全性方面都有明显提升，"
            "可支持更复杂的应用开发与部署场景。"
        )

        with mock.patch.object(minimax_summary.urllib.request, "urlopen", return_value=FakeResponse(raw)):
            summary = minimax_summary.summarize("OpenAI released GPT-5")

        self.assertNotIn("为以下内容写100-200字中文摘要", summary)
        self.assertIn("这是 OpenAI 最新发布的大模型", summary)

    def test_retries_when_first_response_is_still_english(self):
        responses = [
            FakeResponse('Possible summary: "OpenAI released GPT-5, a new AI model with better reasoning."'),
            FakeResponse(
                "OpenAI 正式发布 GPT-5，这一新模型在推理、多模态理解与安全性方面进一步增强，"
                "可支持更复杂的任务处理和企业级应用落地，标志着生成式 AI 能力继续升级。"
            ),
        ]

        with mock.patch.object(minimax_summary.urllib.request, "urlopen", side_effect=responses) as mocked_urlopen:
            summary = minimax_summary.summarize("OpenAI released GPT-5, a new AI model.")

        self.assertGreaterEqual(mocked_urlopen.call_count, 2)
        self.assertGreaterEqual(len(re.findall(r"[\u4e00-\u9fff]", summary)), 10)
        self.assertNotIn("Possible summary", summary)


if __name__ == "__main__":
    unittest.main()
