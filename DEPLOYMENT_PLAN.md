# AI Agent 前沿动态 — 部署方案

> 让 AI 每周自动抓取 AI Agent 前沿新闻，推送到 GitHub Pages

---

## 📋 项目概述

| 项目 | 说明 |
|------|------|
| 目标 | 每天自动更新 AI Agent 领域最新资讯 |
| 展示 | 静态 HTML 网站，托管于 GitHub Pages |
| 更新 | GitHub Actions 每日定时抓取，自动提交推送 |
| 数据源 | artificialintelligence-news.com（AI Agent 相关分类） |

---

## 🏗 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Actions                        │
│                  (每日 08:00 UTC)                        │
│                                                          │
│  ① Cron Trigger ──→ ② Node.js 爬虫脚本                  │
│                            ↓                             │
│                     ③ 抓取新闻数据                        │
│                            ↓                             │
│                     ④ 渲染 HTML 模板                     │
│                            ↓                             │
│                     ⑤ Git commit & push                 │
│                            ↓                             │
│               ⑥ GitHub Pages 自动部署                    │
│                            ↓                             │
│              ⑦ https://用户名.github.io/ai-agent-weekly  │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 项目结构

```
ai-agent-weekly/
│
├── DEPLOYMENT_PLAN.md       ← 本文档
├── README.md                ← 项目说明
├── index.html               ← 主页面（由脚本自动生成）
├── package.json             ← Node.js 依赖
├── .gitignore
│
└── .github/
    └── workflows/
        └── daily-update.yml  ← GitHub Actions 自动化脚本
            └── scripts/
                └── scrape.js  ← 新闻抓取 & HTML 生成脚本
```

---

## 🚀 部署步骤

### 第一步：在 GitHub 上创建仓库

1. 登录 [github.com](https://github.com)
2. 点击右上角 `+` → **New repository**
3. 填写：
   - **Repository name**: `ai-agent-weekly`
   - **Description**: `AI Agent 前沿动态 — 每日自动更新`
   - **Visibility**: `Public`（GitHub Pages 免费版需要 Public）
   - ✅ **DO NOT**勾选 "Add a README"（我们已有）
4. 点击 **Create repository**

### 第二步：本地初始化并推送

```bash
# 进入项目目录
cd ai-agent-weekly

# 初始化 Git
git init

# 添加所有文件
git add .

# 首次提交
git commit -m "feat: initial AI Agent weekly project"

# 添加远程仓库（替换 YOUR_USERNAME 为你的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/ai-agent-weekly.git

# 推送（设置 master 为默认分支）
git push -u origin master
```

### 第三步：配置 GitHub Pages

1. 在 GitHub 仓库页面点击 **Settings** → **Pages**
2. **Source**: Deploy from a branch
3. **Branch**: `master` / `(root)`
4. 点击 **Save**

> 等待 2 分钟后，你的网站将上线于：
> `https://YOUR_USERNAME.github.io/ai-agent-weekly`

### 第四步：验证 GitHub Actions

1. 仓库页面 → **Actions** 标签
2. 会看到 "Daily AI Agent News Update" 工作流
3. 点击进去可以看到每次运行日志

---

## ⚙️ 核心组件说明

### 1. 爬虫脚本 (`scripts/scrape.js`)

**功能：**
- 访问 `artificialintelligence-news.com` AI Agent 相关分类
- 提取文章标题、摘要、链接、日期、分类
- 将数据注入 HTML 模板
- 输出到 `index.html`

**技术选型：**
- 使用 `axios` 请求页面
- 使用 `cheerio` 解析 HTML
- 使用 `turndown` 将 HTML 内容转为 Markdown 摘要

**依赖：**
```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "cheerio": "^1.0.0",
    "turndown": "^7.1.0",
    "dotenv": "^16.3.0"
  }
}
```

### 2. GitHub Actions 工作流 (`.github/workflows/daily-update.yml`)

**触发条件：**
- 每天北京时间 08:00（UTC 00:00）
- 也可手动触发（workflow_dispatch）

**运行步骤：**
```yaml
1. 检出代码 (actions/checkout)
2. 安装 Node.js 18
3. 安装依赖 (npm install)
4. 运行爬虫脚本 (node scripts/scrape.js)
5. 设置 Git 配置（用于提交）
6. 检查是否有变更
   - 若有变更 → 提交并推送 → 触发 GitHub Pages 部署
   - 若无变更 → 结束（不推送）
```

**为什么用 GitHub Actions 而非其他方案：**

| 方案 | 优点 | 缺点 |
|------|------|------|
| GitHub Actions ✅ | 免费、自带 CI/CD、无服务器成本 | 需要公网访问 |
| Vercel Cron | 简单 | 需要信用卡/额外配置 |
| 自己搭服务器 | 完全可控 | 要付费、维护麻烦 |
| 本地定时任务 | 零成本 | 需要开机、不能自动推送到 GitHub |

### 3. HTML 模板

**静态模板 + 动态数据注入：**

```html
<!-- 数据占位符，由脚本替换 -->
<!-- {{NEWS_ITEMS}} -->  ← 会被替换为文章 HTML
<!-- {{UPDATE_DATE}} --> ← 会被替换为更新时间
```

---

## 🔑 环境变量（可选）

如果需要更稳定的数据源或付费 API：

| 变量名 | 说明 | 获取方式 |
|--------|------|---------|
| `BRAVE_API_KEY` | Web 搜索 API | [brave.com/search/api](https://brave.com/search/api/) |
| `NEWS_API_KEY` | 新闻聚合 API | [newsapi.org](https://newsapi.org/) |
| `GH_TOKEN` | GitHub Personal Access Token | GitHub Settings → Developer settings |

> 注：当前方案完全免费，无需配置任何 API Key

---

## 🕐 自动更新时间

| 时区 | 时间 |
|------|------|
| 北京时间 (CST) | 每日 08:00 |
| UTC | 每日 00:00 |
| 美东 (EST) | 每日 19:00（前一天）|

如需修改，在 `.github/workflows/daily-update.yml` 中找到：
```yaml
schedule:
  - cron: '0 0 * * *'   # ← 修改这里
```

---

## 🔒 安全说明

1. **数据源公开**：抓取的是公开网页，无法律风险
2. **不存储敏感信息**：纯静态页面，无用户数据
3. **GitHub Token**：Actions 用的是 GitHub 自动生成的 `GITHUB_TOKEN`，无需手动配置
4. **恶意软件检测**：需确保被抓取的网站允许爬虫（artificialintelligence-news.com 为公开新闻网站）

---

## 🐛 常见问题

**Q: GitHub Actions 显示失败怎么办？**
A: 点击 Actions → 失败的 workflow → 查看日志，常见原因：
- 网络超时（GitHub 访问外网有限制）
- 依赖安装失败
- 脚本错误

**Q: 怎么手动触发更新？**
A: GitHub 仓库 → Actions → "Daily AI Agent News Update" → Run workflow

**Q: 能改成每几分钟更新一次吗？**
A: 可以，但注意不要过于频繁，以免对目标网站造成压力。GitHub Actions 免费版有 2000 分钟/月限制。

**Q: 部署后网站是空白怎么办？**
A: 检查 GitHub Pages 设置中 source 是否指向正确的分支和目录

---

## 📈 未来扩展方向

- [ ] 接入 AI 摘要功能（用 LLM 自动生成文章摘要）
- [ ] 添加搜索功能
- [ ] 支持邮件订阅
- [ ] 接入更多数据源（36kr、机器之心等）
- [ ] 添加评论区（用 Giscus/Disqus）
- [ ] 支持 RSS 订阅
- [ ] 添加阅读进度追踪
