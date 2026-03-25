# ai-agent-weekly 项目进展与后续计划

> 维护约定：以后每次针对 `ai-agent-weekly` 项目做修改时，都要同步更新这份 `ai-agent-weekly.md`，确保文档与实际状态保持一致。
>
> 补充约定（2026-03-25）：页面前台不展示“数据来源”文案；来源信息仅保留在程序内部，用于抓取、分区、打分和过滤。

## 1. 项目概览

`ai-agent-weekly` 是一个基于 **Node.js + GitHub Actions + GitHub Pages** 的静态资讯站点，目标是每天自动汇总 AI Agent 相关资讯，并生成一个可直接访问的网页。

当前线上地址：
- https://southeastboss.github.io/ai-agent-weekly/

当前核心定位：
- 聚合 AI Agent / 多智能体 / 自动化 / 具身智能相关新闻
- 自动抓取、自动生成页面、自动发布
- 适合每天快速浏览 10 篇精选内容

---

## 2. 当前已完成的工作

### 2.1 站点基础能力

已完成一个可稳定运行的自动更新资讯站点：
- 静态页面生成
- GitHub Pages 自动部署
- GitHub Actions 自动跑抓取流程
- 支持手动触发更新（`workflow_dispatch`）

主要文件：
- `scripts/scrape.js`：抓取、清洗、翻译、渲染主逻辑
- `.github/workflows/daily-update.yml`：自动更新流水线
- `index.html`：最终生成页面

---

### 2.2 数据源与抓取逻辑

当前抓取源包括：
- `artificialintelligence-news.com` 分类页
- TechCrunch AI RSS
- VentureBeat AI RSS
- Hugging Face Blog RSS

已实现：
- 分类页抓取
- RSS 抓取
- axios 失败时自动回退到 curl
- 去重逻辑（基于 URL）
- 页面级 enrich（补充标题、摘要、图片、日期）

---

### 2.3 内容策略已落地

目前页面策略已经调整为：
- **保留 15 篇精选文章，分成 3 个分区（开源项目 5 / 厂商动态 5 / 前沿技术 5）**
- **标题保持原标题**（不翻译、不再做 AI 总结）
- **摘要为中文简要概括**
- **摘要长度控制在 100 字以内**
- **标题长度保留原始标题，不再额外压缩**

这套策略是多轮试错后收敛出来的稳定方案。

---

### 2.4 标题策略调整过程

标题这块经历过几轮迭代：

1. **英文标题直接展示**
2. **尝试翻译标题**
3. **尝试 AI 生成 20 字以内标题**
4. **发现 AI 输出混入 think / 推理过程**
5. **切回稳定方案：保持原标题**

最终结论：
- OpenAI / MiniMax 一类模型在标题生成场景下，容易输出冗余思考过程
- 对"资讯站点标题"来说，**稳定、干净、无污染输出** 比"看起来更聪明"更重要
- 因此当前保留原标题是最稳的选择

---

### 2.5 摘要策略调整过程

摘要也做过多轮优化：
- 早期 AI 输出可能混入 think 内容
- 后续加了清洗、截断和更稳定的翻译/摘要处理
- 当前摘要已经能做到：
  - 中文输出
  - 不带 think 过程
  - 控制在 100 字以内
  - 页面上完整展示，不再明显截断

当前摘要体验比早期版本稳定很多。

补充修复（2026-03-25）：
- 修复了 MiniMax 摘要中偶发混入提示词前缀（如“为以下内容写100-200字中文摘要：”）的问题
- 增加了摘要结果清洗：去掉 prompt 回显、`Summary:` / `摘要：` 等前缀，以及 think 残留
- 当首轮返回仍偏英文或不符合要求时，会自动使用更严格提示再请求一次，优先拿到纯中文摘要
- 为上述问题新增了 Python 回归测试：`tests/test_minimax_summary.py`
- 进一步修复了 MiniMax 摘要长推理导致正文被截断的问题：移除了请求体中的 `max_tokens: 300`，并将接口超时从 20 秒提高到 180 秒，避免只拿到 `<think>` 而拿不到最终中文摘要

---

### 2.6 图片问题已修复

图片曾经存在两个阶段：

#### 阶段 1：随机占位图
因为某些文章来源页拿不到图片，页面使用了：
- `picsum.photos` 随机图作为占位

问题：
- 图和文章内容不匹配
- 用户体验较差

#### 阶段 2：真实文章配图
后续排查发现：
- `enrichArticle()` 逻辑里存在变量名错误（`generatedTitle`）
- 该 bug 导致 enrich 过程提前异常
- 于是拿不到 `og:image`，才退回成随机图

修复后：
- 页面现在优先使用真实文章来源的 `og:image`
- TechCrunch 类文章已能正确显示真实配图
- 只有在确实抓不到图片时，才应考虑占位图兜底

这是当前版本里一个很关键的质量提升。

---

### 2.7 自动更新机制

当前 workflow 已配置为定时更新：
- 文件：`.github/workflows/daily-update.yml`
- 当前 cron：`0 23 * * *`

含义：
- UTC 每天 23:00 触发
- 北京时间次日 07:00
- 日本时间次日 08:00

之所以不是继续用 `0 0 * * *`：
- GitHub Actions 的 `schedule` 触发 **不保证绝对准点**
- 实测曾出现北京时间 09:25 / 09:44 才实际执行的问题
- 所以改为提前一小时，给 GitHub 的延迟留缓冲

也就是说，这次调整的目标不是"更准点"，而是"更大概率在用户真正起床看网页前完成更新"。

---

### 2.8 测试与校验

目前仓库已有基础校验：
- `tests/workflow-smoke.test.js`
- `tests/beijing-timezone.test.js`
- `scripts/smoke-check.js`

已具备的能力：
- 检查 workflow 中 scrape 和 smoke-check 的顺序
- 检查 Node/GitHub Actions 关键配置
- 检查生成 HTML 至少包含 featured/article cards
- 检查时间逻辑显式使用 `Asia/Shanghai`

虽然测试覆盖还不高，但比纯"拍脑袋部署"已经成熟很多。

---

## 3. 当前项目状态结论

### 当前可认为已经稳定可用的部分

- 网站可正常访问
- 页面自动生成正常
- 抓取逻辑基本稳定
- 标题策略已经收敛（原标题）
- 中文摘要已稳定
- 图片显示质量已有明显提升
- GitHub Actions 流水线可正常跑通
- GitHub Pages 自动部署正常

### 当前仍然存在的不确定性

- GitHub Actions `schedule` 触发时间会漂移
- 外部站点结构变更可能导致抓取规则失效
- 某些来源可能偶发 403，需要依赖 curl 回退
- 页面内容质量仍然依赖来源站点的原始结构与字段质量

---

## 4. 已知问题 / 技术债

### 4.1 README 与当前行为不完全一致

`README.md` 里仍写着：
- "每天北京时间 08:00 自动更新"

但当前真实配置已经改成：
- UTC 23:00
- 北京时间 07:00
- 日本时间 08:00

这个文档需要同步。

---

### 4.2 调试脚本偏多

仓库里存在一些临时/调试性质文件，例如：
- `test-fetch.js`
- `test-image.js`
- `scripts/test-china-endpoint.js`
- `scripts/test-thinking-off.js`
- 以及若干 MiniMax/OpenAI 相关测试脚本

这些文件在调试阶段有价值，但长期会让仓库显得杂乱。

补充处理（2026-03-25）：
- 已清理一批未纳入正式流程的临时调试文件与输出产物（如 `debug*.txt`、`result.txt`、`scripts/raw_out.txt`、若干一次性 MiniMax 调试脚本）
- 已补充 `.gitignore`，忽略 Python `__pycache__/`、`*.pyc` 以及常见调试输出，避免后续再次混入仓库

建议后续：
- 清理临时脚本
- 或统一迁移到 `scripts/debug/` / `scripts/experiments/`

---

### 4.3 内容质量规则还比较分散

目前规则分散在 `scrape.js` 里，包括：
- 标题处理
- 摘要长度
- 图片兜底
- 来源优先级
- 过滤 / 去重

这使得后续维护成本偏高。

建议后续逐步拆分成：
- source adapters
- enrich pipeline
- render pipeline
- content policy config

---

## 5. 已确认的新方向（2026-03-25）

项目后续不再沿着"泛 AI 新闻页"优化，而是转向 **技术情报站 / 技术雷达** 方向。

已经确认的新目标：
- 首页总数改成 **15 条**
- 分成 3 个分区：
  - 开源项目（5）
  - 厂商动态（5）
  - 前沿技术（5）
- 标题保持原标题
- 摘要由 MiniMax AI 生成中文摘要（目标 100~200 字）；API 失败时 fallback 到原文截断（200 字）
- 更强调技术价值、可落地性、来源可信度，而不是泛新闻热度

对应设计文档：
- `docs/superpowers/specs/2026-03-25-ai-agent-weekly-technical-radar-design.md`

对应实施计划：
- `docs/superpowers/plans/2026-03-25-ai-agent-weekly-technical-radar.md`

---

## 6. Chunk 1 已完成（2026-03-25）

**首页结构升级：10 条单流 → 15 条三分区**

### 实现内容
- `scripts/scrape.js`：`maxArticles` 从 10 升级到 15，新增 `CONFIG.sections` 三分区配额配置
- `generateHTML()` 重构：去掉 featured card，改用三分区渲染（开源项目 / 厂商动态 / 前沿技术）
- 新增分区 CSS 样式：`.section-block`、`.section-title`、每区独立底边线颜色
- 保留原有卡片字段：原标题、中文摘要、来源、时间、图片
- `scripts/smoke-check.js`：更新为同时支持 featured card 或 section block 两种结构
- 新增测试：`tests/technical-radar.test.js`（8 个测试用例，覆盖配置、HTML 结构、CSS 类）

### 页面结构
```html
<main>
  <section class="section-block" data-section="open-source">
    <h2 class="section-title">🛠️ 开源项目 <span class="section-count">5</span></h2>
    <div class="article-list"><!-- 5 article-cards --></div>
  </section>
  <section class="section-block" data-section="vendor">
    <h2 class="section-title">🏢 厂商动态 <span class="section-count">5</span></h2>
    <div class="article-list"><!-- 5 article-cards --></div>
  </section>
  <section class="section-block" data-section="frontier">
    <h2 class="section-title">🔬 前沿技术 <span class="section-count">5</span></h2>
    <div class="article-list"><!-- 5 article-cards --></div>
  </section>
</main>
```

### 待完成（Chunk 2+）
- ~~数据源重构：按分区分配不同来源（GitHub Trending → 开源项目，官方博客 → 厂商动态）~~ ✅ Chunk 2 已完成
- 技术价值评分函数
- 质量过滤规则

## 6.1 Chunk 2 已完成（2026-03-25）

**数据源重构：按分区独立配置 + GitHub Trending + 厂商官方博客**

### 实现内容
- `scripts/scrape.js`：`CONFIG.sources` 从扁平数组重构为按分区（`open-source` / `vendor` / `frontier`）组织的对象
- 新增 `extractGitHubTrendingArticles()` 函数：从 GitHub Trending 页面提取 AI/ML 项目，支持 `gh_stars`（今日 star 数）、`gh_lang`（编程语言）等字段
- 新增 `getAllSources()` 辅助函数：将分区来源扁平化为统一数组
- `enrichArticle()` 新增 GitHub 分支：GitHub 项目页面特殊处理（提取项目描述、避免标题被 GitHub 模板污染）
- `generateArticleCard()` 新增 `tag-vendor` 和 `tag-opensource` 标签类型，以及 GitHub star 数和语言渲染
- `scrapeAllSources()` 更新：按分区来源分别抓取，日志显示 `[sectionId]`，新增 `isGitHubTrending` 处理分支

### 新增数据源
- **开源项目分区**：`GitHub Trending Python` + `GitHub Trending JavaScript`（每日 AI/ML 热门项目）
- **厂商动态分区**：`OpenAI Blog RSS` + `Anthropic Blog RSS` + `Google AI Blog RSS`（官方一手动态）
- **前沿技术分区**：保留原有的 `artificialintelligence-news.com` 分类页 + TechCrunch/VentureBeat/HuggingFace RSS

### 规范化文章结构
所有抓取结果统一包含：
```javascript
{
  title,           // 原标题
  url,             // 文章/项目链接
  date,            // 发布日期
  description,     // 英文描述
  sourceCategory,   // 归属分区（open-source / vendor / frontier）
  tag,             // 标签文字
  tagClass,        // 标签样式类
  _sourceName,     // 来源名称（用于评分权重）
  techTags,        // 技术标签数组（最多3个：LLM、Agent、RAG、CodeGen、Multimodal 等）
  valueTag,        // 价值标签字符串（如「热门项目」「模型发布」「学术成果」）
  // GitHub 项目额外字段
  gh_stars,        // 今日 star 数
  gh_lang,         // 编程语言
  gh_starsLink,    // star 趋势链接
}
```

### 测试覆盖
- `tests/chunk2-sources.test.js`（9 个测试用例，覆盖分区配置、GitHub 提取、厂商来源规范化、enrich 特殊处理）
- `tests/tags.test.js`（8 个测试用例，覆盖 techTags/valueTag 字段、标签词汇表、渲染逻辑）
- `tests/scoring.test.js`（8 个测试用例，覆盖评分函数各维度、per-section bucketing）
- `tests/filtering.test.js`（8 个测试用例，覆盖各类过滤规则、pipeline 顺序）
- 所有 45 个测试用例通过

### 已完成（Chunk 3）
- **技术标签（techTags）**：12 类技术标签（LLM、Agent、RAG、CodeGen、Multimodal、Embedding、Finetuning、Inference、Safety、OpenSource、Robotics、Research），基于 `TECH_TAG_VOCABULARY` 关键词匹配推断，每篇文章最多显示 3 个标签
- **价值标签（valueTag）**：根据分区（开源/厂商/前沿）和内容关键词推断，包括「热门项目」「实用工具」「模型发布」「平台更新」「学术成果」「Agent 突破」「具身智能」等标签，带颜色样式渲染到卡片中
- **技术价值评分函数 `scoreArticle(article)`**：6 维评分体系——新鲜度（指数衰减，7 天半衰期）、来源可信度（`SOURCE_QUALITY_WEIGHTS`）、GitHub stars（对数加成）、描述质量（有意义长度加成）、技术标签加成、有图加成
- **质量过滤函数 `filterArticles(articles)`**：5 类规则——PR/Robot 生成内容过滤（`PR_PATTERNS`）、广告/newsletter 过滤（`AD_KEYWORDS`）、标题过短过滤（<15 字符）、描述过短过滤（<30 字符且无 gh_stars/image）、重复主题过滤（`titleSimilarity` 词重叠率 >0.6）
- **按分区评分分配 `assignArticlesToSections(articles)`**：替换 naive sequential slicing，按 `sourceCategory` 建立分区池 → 每池内按 `scoreArticle` 排序 → 每区取 top quota，取代原有的全局排序后按位置切片
- **卡片渲染增强**：技术标签（`.tech-tag` pill）和价值标签（`.value-tag` badge）渲染到 `generateArticleCard`，带颜色样式（`TECH_TAG_STYLES` / `VALUE_TAG_STYLES`）
- **CSS 增强**：`.tech-tag`、`.value-tag`、`.card-tech-tags` 样式规则

### 待完成（Chunk 3）
- 来源可用性监控与回退机制（更完善的来源失败处理）

## 6. 后续改进计划

下面按优先级划分。

### P0（建议尽快做）

#### 1）同步文档
更新以下内容，避免后续认知混乱：
- `README.md`
- 部署说明
- 自动更新时间说明
- 当前标题 / 摘要 / 图片策略说明

#### 2）验证 schedule 调整是否有效
接下来需要观察 2~3 天：
- 实际触发时间
- 页面更新时间
- 是否仍然漂移到 8 点之后

如果仍然明显晚于预期，需要进一步调整：
- 继续提前 cron
- 或换成外部定时触发

#### 3）清理临时调试文件
把一次性测试脚本整理掉，保持仓库干净。

---

### P1（下一阶段）

#### 4）抽象抓取与 enrich 流程
把当前 `scrape.js` 的职责拆开：
- `fetchSources()`
- `normalizeArticles()`
- `enrichArticles()`
- `renderHtml()`
- `contentPolicy()`

收益：
- 更好维护
- 更容易定位 bug
- 更容易扩展更多来源

#### 5）增强图片策略
当前已经能获取真实配图，但还可以继续优化：
- 优先 `og:image`
- 其次 `twitter:image`
- 再次正文首图
- 最后才用占位图

这样对更多来源会更稳。

#### 6）增加内容质量过滤
例如增加一些规则：
- 去掉过长或广告味很重的标题
- 去掉摘要中的奇怪转义字符
- 避免重复主题文章同时进入前 10
- 增加"优先展示当天新闻"的排序权重

---

### P2（中期优化）

#### 7）引入更明确的"精选"排序机制
目前更多是抓取 + 去重 + 排序的结果，后续可以增加更明确的精选逻辑：
- 新鲜度
- 来源质量
- Agent 相关性
- 是否有真实落地案例
- 是否是大厂 / 大模型 / 开发工具 / 多智能体关键更新

这样"10 篇精选"会更像真正的编辑精选，而不只是抓到的 10 条。

#### 8）增加回归测试
可补充测试：
- 标题保持原文
- 摘要不超过 100 字
- HTML 中优先使用真实图片
- 文章数量恒为 10
- schedule 配置符合预期

#### 9）加失败诊断信息
当 workflow 失败时，可以更明确输出：
- 哪个来源失败
- 是 axios 失败还是 curl 失败
- 图片提取失败还是正文提取失败
- 当前是否走了 fallback

这样定位问题更快。

---

## 6. 我的建议（推荐路线）

如果要把这个项目继续做得更稳，我建议按下面顺序推进：

### 第一阶段：稳定性收口
- 更新 README / 文档
- 连续观察几天定时触发时间
- 清理临时脚本
- 增加少量回归测试

### 第二阶段：结构化重构
- 拆分 `scrape.js`
- 明确标题 / 摘要 / 图片策略的配置层
- 提升可维护性

### 第三阶段：内容质量升级
- 做精选逻辑
- 优化排序
- 优化摘要质量
- 优化来源权重

---

## 7. 一句话总结

`ai-agent-weekly` 目前已经从"能跑的原型"进入到"可持续使用的自动资讯站点"阶段了：
- 核心链路已经打通
- 主要质量问题（标题污染、摘要污染、随机图片）已经被修到可接受水平
- 现在最值得做的，不再是继续堆功能，而是 **收口规则、清理技术债、提高稳定性和可维护性**。
