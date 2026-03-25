# ai-agent-weekly 技术情报站改造 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 ai-agent-weekly 从泛 AI 新闻页改造成 15 条分区展示的技术情报站。

**Architecture:** 保留当前静态站 + GitHub Actions 架构，先调整页面骨架与内容配额，再逐步替换/新增数据源，最后增加排序与质量规则。改造过程按三阶段推进，确保每一步都可验证、可回退。

**Tech Stack:** Node.js, Axios, Cheerio, GitHub Actions, GitHub Pages, HTML/CSS/JS, node:test

---

## Chunk 1: 首页结构从 10 条单流改成 15 条三分区

### Task 1: 固化新的内容配额与页面目标

**Files:**
- Modify: `scripts/scrape.js`
- Modify: `ai-agent-weekly.md`
- Test: `tests/workflow-smoke.test.js`

- [ ] **Step 1: 写失败测试，断言页面目标从 10 条升级到 15 条且支持分区结构**
- [ ] **Step 2: 运行测试，确认在旧逻辑下失败**
- [ ] **Step 3: 最小修改 `scripts/scrape.js` 的配置，支持 15 条总数与分区配额配置**
- [ ] **Step 4: 更新 `ai-agent-weekly.md`，记录新目标为 15 条 / 三分区**
- [ ] **Step 5: 运行测试，确认通过**
- [ ] **Step 6: 提交**

### Task 2: 重构 HTML 生成逻辑以支持三分区

**Files:**
- Modify: `scripts/scrape.js`
- Test: `tests/workflow-smoke.test.js`

- [ ] **Step 1: 写失败测试，断言 HTML 中存在 3 个分区标题（开源项目 / 厂商动态 / 前沿技术）**
- [ ] **Step 2: 运行测试，确认失败**
- [ ] **Step 3: 修改 `generateHTML`，把单一 article list 改成三分区渲染**
- [ ] **Step 4: 保留当前卡片字段：原标题、中文摘要、来源、时间、图片**
- [ ] **Step 5: 运行 smoke-check 和测试，确认通过**
- [ ] **Step 6: 提交**

### Task 3: 增加分区基础样式

**Files:**
- Modify: `scripts/scrape.js`
- Test: 手工预览 + `npm run smoke-check`

- [ ] **Step 1: 在生成模板中新增分区标题与容器样式**
- [ ] **Step 2: 确保移动端仍然可读**
- [ ] **Step 3: 本地运行 `npm run preview` 检查页面**
- [ ] **Step 4: 提交**

---

## Chunk 2: 重构数据源，新增 GitHub 与厂商官方来源

### Task 4: 抽象来源类型，为不同分区准备独立来源配置

**Files:**
- Modify: `scripts/scrape.js`
- Modify: `ai-agent-weekly.md`
- Test: `tests/workflow-smoke.test.js`

- [ ] **Step 1: 写失败测试，断言来源配置支持按分区组织**
- [ ] **Step 2: 运行测试，确认失败**
- [ ] **Step 3: 重构 `CONFIG.sources`，把来源按“开源项目 / 厂商动态 / 前沿技术”组织**
- [ ] **Step 4: 更新文档，记录来源策略升级方向**
- [ ] **Step 5: 运行测试，确认通过**
- [ ] **Step 6: 提交**

### Task 5: 新增 GitHub 项目源抓取能力

**Files:**
- Modify: `scripts/scrape.js`
- Create: `tests/github-source-smoke.test.js`

- [ ] **Step 1: 写失败测试，断言系统能处理 GitHub 项目型条目**
- [ ] **Step 2: 运行测试，确认失败**
- [ ] **Step 3: 增加 GitHub 项目抓取逻辑（Trending / topic / 增量项目可先从一种实现开始）**
- [ ] **Step 4: 将抓到的项目标准化为统一文章结构**
- [ ] **Step 5: 运行测试，确认通过**
- [ ] **Step 6: 提交**

### Task 6: 新增厂商官方动态源抓取能力

**Files:**
- Modify: `scripts/scrape.js`
- Create: `tests/vendor-source-smoke.test.js`

- [ ] **Step 1: 写失败测试，断言系统能处理官方 blog / changelog 型来源**
- [ ] **Step 2: 运行测试，确认失败**
- [ ] **Step 3: 先接入 1~2 个厂商官方源（例如 OpenAI / Anthropic）**
- [ ] **Step 4: 统一字段，确保能正常进入“厂商动态”分区**
- [ ] **Step 5: 运行测试，确认通过**
- [ ] **Step 6: 提交**

---

## Chunk 3: 增加技术价值筛选与排序规则

### Task 7: 为条目增加技术标签与价值标签字段

**Files:**
- Modify: `scripts/scrape.js`
- Modify: `ai-agent-weekly.md`
- Test: `tests/workflow-smoke.test.js`

- [ ] **Step 1: 写失败测试，断言卡片支持技术标签/价值标签字段**
- [ ] **Step 2: 运行测试，确认失败**
- [ ] **Step 3: 给标准化 article 结构增加 `techTags` / `valueTag` 字段**
- [ ] **Step 4: 在 HTML 卡片中渲染这些字段**
- [ ] **Step 5: 更新文档说明标签含义**
- [ ] **Step 6: 运行测试并提交**

### Task 8: 增加技术价值评分函数

**Files:**
- Modify: `scripts/scrape.js`
- Create: `tests/scoring.test.js`

- [ ] **Step 1: 写失败测试，覆盖技术价值评分的基本规则**
- [ ] **Step 2: 运行测试，确认失败**
- [ ] **Step 3: 实现评分函数（技术价值 / 新鲜度 / 来源可信度 / 可落地性 / 相关度）**
- [ ] **Step 4: 在各分区内部按综合分排序**
- [ ] **Step 5: 运行测试，确认通过**
- [ ] **Step 6: 提交**

### Task 9: 增加质量过滤规则

**Files:**
- Modify: `scripts/scrape.js`
- Create: `tests/filtering.test.js`

- [ ] **Step 1: 写失败测试，过滤纯 PR / 低技术价值 / 重复主题内容**
- [ ] **Step 2: 运行测试，确认失败**
- [ ] **Step 3: 实现过滤器并接入主流程**
- [ ] **Step 4: 运行测试和 smoke-check，确认通过**
- [ ] **Step 5: 提交**

---

## Chunk 4: 收尾与稳定性建设

### Task 10: 同步 README 与项目说明

**Files:**
- Modify: `README.md`
- Modify: `ai-agent-weekly.md`

- [ ] **Step 1: 更新 README，反映 15 条 / 三分区 / 技术情报站定位**
- [ ] **Step 2: 同步 `ai-agent-weekly.md`，记录已完成改造内容**
- [ ] **Step 3: 提交**

### Task 11: 清理调试脚本与技术债

**Files:**
- Modify/Delete: `test-fetch.js`
- Modify/Delete: `test-image.js`
- Modify/Delete: `scripts/test-*.js`

- [ ] **Step 1: 列出所有调试脚本并判断保留/删除**
- [ ] **Step 2: 删除无用脚本或迁移到统一 debug 目录**
- [ ] **Step 3: 运行测试与 smoke-check，确认不受影响**
- [ ] **Step 4: 提交**

### Task 12: 验证生产流水线

**Files:**
- Modify: `.github/workflows/daily-update.yml`（如有必要）
- Test: `npm test`, `npm run preview`, GitHub Actions 手动触发

- [ ] **Step 1: 本地跑完整测试**
- [ ] **Step 2: 手动触发 workflow_dispatch**
- [ ] **Step 3: 检查 3 个分区、15 条内容、真实图片、正确时间与来源**
- [ ] **Step 4: 如有必要微调 workflow**
- [ ] **Step 5: 最终提交**

---

Plan complete and saved to `docs/superpowers/plans/2026-03-25-ai-agent-weekly-technical-radar.md`. Ready to execute?
