# AI Agent 前沿动态

🤖 每日自动更新的 AI Agent 前沿资讯网站

**网站地址**：(https://southeastboss.github.io/ai-agent-weekly/)

**数据来源**：artificialintelligence-news.com（每日自动抓取）

---

## 🎯 内容分类

- 🤖 **Agent / 多智能体**：OpenAI、Anthropic、NVIDIA 等 Agent 产品与技术
- 🦾 **具身智能**：人形机器人、工业自动化、物理 AI
- ⚙️ **自动化**：Agentic AI、工作流自动化
- 🔬 **研究**：学术进展、技术突破
- 💰 **金融**：AI 在金融领域的应用

---

## ⚙️ 技术栈

| 组件 | 技术 |
|------|------|
| 展示 | 纯静态 HTML/CSS/JS |
| 爬虫 | Node.js + Cheerio + Axios |
| 自动化 | GitHub Actions |
| 托管 | GitHub Pages（免费）|
| 数据源 | artificialintelligence-news.com |

---

## 🔄 自动更新机制

每天北京时间 08:00，GitHub Actions 自动：

1. 抓取最新 AI Agent 新闻
2. 渲染 HTML 页面
3. 提交并推送到 GitHub
4. GitHub Pages 自动部署新内容

---

## 🚀 快速部署

详见 [DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md)

---

## 📝 本地开发

```bash
# 安装依赖
npm install

# 本地运行爬虫
npm run scrape

# 本地预览
npm run preview
```
