#!/usr/bin/env python3
"""
MiniMax 中文摘要生成工具
用法：
    python summarize.py "文章标题" "文章描述"

环境变量：
    MINIMAX_API_KEY - MiniMax API 密钥（中国区 api.minimaxi.com）
"""

import os
import sys
import json
import urllib.request


API_URL = "https://api.minimaxi.com/v1/chat/completions"
MODEL = "MiniMax-M2.5-highspeed"


def generate_summary(title: str, description: str, max_chars: int = 200) -> str:
    """
    调用 MiniMax API 为文章生成 100-200 字中文摘要。
    """
    text = f"{title}。{description}"[:500]
    prompt = f"为以下内容写100-200字中文摘要：{text}"

    body = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 300,
    }

    api_key = os.environ.get("MINIMAX_API_KEY", "")
    if not api_key:
        raise ValueError("请设置 MINIMAX_API_KEY 环境变量")

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

    content = data["choices"][0]["message"]["content"]

    # 去掉 thinking 标签内容
    import re
    content = re.sub(r"<think>[\s\S]*?</think>", "", content)

    # 清理 prompt 残留
    summary = content.strip()
    summary = summary.replace(f"为以下内容写100-200字中文摘要：{text}", "")
    for prefix in ["用户要求我", "请直接输出", "请写", "以下是摘要", "摘要如下"]:
        idx = summary.find(prefix)
        if idx != -1:
            # 如果前缀后面紧跟的是中文或标点，说明这部分是 prompt 残留
            after = summary[idx + len(prefix):].lstrip(" ，、。：:")
            if idx == 0 or (idx > 0 and summary[idx - 1] in "。！？\n"):
                summary = after

    return summary.strip()[:max_chars]


def main():
    if len(sys.argv) < 3:
        print("用法: python summarize.py \"标题\" \"描述\"")
        sys.exit(1)

    title = sys.argv[1]
    description = sys.argv[2]

    summary = generate_summary(title, description)
    print(summary)


if __name__ == "__main__":
    main()
