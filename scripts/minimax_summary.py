#!/usr/bin/env python3
"""
MiniMax 中文摘要生成器
用法：python minimax_summary.py "英文文本"
"""

import json
import os
import re
import sys
import urllib.request

API_URL = "https://api.minimaxi.com/v1/chat/completions"
MODEL = "MiniMax-M2.5-highspeed"
PROMPT_PREFIX = "为以下内容写100-200字中文摘要："


def chinese_char_count(text: str) -> int:
    return len(re.findall(r"[\u4e00-\u9fff]", text or ""))


def clean_candidate(candidate: str, source_text: str) -> str:
    summary = (candidate or "").strip()
    summary = re.sub(r"<think>[\s\S]*?</think>", "", summary, flags=re.S).strip()
    summary = summary.replace(f"{PROMPT_PREFIX}{source_text}", "", 1).strip()
    summary = re.sub(rf"^{re.escape(PROMPT_PREFIX)}\s*", "", summary)
    summary = re.sub(r"^(中文摘要|摘要|Summary)\s*[:：]\s*", "", summary, flags=re.I)
    summary = summary.strip('"\'“”‘’ \\n\\r\\t')
    return summary[:200].strip()


def extract_summary(raw: str, source_text: str) -> str:
    inner = (raw or "").strip()
    inner = re.sub(r"<think>[\s\S]*?</think>", "", inner, flags=re.S).strip()

    candidates = []

    for quoted in re.findall(r'[“"]([^"”]+)[”"]', inner, flags=re.S):
        candidates.append(quoted)

    for sentence in re.split(r"[。！？\n]", inner):
        sentence = sentence.strip()
        if sentence:
            candidates.append(sentence)

    candidates.append(inner)

    for candidate in candidates:
        cleaned = clean_candidate(candidate, source_text)
        if chinese_char_count(cleaned) >= 10 and PROMPT_PREFIX not in cleaned:
            return cleaned

    return clean_candidate(inner, source_text)


def request_completion(prompt: str, api_key: str) -> str:
    body = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
    }

    req = urllib.request.Request(
        API_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read())

    return data["choices"][0]["message"]["content"]


def summarize(text: str) -> str:
    api_key = os.environ.get("MINIMAX_API_KEY", "")
    if not api_key:
        raise ValueError("请设置环境变量 MINIMAX_API_KEY")

    prompts = [
        f"{PROMPT_PREFIX}{text}",
        (
            "请直接输出100-200字中文摘要，不要解释，不要复述题目，不要输出英文。"
            f"内容：{text}"
        ),
    ]

    last_summary = ""
    for prompt in prompts:
        raw = request_completion(prompt, api_key)
        summary = extract_summary(raw, text)
        last_summary = summary
        if chinese_char_count(summary) >= 10 and PROMPT_PREFIX not in summary:
            return summary

    return last_summary


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python minimax_summary.py \"英文文本\"")
        sys.exit(1)
    result = summarize(sys.argv[1])
    print(result)
