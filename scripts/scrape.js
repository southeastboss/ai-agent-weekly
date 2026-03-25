/**
 * AI Agent 前沿动态 — 新闻抓取脚本
 *
 * 功能：
 * 1. 从多个来源抓取 AI Agent 相关文章，按分区（开源项目 / 厂商动态 / 前沿技术）分别收集
 * 2. 渲染到 HTML 模板
 * 3. 输出到 index.html
 *
 * 使用：node scripts/scrape.js
 */

const axios = require('axios');
const cheerio = require('cheerio');
const Turndown = require('turndown');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ─── 配置 ───────────────────────────────────────────────────────────────

/**
 * 数据源按分区组织
 * 每个分区有独立配额和来源列表
 * 分区来源抓取的 article 会自动带上 sectionId，便于后续按区分配
 */
const CONFIG = {
  // 三分区内容配额
  sections: [
    { id: 'open-source', label: '开源项目', icon: '🛠️', quota: 3 },
    { id: 'vendor', label: '厂商动态', icon: '🏢', quota: 3 },
    { id: 'frontier', label: '前沿技术', icon: '🔬', quota: 3 },
  ],

  // ── 分区来源配置 ──────────────────────────────────────────────────
  // 每个来源声明 sectionId，表示该来源文章默认归属哪个分区
  // 注意：抓取时按来源分区收集，enrich 后再统一填入各区配额
  sources: {
    'open-source': [
      // GitHub Trending — AI/ML 相关项目
      {
        name: 'GitHub Trending AI',
        url: 'https://github.com/trending?since=daily&l=python',
        sectionId: 'open-source',
        tag: '开源项目',
        tagClass: 'tag-opensource',
        isGitHubTrending: true,
        trendingLang: 'python',
      },
      {
        name: 'GitHub Trending AI (JS)',
        url: 'https://github.com/trending?since=daily&l=javascript',
        sectionId: 'open-source',
        tag: '开源项目',
        tagClass: 'tag-opensource',
        isGitHubTrending: true,
        trendingLang: 'javascript',
      },
    ],

    'vendor': [
      // OpenAI 官方博客
      {
        name: 'OpenAI Blog',
        url: 'https://openai.com/blog/rss.xml',
        sectionId: 'vendor',
        tag: 'OpenAI',
        tagClass: 'tag-vendor',
        isRss: true,
      },
      // Anthropic 官方博客
      {
        name: 'Anthropic Blog',
        url: 'https://www.anthropic.com/blog/rss.xml',
        sectionId: 'vendor',
        tag: 'Anthropic',
        tagClass: 'tag-vendor',
        isRss: true,
      },
      // Google AI Blog
      {
        name: 'Google AI Blog',
        url: 'https://blog.google/technology/ai/rss/',
        sectionId: 'vendor',
        tag: 'Google',
        tagClass: 'tag-vendor',
        isRss: true,
      },
    ],

    'frontier': [
      // 分类页来源
      {
        name: 'AI and Us',
        url: 'https://www.artificialintelligence-news.com/categories/ai-and-us/',
        sectionId: 'frontier',
        tag: '多智能体',
        tagClass: 'tag-agent',
      },
      {
        name: 'AI in Action',
        url: 'https://www.artificialintelligence-news.com/categories/ai-in-action/',
        sectionId: 'frontier',
        tag: '自动化',
        tagClass: 'tag-automation',
      },
      {
        name: 'Inside AI',
        url: 'https://www.artificialintelligence-news.com/categories/inside-ai/',
        sectionId: 'frontier',
        tag: 'Agent',
        tagClass: 'tag-agent',
      },
      // RSS Feed 来源
      {
        name: 'TechCrunch AI',
        url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
        sectionId: 'frontier',
        tag: 'AI',
        tagClass: 'tag-agent',
        isRss: true,
      },
      {
        name: 'VentureBeat AI',
        url: 'https://venturebeat.com/category/ai/feed/',
        sectionId: 'frontier',
        tag: 'AI',
        tagClass: 'tag-agent',
        isRss: true,
      },
      {
        name: 'Hugging Face Blog',
        url: 'https://huggingface.co/blog/feed.xml',
        sectionId: 'frontier',
        tag: 'AI',
        tagClass: 'tag-agent',
        isRss: true,
      },
    ],
  },

  // 每页最多文章数（从所有来源收集更多，确保 RSS 新文章能进入排序）
  maxArticles: 9,

  // 输出路径
  outputFile: path.join(__dirname, '..', 'index.html'),
  templateFile: path.join(__dirname, '..', 'template.html')
};

// ─── Chunk 3: 技术标签词汇表 ─────────────────────────────────────────────
const TECH_TAG_VOCABULARY = {
  LLM: ['llm', 'language model', 'gpt', 'claude', 'gemini', 'chatgpt', 'gpt-4', 'gpt-5', 'openai', 'anthropic', 'large language model'],
  Agent: ['agent', 'multi-agent', 'multiagent', 'agentic', '代理', '智能体', 'multi-agent', 'agentic workflow'],
  RAG: ['rag', 'retrieval', 'retrieval-augmented', 'vector search', 'embedding'],
  CodeGen: ['code generation', 'coding', 'code assistant', 'copilot', 'codex', 'code gen', 'programming'],
  Multimodal: ['multimodal', 'vision', 'image generation', 'text-to-image', 'stable diffusion', 'video generation', 'audio'],
  Embedding: ['embedding', 'embeddings', 'vector database', 'pinecone', 'chroma', 'qdrant'],
  Finetuning: ['finetune', 'fine-tune', 'lora', 'rlhf', 'training', 'pre-training', 'domain adaptation'],
  Inference: ['inference', 'inference engine', 'ollama', 'llama.cpp', '量化', 'quantization', 'vllm', 'tensorrt'],
  Safety: ['safety', 'alignment', 'rlhf', 'constitutional ai', 'red teaming', 'jailbreak', 'safety evaluation'],
  OpenSource: ['open source', 'open-source', 'github', 'apache', 'mit license', 'public release', 'open weights'],
  Robotics: ['robot', 'robotics', '具身智能', 'embodied ai', 'autonomous', 'drone'],
  Research: ['paper', 'arxiv', 'research', 'study', 'benchmark', 'evaluation', '学术', '研究'],
};

// ─── Chunk 3: 价值标签配置 ──────────────────────────────────────────────
const VALUE_TAG_CONFIG = {
  'open-source': '开源项目',
  'vendor': '商业动态',
  'frontier': '前沿探索',
};

// ─── Chunk 3: 来源可信度权重 ─────────────────────────────────────────────
const SOURCE_QUALITY_WEIGHTS = {
  // 开源分区
  'GitHub Trending AI': 1.2,
  'GitHub Trending AI (JS)': 1.1,
  // 厂商分区（官方来源权重更高）
  'Anthropic Blog': 1.5,
  'OpenAI Blog': 1.5,
  'Google AI Blog': 1.3,
  // 前沿技术分区
  'Hugging Face Blog': 1.4,
  'VentureBeat AI': 1.1,
  'TechCrunch AI': 1.0,
  'AI and Us': 1.0,
  'AI in Action': 1.0,
  'Inside AI': 1.0,
};

// ─── Chunk 3: 根据内容关键词推断技术标签 ──────────────────────────────────
function inferTechTags(article) {
  const text = `${article.title} ${article.description}`.toLowerCase();
  const tags = [];
  for (const [tag, keywords] of Object.entries(TECH_TAG_VOCABULARY)) {
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) {
        tags.push(tag);
        break;
      }
    }
  }
  return tags.slice(0, 3); // 最多3个技术标签
}

// ─── Chunk 3: 推断价值标签 ────────────────────────────────────────────────
function inferValueTag(article, sectionId) {
  // 根据分区和内容综合判断价值标签
  const text = `${article.title} ${article.description}`.toLowerCase();

  if (sectionId === 'open-source') {
    if (text.includes('github') && article.gh_stars && parseInt(article.gh_stars.replace(/[,+]/g, '')) > 100) return '热门项目';
    if (text.includes('framework') || text.includes('library') || text.includes('tool')) return '实用工具';
    return '开源项目';
  }
  if (sectionId === 'vendor') {
    if (text.includes('model') || text.includes('gpt') || text.includes('claude') || text.includes('gemini')) return '模型发布';
    if (text.includes('api') || text.includes('sdk') || text.includes('platform')) return '平台更新';
    return '商业动态';
  }
  if (sectionId === 'frontier') {
    if (text.includes('paper') || text.includes('arxiv') || text.includes('research')) return '学术成果';
    if (text.includes('agent') || text.includes('multi')) return 'Agent 突破';
    if (text.includes('robot') || text.includes('embodied')) return '具身智能';
    return '前沿探索';
  }
  return VALUE_TAG_CONFIG[sectionId] || '技术动态';
}

// ─── Chunk 3: 技术价值评分函数 ───────────────────────────────────────────
function scoreArticle(article) {
  let score = 0;

  // 1. 新鲜度评分（指数衰减，7天半衰期）
  if (article.date) {
    const daysAgo = (Date.now() - new Date(article.date).getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.pow(0.9, daysAgo / 7);
    score += recencyScore * 30;
  } else {
    score -= 10; // 没有日期的文章扣分
  }

  // 2. 来源可信度评分
  const sourceWeight = SOURCE_QUALITY_WEIGHTS[article._sourceName] || 1.0;
  score += sourceWeight * 20;

  // 3. GitHub stars 评分（仅开源分区）
  if (article.gh_stars) {
    const stars = parseInt(article.gh_stars.replace(/[,+]/g, '')) || 0;
    const starScore = Math.log10(stars + 1) * 10;
    score += starScore;
  }

  // 4. 描述质量评分（有意义的长度）
  const descLen = (article.description || '').length;
  if (descLen >= 50) {
    score += Math.min(descLen / 10, 15);
  } else if (descLen < 20) {
    score -= 10;
  }

  // 5. 技术标签评分（有技术标签的文章更有价值）
  if (article.techTags && article.techTags.length > 0) {
    score += article.techTags.length * 3;
  }

  // 6. 有图片加一点分
  if (article.image) {
    score += 2;
  }

  return score;
}

// ─── Chunk 3: 质量过滤函数 ───────────────────────────────────────────────
const AD_KEYWORDS = ['newsletter', 'sponsored', 'advertisement', 'advert', 'newsletter', 'subscribe to', 'email course'];
const PR_PATTERNS = [/^pr[:\s]/i, /^\[pr\]/i, /robot[\s-]?generated/i, /automated[\s-]?post/i, /爬虫/i, /^auto[\s-]?post/i];
const LOW_QUALITY_PATTERNS = [/^click here/i, /^read more/i, /^learn more/i, /^\s*$/];

// challenge / WAF / 反爬拦截页面标题特征（命中这些说明拿到的不是真实文章页）
const CHALLENGE_TITLE_PATTERNS = [
  /just a moment/i,
  /checking your browser/i,
  /access denied/i,
  /403 forbidden/i,
  /cloudflare/i,
  /attention required/i,
  /security check/i,
];

function isLowQuality(article) {
  const title = article.title || '';
  const desc = article.description || '';

  // 1. PR / Robot 生成内容
  for (const pattern of PR_PATTERNS) {
    if (pattern.test(title)) return true;
  }

  // 2. 广告 / newsletter
  for (const kw of AD_KEYWORDS) {
    if (title.toLowerCase().includes(kw) || desc.toLowerCase().includes(kw)) return true;
  }

  // 3. 标题过短
  if (title.trim().length < 15) return true;

  // 4. 描述过短（低于30字符且无有效信息）
  if (desc.trim().length < 30 && !article.gh_stars && !article.image) return true;

  // 5. 纯 placeholder 内容
  for (const pattern of LOW_QUALITY_PATTERNS) {
    if (pattern.test(title.trim())) return true;
  }

  return false;
}

// 计算两个标题的相似度（简单词重叠）
function titleSimilarity(a, b) {
  const wordsA = new Set((a || '').toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set((b || '').toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

/**
 * 过滤低质量/重复主题内容
 */
function filterArticles(articles) {
  const seen = [];
  return articles.filter(article => {
    // 1. 低质量过滤
    if (isLowQuality(article)) {
      console.log(`   🚫 过滤低质量: ${article.title.substring(0, 50)}`);
      return false;
    }

    // 2. 重复主题过滤（标题相似度 > 0.6 视为重复）
    for (const existing of seen) {
      if (titleSimilarity(existing.title, article.title) > 0.6) {
        console.log(`   🔁 过滤重复: "${article.title.substring(0, 40)}" ~ "${existing.title.substring(0, 40)}"`);
        return false;
      }
    }

    seen.push(article);
    return true;
  });
}

// ─── Chunk 3: 按分区分配文章（替换 naive sequential slicing）───────────────
function assignArticlesToSections(articles) {
  // 按 sourceCategory 建立分区池
  const sectionPools = {};
  for (const section of CONFIG.sections) {
    sectionPools[section.id] = [];
  }

  // 分配文章到对应分区池
  for (const article of articles) {
    const sectionId = article.sourceCategory || 'frontier';
    if (sectionPools[sectionId]) {
      sectionPools[sectionId].push(article);
    } else {
      sectionPools['frontier'].push(article);
    }
  }

  // 每个分区内部按评分排序
  for (const sectionId of Object.keys(sectionPools)) {
    sectionPools[sectionId].sort((a, b) => scoreArticle(b) - scoreArticle(a));
  }

  // 从每个分区取 top quota 条
  const result = [];
  for (const section of CONFIG.sections) {
    const pool = sectionPools[section.id] || [];
    const selected = pool.slice(0, section.quota);
    console.log(`   📊 分区 "${section.id}" 得分前${selected.length}条（共${pool.length}条候选）`);
    result.push(...selected);
  }

  return result;
}

const turndown = new Turndown({
  headingStyle: 'atx',
  bulletListMarker: '-'
});

/**
 * 通过 curl 抓取页面（作为 axios 403 时的回退）
 */
function fetchPageWithCurl(url) {
  const curlBin = process.platform === 'win32' ? 'curl.exe' : 'curl';
  const args = [
    '-L',
    '-A',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    '--max-time',
    '30',
    url,
  ];

  const html = execFileSync(curlBin, args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  return cheerio.load(html);
}

/**
 * 抓取原始文本（不经过 cheerio，用于 RSS XML）
 */
function fetchRawWithCurl(url) {
  const curlBin = process.platform === 'win32' ? 'curl.exe' : 'curl';
  const args = [
    '-L',
    '-A',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    '--max-time',
    '30',
    '--silent',
    url,
  ];

  return execFileSync(curlBin, args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
}

/**
 * 抓取单个页面（返回 cheerio 对象）
 */
async function fetchPage(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 30000
    });
    return cheerio.load(response.data);
  } catch (error) {
    console.warn(`⚠️ axios 请求失败，尝试 curl 回退: ${url}`);
    console.warn(`   axios 错误: ${error.message}`);
    try {
      return fetchPageWithCurl(url);
    } catch (curlError) {
      console.error(`❌ curl 回退也失败: ${url}`);
      console.error(`   curl 错误: ${curlError.message}`);
      return null;
    }
  }
}

/**
 * 从 RSS Feed 提取文章数据（使用正则解析，不依赖 XML 库）
 */
function extractRssArticles(rssText, source) {
  const articles = [];
  // 匹配 <item>...</item> 或 <entry>...</entry>
  const itemRegex = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi;
  let match;

  while ((match = itemRegex.exec(rssText)) !== null && articles.length < CONFIG.maxArticles) {
    const itemXml = match[1];

    // 提取 title
    const titleMatch = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(itemXml);
    const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/\s*\|\s*TechCrunch\s*$/i, '').trim() : '';

    // 提取 link
    const linkMatch = /<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i.exec(itemXml);
    let link = linkMatch ? linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
    // link 可能在 <link href="..."> 格式中
    if (!link) {
      const hrefMatch = /<link[^>]+href=["']([^"']+)["'][^>]*>/i.exec(itemXml);
      link = hrefMatch ? hrefMatch[1].trim() : '';
    }

    // 提取发布日期
    const dateMatch = /<(?:pubDate|published|updated|dc:date)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:pubDate|published|updated|dc:date)>/i.exec(itemXml);
    let date = '';
    if (dateMatch) {
      const parsed = new Date(dateMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim());
      if (!isNaN(parsed)) date = parsed.toISOString().substring(0, 10);
    }

    // 提取描述
    const descMatch = /<(?:description|summary|content)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content)>/i.exec(itemXml);
    const description = descMatch
      ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim().substring(0, 200)
      : '';

    if (title && link) {
      articles.push({ title, url: link, date, description, sourceCategory: source.sectionId, tag: source.tag, tagClass: source.tagClass, _sourceName: source.name });
    }
  }

  return articles;
}

/**
 * 从 GitHub Trending 页面提取项目
 */
function extractGitHubTrendingArticles($, source) {
  const articles = [];
  const seen = new Set();

  // GitHub Trending 结构: .BXgItc .Box-row
  $('article.Box-row').each((index, element) => {
    if (articles.length >= CONFIG.maxArticles) return false;

    const $el = $(element);

    // 项目名: <a href="/user/repo">repo</a> 或 <a href="/org/repo">repo</a>
    const repoLink = $el.find('h2 a').first();
    let repoName = repoLink.text().trim().replace(/\s+/g, '');
    const href = repoLink.attr('href') || '';
    const fullName = href.replace(/^\//, ''); // e.g. "user/repo"

    // 描述
    const desc = $el.find('p').first().text().trim().substring(0, 200);

    // 编程语言
    const lang = $el.find('[itemprop="programmingLanguage"]').text().trim() ||
                 $el.find('span.text-bold').text().trim() || '';

    // 今日星标数
    const starsText = $el.find('a.Link--muted').first().text().trim();
    const stars = starsText ? starsText.replace(/,/g, '') : '';

    // 今日 star 数的链接
    const starLink = $el.find('a.Link--muted').first().attr('href') || '';

    if (fullName && !seen.has(fullName)) {
      seen.add(fullName);
      articles.push({
        title: fullName,
        url: `https://github.com/${fullName}`,
        date: new Date().toISOString().substring(0, 10),
        description: desc,
        sourceCategory: source.sectionId,
        tag: source.tag,
        tagClass: source.tagClass,
        _sourceName: source.name,
        // GitHub 特有字段
        gh_stars: stars,
        gh_lang: lang,
        gh_starsLink: starLink ? `https://github.com${starLink}` : '',
        gh_description: desc,
      });
    }
  });

  return articles;
}

/**
 * 从页面提取文章数据
 */
function extractArticles($, source, rssText) {
  // 如果是 RSS 来源
  if (source.isRss) {
    return extractRssArticles(rssText || $.html(), source);
  }

  // 如果是 GitHub Trending
  if (source.isGitHubTrending) {
    return extractGitHubTrendingArticles($, source);
  }
  const articles = [];
  const seen = new Set();

  // 先尝试传统列表结构
  const selectors = [
    'article.post',
    'div.post-item',
    'div.article-item',
    '.posts-list article',
    'main article',
    'div.lcp_catlist li',
    'article'
  ];

  let items = [];
  for (const selector of selectors) {
    items = $(selector);
    if (items.length > 0) {
      console.log(`   ✅ 选择器 "${selector}" 找到 ${items.length} 篇文章`);
      break;
    }
  }

  items.slice(0, CONFIG.maxArticles).each((index, element) => {
    const article = {};
    const titleEl = $('h2 a, h3 a, .entry-title a, a.post-title', element).first();
    article.title = titleEl.text().trim().replace(/\s*\|\s*TechCrunch\s*$/i, '');
    article.url = titleEl.attr('href') || '';
    const dateEl = $('time, .date, .published, .post-date', element).first();
    article.date = dateEl.text().trim().substring(0, 10) || '';
    const descEl = $('p:not(:empty)', element).first();
    article.description = descEl.text().trim().substring(0, 200);
    article.sourceCategory = source.sectionId;
    article.tag = source.tag;
    article.tagClass = source.tagClass;

    if (article.title && article.url && !seen.has(article.url)) {
      seen.add(article.url);
      articles.push(article);
    }
  });

  // 回退：页面不是传统 archive 卡片，而是直接包含多篇文章链接
  if (articles.length === 0) {
    console.log('   ↩️ 未命中列表结构，回退到链接抽取模式');
    $('a[href*="/news/"]').each((index, el) => {
      const href = $(el).attr('href') || '';
      const title = $(el).text().trim().replace(/\s+/g, ' ');

      if (!href) return;
      if (seen.has(href)) return;
      if (href.includes('/news/videos')) return;
      if (!title) return;
      if (title.length < 12) return;

      seen.add(href);
      articles.push({
        title,
        url: href,
        date: '',
        description: '',
        sourceCategory: source.sectionId,
        tag: source.tag,
        tagClass: source.tagClass,
        _sourceName: source.name,
      });
    });
  }

  return articles.slice(0, CONFIG.maxArticles);
}

/**
 * 抓取所有来源
 */
/**
 * 使用 MiniMax AI 生成中文摘要（100-200 字）
 * 中国区使用 api.minimaxi.com 接口
 */
async function generateSummary(article) {
  if (!article.title || !article.description) return article;

  const text = `${article.title}。${article.description}`.substring(0, 500);
  const scriptPath = path.join(__dirname, 'minimax_summary.py');

  try {
    const pythonExe = process.env.PYTHON_BIN || 'python';
    const output = execFileSync(pythonExe, [scriptPath, text], {
      env: { ...process.env },
      timeout: 180000,
      encoding: 'utf-8',
    });

    const summary = output.trim().substring(0, 200);
    if (summary) return { ...article, summary };
  } catch (err) {
    console.warn(`   ⚠️ AI 摘要生成失败，使用截断摘要: ${err.message}`);
  }

  // Fallback：纯截断
  const cleaned = (article.description || '').replace(/\s+/g, ' ').trim();
  const summary = cleaned ? cleaned.substring(0, 200).trim() : '';
  return summary ? { ...article, summary } : article;
}

async function finalizeArticlesForDisplay(articles, summarizer = generateSummary) {
  const sorted = [...articles].sort((a, b) => {
    const dateA = new Date(a.date || '1970-01-01');
    const dateB = new Date(b.date || '1970-01-01');
    return dateB - dateA;
  });

  const filtered = filterArticles(sorted);
  console.log(`\n🧹 质量过滤后剩余 ${filtered.length} 篇`);

  for (const article of filtered) {
    article.techTags = inferTechTags(article);
    article.valueTag = inferValueTag(article, article.sourceCategory);
  }

  const sectionedArticles = assignArticlesToSections(filtered);
  const displayedArticles = sectionedArticles.slice(0, CONFIG.maxArticles);

  console.log(`\n🤖 仅为最终展示的 ${displayedArticles.length} 篇文章生成 AI 摘要...`);
  const summarizedArticles = [];
  for (const article of displayedArticles) {
    summarizedArticles.push(await summarizer(article));
  }

  return summarizedArticles;
}

// 翻译功能已移除
async function enrichArticle(article) {
  const rawTitle = (article.title || '').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
  const rawDesc = (article.description || '').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();

  // GitHub 项目页面的 enrich 特殊处理
  if (article.url && article.url.includes('github.com') && !article.url.includes('/issues/') && !article.url.includes('/pull/')) {
    try {
      const $ = await fetchPage(article.url);
      if ($) {
        const metaTitle = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
        const metaDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
        const metaImage = $('meta[property="og:image"]').attr('content') || '';

        // GitHub 项目描述
        const ghDesc = $('[itemprop="description"]').text().trim() ||
                       $('p.exact_issues_results').text().trim() ||
                       metaDesc;

        const title = (metaTitle || rawTitle).replace(/&#039;/g, "'").replace(/\s+/g, ' ').replace(/\s*\|\s*GitHub\s*$/i, '').trim();
        const desc = (ghDesc || rawDesc).replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();

        return {
          ...article,
          title,
          description: desc,
          image: metaImage || article.image,
        };
      }
    } catch (error) {
      // 页面抓取失败不影响
    }

    return {
      ...article,
      description: rawDesc,
    };
  }

  try {
    const $ = await fetchPage(article.url);
    if ($) {
      const metaTitle = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
      const metaDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
      const metaDate = $('meta[property="article:published_time"]').attr('content') || '';
      const metaImage = $('meta[property="og:image"]').attr('content') || '';

      const isChallenge = CHALLENGE_TITLE_PATTERNS.some(p => p.test(metaTitle));

      if (isChallenge) {
        console.warn(`   ⚠️ 检测到拦截页，保留原始标题: ${article.url}`);
        return {
          ...article,
          title: rawTitle,
          description: rawDesc,
        };
      }

      const title = (metaTitle || rawTitle).replace(/&#039;/g, "'").replace(/\s+/g, ' ').replace(/\s*\|\s*TechCrunch\s*$/i, '').trim();
      const desc = (metaDesc || rawDesc).replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();

      return {
        ...article,
        title,
        description: desc,
        date: metaDate ? metaDate.substring(0, 10) : article.date,
        image: metaImage || article.image,
      };
    }
  } catch (error) {
    // 页面抓取失败不影响翻译
  }

  return {
    ...article,
    title: rawTitle,
    description: rawDesc,
  };
}

/**
 * 扁平化所有分区来源为一个统一数组，同时保留 sectionId
 */
function getAllSources() {
  const allSources = [];
  for (const sectionId of Object.keys(CONFIG.sources)) {
    for (const source of CONFIG.sources[sectionId]) {
      allSources.push(source);
    }
  }
  return allSources;
}

async function scrapeAllSources() {
  const allArticles = [];
  const seen = new Set();
  const pendingEnrichments = [];
  const allSources = getAllSources();

  for (const source of allSources) {
    console.log(`\n📡 正在抓取: ${source.name} [${source.sectionId}]`);

    let articles = [];
    if (source.isRss) {
      // RSS 源头直接拿原始文本，用正则解析
      try {
        const rawText = fetchRawWithCurl(source.url);
        articles = extractArticles(null, source, rawText);
        console.log(`   📰 RSS 抽取到 ${articles.length} 篇`);
      } catch (err) {
        console.warn(`   ⚠️ RSS 抓取失败: ${source.url} — ${err.message}`);
      }
    } else if (source.isGitHubTrending) {
      // GitHub Trending 页面
      const $ = await fetchPage(source.url);
      if ($) {
        articles = extractArticles($, source);
        console.log(`   📰 GitHub Trending 抽取到 ${articles.length} 个项目`);
      }
    } else {
      const $ = await fetchPage(source.url);
      if ($) {
        articles = extractArticles($, source);
        console.log(`   📰 分类页抽取到 ${articles.length} 篇文章`);
      }
    }

    for (const article of articles) {
      if (seen.has(article.url)) continue;
      seen.add(article.url);
      pendingEnrichments.push(enrichArticle(article));
    }
  }

  // 等待所有文章详情加载完成
  if (pendingEnrichments.length > 0) {
    console.log(`\n🔄 并发补全 ${pendingEnrichments.length} 篇文章详情...`);
    const results = await Promise.all(pendingEnrichments);
    allArticles.push(...results);
  }

  return finalizeArticlesForDisplay(allArticles);
}

/**
 * 生成文章卡片 HTML
 */
function generateArticleCard(article, isFeatured = false) {
  // 无图片时使用 AI 主题背景图（按分区选用不同的 neural-network / AI 视觉图）
  const sectionFallbacks = {
    'open-source': 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800&h=400&fit=crop&q=80',
    'vendor':      null, // vendor 分区 fallback 由下方逻辑处理：尝试用文章 URL 的 favicon
    'frontier':    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&h=400&fit=crop&q=80',
  };

  let imageUrl = article.image;

  if (!imageUrl) {
    if (article.sourceCategory === 'vendor' && article.url) {
      // 尝试从文章 URL 提取域名，用 Google Favicon API 获取对应厂商的图标
      try {
        const urlObj = new URL(article.url);
        imageUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=512`;
      } catch (_) {
        // URL 解析失败，忽略
      }
    }
    // 如果 vendor 分区没有拿到 favicon，或者是非 vendor 分区，使用 section fallback
    if (!imageUrl) {
      imageUrl = sectionFallbacks[article.sourceCategory] || 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=400&fit=crop&q=80';
    }
  }

  const tagMap = {
    'tag-agent': { bg: 'linear-gradient(135deg, #6366f1, #8b5cf6)', label: article.tag || 'Agent' },
    'tag-automation': { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', label: '自动化' },
    'tag-physical': { bg: 'linear-gradient(135deg, #10b981, #059669)', label: '具身智能' },
    'tag-research': { bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', label: '研究' },
    'tag-finance': { bg: 'linear-gradient(135deg, #ec4899, #db2777)', label: '金融' },
    'tag-vendor': { bg: 'linear-gradient(135deg, #8b5cf6, #c026d3)', label: article.tag || '厂商' },
    'tag-opensource': { bg: 'linear-gradient(135deg, #10b981, #059669)', label: '开源' },
  };
  const tagInfo = tagMap[article.tagClass] || { bg: 'linear-gradient(135deg, #6366f1, #764ba2)', label: article.tag || 'AI' };

  // ── Chunk 3: 技术标签渲染 ────────────────────────────────────────
  const TECH_TAG_STYLES = {
    LLM: { bg: '#e0e7ff', color: '#4338ca' },
    Agent: { bg: '#ede9fe', color: '#7c3aed' },
    RAG: { bg: '#dcfce7', color: '#15803d' },
    CodeGen: { bg: '#fef3c7', color: '#b45309' },
    Multimodal: { bg: '#fce7f3', color: '#be185d' },
    Embedding: { bg: '#e0f2fe', color: '#0369a1' },
    Finetuning: { bg: '#fee2e2', color: '#b91c1c' },
    Inference: { bg: '#f1f5f9', color: '#475569' },
    Safety: { bg: '#fef9c3', color: '#854d0e' },
    OpenSource: { bg: '#d1fae5', color: '#065f46' },
    Robotics: { bg: '#ccfbf1', color: '#0f766e' },
    Research: { bg: '#dbEafe', color: '#1d4ed8' },
  };
  const techTagsHTML = (article.techTags && article.techTags.length > 0)
    ? article.techTags.map(tag => {
        const style = TECH_TAG_STYLES[tag] || { bg: '#f3f4f6', color: '#374151' };
        return `<span class="tech-tag" style="background:${style.bg};color:${style.color}">${tag}</span>`;
      }).join('')
    : '';

  // ── Chunk 3: 价值标签渲染 ────────────────────────────────────────
  const VALUE_TAG_STYLES = {
    '热门项目': { bg: '#fef3c7', color: '#92400e' },
    '实用工具': { bg: '#d1fae5', color: '#065f46' },
    '商业动态': { bg: '#ede9fe', color: '#6d28d9' },
    '模型发布': { bg: '#dbeafe', color: '#1e40af' },
    '平台更新': { bg: '#fce7f3', color: '#9d174d' },
    '学术成果': { bg: '#e0e7ff', color: '#3730a3' },
    'Agent 突破': { bg: '#fef9c3', color: '#78350f' },
    '具身智能': { bg: '#ccfbf1', color: '#115e59' },
    '前沿探索': { bg: '#f1f5f9', color: '#334155' },
    '开源项目': { bg: '#d1fae5', color: '#064e3b' },
    '技术动态': { bg: '#f3f4f6', color: '#374151' },
  };
  const valueStyle = VALUE_TAG_STYLES[article.valueTag] || { bg: '#f3f4f6', color: '#374151' };
  const valueTagHTML = article.valueTag
    ? `<span class="value-tag" style="background:${valueStyle.bg};color:${valueStyle.color}">${article.valueTag}</span>`
    : '';

  // GitHub 项目特殊描述增强
  let extraMeta = '';
  if (article.gh_stars) {
    extraMeta += `<span class="gh-stars">⭐ ${article.gh_stars}</span>`;
  }
  if (article.gh_lang) {
    extraMeta += `<span class="gh-lang">• ${article.gh_lang}</span>`;
  }

  if (isFeatured) {
    return `
    <div class="featured-card" data-category="${article.sourceCategory}">
      <div class="card-thumb">
        <img src="${imageUrl}" alt="${article.title}" loading="lazy">
        <div class="overlay" style="position:absolute;inset:0;background:linear-gradient(to right,rgba(0,0,0,0.3),transparent)"></div>
      </div>
      <div class="card-content">
        <div class="featured-label">⭐ 重点关注</div>
        <h2 class="card-title">
          <a href="${article.url}" target="_blank">${article.title}</a>
        </h2>
        ${article.summary ? `<p class="card-summary">${article.summary}</p>` : `<p class="card-desc">${article.description}</p>`}
        <div class="card-footer">
          <span class="card-date">${article.date}</span>
          <a href="${article.url}" target="_blank" class="read-btn">阅读原文 →</a>
        </div>
      </div>
    </div>`;
  }

  return `
    <div class="article-card" data-category="${article.sourceCategory}">
      <div class="card-thumb">
        <img src="${imageUrl}" alt="${article.title}" loading="lazy">
      </div>
      <div class="card-content">
        <span class="card-tag" style="background:${tagInfo.bg}">${tagInfo.label}</span>
        ${valueTagHTML ? `<span class="value-tag" style="background:${valueStyle.bg};color:${valueStyle.color};margin-left:0.3rem">${article.valueTag}</span>` : ''}
        <h3 class="card-title">
          <a href="${article.url}" target="_blank">${article.title}</a>
        </h3>
        ${article.summary ? `<p class="card-summary">${article.summary}</p>` : `<p class="card-desc">${article.description}</p>`}
        ${techTagsHTML ? `<div class="card-tech-tags">${techTagsHTML}</div>` : ''}
        <div class="card-meta">
          ${extraMeta ? `<div class="card-extra-meta">${extraMeta}</div>` : '<div></div>'}
          <span class="card-date">${article.date}</span>
        </div>
      </div>
    </div>`;
}

/**
 * 统一生成北京时间戳，避免受运行机器时区影响
 */
function formatBeijingTimestamp(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));

  return {
    updateDate: `${map.year}.${map.month}.${map.day}`,
    updateTime: `${map.hour}:${map.minute}`,
  };
}

/**
 * 生成 HTML 页面
 */
function generateHTML(articles) {
  const { updateDate, updateTime } = formatBeijingTimestamp();

  // 将文章分配到三个分区（每区配额 3 条）
  const sectionsHTML = CONFIG.sections.map((section, sIdx) => {
    const start = sIdx * section.quota;
    const slice = articles.slice(start, start + section.quota);
    const cardsHTML = slice.map(a => generateArticleCard(a)).join('\n');
    return `
    <section class="section-block" data-section="${section.id}">
      <h2 class="section-title">
        <span class="section-icon">${section.icon}</span>
        ${section.label}
        <span class="section-count">${slice.length}</span>
      </h2>
      <div class="article-list">
        ${cardsHTML}
      </div>
    </section>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Agent 前沿动态 | ${updateDate}</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #6366f1;
            --bg: #f8fafc;
            --bg-secondary: #ffffff;
            --card-bg: #ffffff;
            --text: #1e293b;
            --text-muted: #64748b;
            --border: #e2e8f0;
            --shadow: 0 4px 24px rgba(0,0,0,0.06);
            --shadow-hover: 0 8px 32px rgba(0,0,0,0.12);
            --gradient-1: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            --nav-bg: rgba(255,255,255,0.92);
        }
        [data-theme="dark"] {
            --bg: #0f172a;
            --bg-secondary: #1e293b;
            --card-bg: #1e293b;
            --text: #e2e8f0;
            --text-muted: #94a3b8;
            --border: rgba(255,255,255,0.08);
            --shadow: 0 4px 24px rgba(0,0,0,0.3);
            --shadow-hover: 0 8px 32px rgba(0,0,0,0.4);
            --nav-bg: rgba(15,23,42,0.92);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Noto Sans SC', -apple-system, sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.7;
            min-height: 100vh;
            transition: background 0.4s ease, color 0.4s ease;
        }
        nav {
            position: fixed; top: 0; left: 0; right: 0;
            background: var(--nav-bg);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--border);
            z-index: 1000; padding: 0 2rem;
            transition: background 0.4s ease, border-color 0.4s ease;
        }
        nav .nav-inner {
            max-width: 1200px; margin: 0 auto;
            display: flex; align-items: center; justify-content: space-between;
            height: 64px; overflow: visible;
        }
        nav .logo {
            font-size: 1.3rem; font-weight: 700;
            background: var(--gradient-1);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            background-clip: text;
            display: flex; align-items: center; gap: 0.5rem;
            white-space: nowrap; flex-shrink: 0;
        }
        nav .logo-icon {
            width: 32px; height: 32px;
            background: var(--gradient-1); border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
            font-size: 1rem;
            -webkit-background-clip: unset; -webkit-text-fill-color: white;
        }
        .theme-toggle {
            display: flex; align-items: center; gap: 0.5rem;
            padding: 0.4rem; background: var(--bg-secondary);
            border: 1px solid var(--border); border-radius: 50px;
            cursor: pointer; transition: all 0.3s ease;
        }
        .theme-toggle:hover { border-color: var(--primary); transform: scale(1.05); }
        .theme-toggle .sun, .theme-toggle .moon {
            width: 32px; height: 32px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 1rem; transition: all 0.3s ease;
        }
        .theme-toggle .sun { background: var(--primary); color: white; }
        .theme-toggle .moon { background: var(--bg); color: var(--text-muted); }
        [data-theme="dark"] .theme-toggle .sun { background: var(--bg); color: var(--text-muted); }
        [data-theme="dark"] .theme-toggle .moon { background: var(--primary); color: white; }
        .hero { padding: 130px 2rem 50px; text-align: center; }
        .hero-inner { max-width: 720px; margin: 0 auto; }
        .hero .pill {
            display: inline-flex; align-items: center; gap: 0.5rem;
            background: var(--bg-secondary); border: 1px solid var(--border);
            padding: 0.4rem 1rem; border-radius: 50px;
            font-size: 0.8rem; color: var(--primary); font-weight: 600;
            margin-bottom: 1.5rem;
            transition: background 0.4s ease, border-color 0.4s ease;
        }
        .hero h1 {
            font-size: 2.8rem; font-weight: 700; margin-bottom: 1rem;
            background: var(--gradient-1);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            background-clip: text; line-height: 1.3; padding-bottom: 0.1em;
        }
        .hero p { font-size: 1.05rem; color: var(--text-muted); max-width: 500px; margin: 0 auto; }
        .hero-stats {
            display: flex; justify-content: center; gap: 3rem;
            margin-top: 2.5rem; padding-top: 2rem;
            border-top: 1px solid var(--border);
            transition: border-color 0.4s ease;
        }
        .hero-stats .stat-item { text-align: center; }
        .hero-stats .stat-num {
            font-size: 1.8rem; font-weight: 700;
            background: var(--gradient-1);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .hero-stats .stat-label { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem; }
        .update-time {
            display: flex; justify-content: center; margin-top: 1rem;
        }
        .update-time span {
            font-size: 0.8rem; color: var(--text-muted);
            background: var(--bg-secondary); border: 1px solid var(--border);
            padding: 0.3rem 0.8rem; border-radius: 50px;
        }
        .categories {
            display: flex; justify-content: center; gap: 0.6rem;
            flex-wrap: wrap; padding: 0 2rem 2.5rem;
            max-width: 1200px; margin: 0 auto;
        }
        .category-btn {
            display: flex; align-items: center; gap: 0.4rem;
            padding: 0.5rem 1.1rem; border-radius: 50px;
            border: 1.5px solid var(--border); background: var(--bg-secondary);
            color: var(--text-muted); cursor: pointer; font-size: 0.88rem;
            font-family: inherit; font-weight: 500; transition: all 0.25s ease;
            box-shadow: 0 2px 8px var(--shadow);
        }
        .category-btn:hover { border-color: var(--primary); color: var(--primary); transform: translateY(-2px); }
        .category-btn.active { background: var(--primary); border-color: var(--primary); color: white; box-shadow: 0 4px 20px rgba(99,102,241,0.4); transform: translateY(-2px); }
        .category-btn .count {
            display: inline-flex; align-items: center; justify-content: center;
            min-width: 20px; height: 20px; padding: 0 0.35rem;
            background: rgba(255,255,255,0.2); border-radius: 50px;
            font-size: 0.72rem; font-weight: 600;
        }
        main { max-width: 1200px; margin: 0 auto; padding: 0 2rem 4rem; }
        .article-list { display: flex; flex-direction: column; gap: 1.25rem; }
        .article-card {
            background: var(--card-bg); border: 1px solid var(--border);
            border-radius: 16px; overflow: hidden; display: flex;
            transition: transform 0.3s ease, box-shadow 0.3s ease,
                        background 0.4s ease, border-color 0.4s ease;
            cursor: pointer;
        }
        .article-card:hover { transform: translateX(4px); box-shadow: var(--shadow-hover); }
        .article-card.hidden { display: none; }
        .article-card .card-thumb {
            width: 220px; min-height: 180px; position: relative;
            overflow: hidden; flex-shrink: 0;
        }
        .article-card .card-thumb img {
            width: 100%; height: 100%; object-fit: cover;
            transition: transform 0.5s ease;
        }
        /* vendor 分区使用 Google Favicon 图标作为 fallback 时，保持原始尺寸居中显示 */
        .article-card[data-category="vendor"] .card-thumb img {
            object-fit: contain;
            background: #f8fafc;
        }
        .article-card:hover .card-thumb img { transform: scale(1.06); }
        .article-card .card-content {
            padding: 1.4rem 1.6rem;
            display: flex; flex-direction: column; justify-content: center; flex: 1;
        }
        .article-card .card-tag {
            display: inline-block; padding: 0.25rem 0.7rem; border-radius: 50px;
            font-size: 0.7rem; font-weight: 600;
            letter-spacing: 0.3px; color: white;
            margin-bottom: 0.75rem; width: fit-content;
        }
        .article-card .tech-tag {
            display: inline-block; padding: 0.15rem 0.5rem; border-radius: 50px;
            font-size: 0.65rem; font-weight: 600;
            letter-spacing: 0.2px; margin-right: 0.25rem;
        }
        .article-card .value-tag {
            display: inline-block; padding: 0.15rem 0.5rem; border-radius: 50px;
            font-size: 0.65rem; font-weight: 600;
            letter-spacing: 0.2px;
        }
        .article-card .card-tech-tags {
            display: flex; flex-wrap: wrap; gap: 0.25rem;
            margin-top: 0.4rem; margin-bottom: 0.2rem;
        }
        .article-card .card-title {
            font-size: 1.1rem; font-weight: 600;
            margin-bottom: 0.6rem; line-height: 1.45;
            color: var(--text); transition: color 0.4s ease;
        }
        .article-card:hover .card-title { color: var(--primary); }
        .article-card .card-title a { color: inherit; text-decoration: none; }
        .article-card .card-desc {
            color: var(--text-muted); font-size: 0.88rem;
            display: -webkit-box; -webkit-line-clamp: 2;
            -webkit-box-orient: vertical; overflow: hidden;
            transition: color 0.4s ease;
        }
        .card-summary {
            color: var(--text-muted); font-size: 0.85rem;
            display: -webkit-box; -webkit-line-clamp: 4;
            -webkit-box-orient: vertical; overflow: hidden;
            background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08));
            border-left: 3px solid var(--primary);
            padding: 0.4rem 0.6rem; border-radius: 4px;
            margin-top: 0.3rem;
        }
        .article-card .card-meta {
            display: flex; align-items: center; justify-content: space-between;
            margin-top: 1rem; padding-top: 0.8rem;
            border-top: 1px solid var(--border);
            transition: border-color 0.4s ease;
        }
        .article-card .card-extra-meta { display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); font-size: 0.8rem; flex-wrap: wrap; }
        .article-card .card-date { color: var(--text-muted); font-size: 0.78rem; }
        .featured-card {
            background: var(--card-bg); border: 1px solid var(--border);
            border-radius: 20px; overflow: hidden; display: flex; margin-bottom: 2rem;
            transition: background 0.4s ease, border-color 0.4s ease;
        }
        .featured-card.hidden { display: none; }
        .featured-card:hover { box-shadow: var(--shadow-hover); transform: translateY(-3px); }
        .featured-card .card-thumb {
            width: 45%; min-height: 300px; position: relative; overflow: hidden;
        }
        .featured-card .card-thumb img {
            width: 100%; height: 100%; object-fit: cover;
            transition: transform 0.5s ease;
        }
        .featured-card[data-category="vendor"] .card-thumb img {
            object-fit: contain;
            background: #f8fafc;
        }
        .featured-card:hover .card-thumb img { transform: scale(1.05); }
        .featured-card .card-content {
            flex: 1; padding: 2rem 2.2rem;
            display: flex; flex-direction: column; justify-content: center;
        }
        .featured-card .featured-label {
            font-size: 0.72rem; font-weight: 700; letter-spacing: 1px;
            text-transform: uppercase; color: var(--primary); margin-bottom: 0.8rem;
        }
        .featured-card .card-title {
            font-size: 1.6rem; font-weight: 700;
            margin-bottom: 1rem; line-height: 1.3;
            color: var(--text); transition: color 0.4s ease;
        }
        .featured-card:hover .card-title { color: var(--primary); }
        .featured-card .card-title a { color: inherit; text-decoration: none; }
        .featured-card .card-desc {
            color: var(--text-muted); font-size: 0.95rem;
            line-height: 1.7; margin-bottom: 1.5rem;
            transition: color 0.4s ease;
        }
        .featured-card .card-summary {
            color: var(--text); font-size: 0.95rem;
            line-height: 1.7; margin-bottom: 1.5rem;
            background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.12));
            border-left: 4px solid var(--primary);
            padding: 0.6rem 1rem; border-radius: 6px;
        }
        .featured-card .card-footer { display: flex; align-items: center; justify-content: space-between; }
        .read-btn {
            display: inline-flex; align-items: center; gap: 0.4rem;
            padding: 0.5rem 1.2rem; border-radius: 50px;
            background: var(--primary); color: white;
            font-size: 0.85rem; font-weight: 500;
            text-decoration: none; transition: all 0.3s ease;
        }
        .read-btn:hover { background: var(--primary-dark); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(99,102,241,0.4); }
        footer { text-align: center; padding: 2rem; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 0.8rem; transition: border-color 0.4s ease; }
        footer a { color: var(--primary); text-decoration: none; }
        .progress-bar { position: fixed; top: 64px; left: 0; height: 3px; background: var(--gradient-1); z-index: 999; transition: width 0.1s; }
        .empty-state { display: none; text-align: center; padding: 4rem; color: var(--text-muted); }
        .empty-state .empty-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: var(--bg); }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
        @keyframes fadeInRight { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        .article-card { animation: fadeInRight 0.4s ease forwards; }
        /* ── 三分区结构 ─────────────────────────────────────── */
        .section-block {
            margin-bottom: 3rem;
        }
        .section-title {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            font-size: 1.15rem;
            font-weight: 700;
            color: var(--text);
            margin-bottom: 1.2rem;
            padding-bottom: 0.6rem;
            border-bottom: 2px solid var(--border);
            transition: color 0.4s ease, border-color 0.4s ease;
        }
        .section-title .section-icon {
            font-size: 1.2rem;
        }
        .section-title .section-count {
            margin-left: auto;
            font-size: 0.75rem;
            font-weight: 600;
            background: var(--primary);
            color: white;
            padding: 0.15rem 0.55rem;
            border-radius: 50px;
        }
        .section-block:nth-child(1) .section-title { border-bottom-color: #6366f1; }
        .section-block:nth-child(2) .section-title { border-bottom-color: #f59e0b; }
        .section-block:nth-child(3) .section-title { border-bottom-color: #10b981; }

        @media (max-width: 768px) {
            .featured-card { flex-direction: column; }
            .featured-card .card-thumb { width: 100%; min-height: 200px; }
            .article-card { flex-direction: column; }
            .article-card .card-thumb { width: 100%; min-height: 160px; }
            .hero h1 { font-size: 2rem; }
            .hero-stats { gap: 1.5rem; }
            .hero-stats .stat-num { font-size: 1.4rem; }
            .section-title { font-size: 1rem; }
        }
    </style>
</head>
<body data-theme="light">

    <div class="progress-bar" id="progressBar"></div>

    <nav>
        <div class="nav-inner">
            <div class="logo">
                <span class="logo-icon">🤖</span>
                AI Agent 前沿
            </div>
            <div class="theme-toggle" onclick="toggleTheme()">
                <div class="sun">☀️</div>
                <div class="moon">🌙</div>
            </div>
        </div>
    </nav>

    <section class="hero">
        <div class="hero-inner">
            <div class="pill">🧠 专注 · AI Agent 前沿</div>
            <h1>AI 技术情报站</h1>
            <p>追踪 AI Agent、具身智能、多智能体系统的最新进展与行业应用</p>
            <div class="hero-stats">
                <div class="stat-item">
                    <div class="stat-num">9</div>
                    <div class="stat-label">篇精选文章</div>
                </div>
                <div class="stat-item">
                    <div class="stat-num">${updateDate}</div>
                    <div class="stat-label">更新日期</div>
                </div>
                <div class="stat-item">
                    <div class="stat-num">${updateTime}</div>
                    <div class="stat-label">更新时间</div>
                </div>
            </div>
        </div>
    </section>

    <main>
        ${sectionsHTML}

        <div id="emptyState" class="empty-state">
            <div class="empty-icon">🔍</div>
            <p>该分类下暂无文章</p>
        </div>
    </main>

    <footer>
        <p>AI Agent 前沿动态 | 每日自动更新</p>
    </footer>

    <script>
        function toggleTheme() {
            const body = document.body;
            const current = body.getAttribute('data-theme');
            body.setAttribute('data-theme', current === 'light' ? 'dark' : 'light');
            localStorage.setItem('ai-news-theme', body.getAttribute('data-theme'));
        }
        (function() {
            const saved = localStorage.getItem('ai-news-theme');
            if (saved) {
                document.body.setAttribute('data-theme', saved);
            } else {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                document.body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
            }
        })();
        function filterNews(category) {
            document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
            event.target.closest('.category-btn').classList.add('active');
            const sections = document.querySelectorAll('.section-block');
            const emptyState = document.getElementById('emptyState');
            let visibleCount = 0;
            sections.forEach(section => {
                const cards = section.querySelectorAll('.article-card');
                const sectionTitle = section.querySelector('.section-title');
                let sectionVisible = 0;
                cards.forEach((card, index) => {
                    const show = category === 'all' || card.dataset.category === category;
                    if (show) {
                        sectionVisible++;
                        visibleCount++;
                        if (card.style.display === 'none') {
                            card.style.display = 'flex';
                            card.style.animation = 'none';
                            card.offsetHeight;
                            card.style.opacity = '0';
                            card.style.transform = 'translateX(-12px)';
                            requestAnimationFrame(() => {
                                card.style.animation = 'fadeInRight 0.4s ease ' + (index * 0.05) + 's forwards';
                            });
                        }
                    } else {
                        card.style.display = 'none';
                    }
                });
                section.style.display = sectionVisible > 0 ? 'block' : 'none';
                if (sectionTitle) {
                    const countEl = sectionTitle.querySelector('.section-count');
                    if (countEl) countEl.textContent = sectionVisible;
                }
            });
            emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
        }
        window.addEventListener('scroll', () => {
            const scrollTop = document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            document.getElementById('progressBar').style.width = (scrollTop / scrollHeight * 100) + '%';
        });
        document.querySelectorAll('.article-card, .featured-card').forEach(card => {
            card.addEventListener('click', () => {
                const link = card.querySelector('a');
                if (link) window.open(link.href, '_blank');
            });
        });
    </script>
</body>
</html>`;

  return html;
}

/**
 * 主函数
 */
async function main() {
  console.log('🤖 AI Agent 前沿动态 — 抓取脚本');
  console.log('═'.repeat(50));
  console.log(`⏰ 运行时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  console.log('');

  console.log('📡 开始抓取新闻数据...');
  const articles = await scrapeAllSources();
  
  console.log(`\n✅ 共获取 ${articles.length} 篇文章`);
  
  if (articles.length === 0) {
    console.error('❌ 未获取到任何文章，退出');
    process.exit(1);
  }

  console.log('\n📝 正在生成 HTML...');
  const html = generateHTML(articles);
  
  fs.writeFileSync(CONFIG.outputFile, html, 'utf8');
  console.log(`✅ HTML 已写入: ${CONFIG.outputFile}`);

  const stats = fs.statSync(CONFIG.outputFile);
  console.log(`📊 文件大小: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log(`\n🎉 完成！`);
  console.log(`   打开 ${CONFIG.outputFile} 预览`);
}

// Polyfill for String.hashCode (used in image selection)
if (!String.prototype.hashCode) {
  String.prototype.hashCode = function() {
    let hash = 0;
    for (let i = 0; i < this.length; i++) {
      const char = this.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  };
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  generateSummary,
  finalizeArticlesForDisplay,
  filterArticles,
  scoreArticle,
  inferTechTags,
  inferValueTag,
  assignArticlesToSections,
  CONFIG,
};

