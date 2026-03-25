#!/usr/bin/env python3
"""
MiniMax 中文摘要生成器
用法：
    python minimax_summary.py "一段英文文本"
"""

import os
import re
import sys
import json
import urllib.request

API_URL = "https://api.minimaxi.com/v1/chat/completions"
MODEL = "MiniMax-M2.5-highspeed"


def summarize(text: str) -> str:
    """把英文文本摘要成100-200字中文"""
    prompt = f"为以下内容写100-200字中文摘要：{text}"

    body = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 300,
    }

    api_key = os.environ.get("MINIMAX_API_KEY", "")
    if not api_key:
        raise ValueError("请设置环境变量 MINIMAX_API_KEY")

    req = urllib.request.Request(
        API_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read())

    raw = data["choices"][0]["message"]["content"]

    # 去掉开头和结尾的 thinking 标签
    inner = raw.strip()
    if inner.startswith("<think>"):
        inner = inner[6:].strip()
    # 处理可能的结束标签
    for end_tag in ["", "</think>", "&lt;/think&gt;"]:
        if inner.endswith(end_tag):
            inner = inner[:-len(end_tag)].strip()

    # 从末尾往前找中文段落（摘要通常在 thinking 块末尾）
    chinese_runs = list(re.finditer(r"[\u4e00-\u9fff]{5,}", inner))

    # 取最后几个 run，取最后一个较长的作为摘要
    if chinese_runs:
        last_runs = chinese_runs[-3:]
        for r in reversed(last_runs):
            candidate = r.group()
            if len(candidate) >= 20:  # 至少 20 个中文字符
                return candidate[:200]
        # fallback: 取最后一个
        return chinese_runs[-1].group()[:200]

    # Fallback：返回清理后的内容截断
    inner = re.sub(r"^为以下内容写100-200字中文摘要：.*", "", inner)
    return inner.strip()[:200]


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python minimax_summary.py \"英文文本\"")
        sys.exit(1)

    english_text = sys.argv[1]
    result = summarize(english_text)
    print(result)