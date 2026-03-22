/**
 * AI Agent 前沿动态 — 新闻抓取脚本
 * 
 * 功能：
 * 1. 从 artificialintelligence-news.com 抓取 AI Agent 相关文章
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
const CONFIG = {
  // 目标新闻来源（分类页 或 RSS Feed）
  sources: [
    // 分类页来源
    {
      name: 'AI and Us',
      url: 'https://www.artificialintelligence-news.com/categories/ai-and-us/',
      category: 'agent',
      tag: '多智能体',
      tagClass: 'tag-agent'
    },
    {
      name: 'AI in Action',
      url: 'https://www.artificialintelligence-news.com/categories/ai-in-action/',
      category: 'agent',
      tag: '自动化',
      tagClass: 'tag-automation'
    },
    {
      name: 'Inside AI',
      url: 'https://www.artificialintelligence-news.com/categories/inside-ai/',
      category: 'agent',
      tag: 'Agent',
      tagClass: 'tag-agent'
    },
    // RSS Feed 来源
    {
      name: 'TechCrunch AI',
      url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
      category: 'agent',
      tag: 'AI',
      tagClass: 'tag-agent',
      isRss: true
    },
    {
      name: 'VentureBeat AI',
      url: 'https://venturebeat.com/category/ai/feed/',
      category: 'agent',
      tag: 'AI',
      tagClass: 'tag-agent',
      isRss: true
    },
    {
      name: 'Hugging Face Blog',
      url: 'https://huggingface.co/blog/feed.xml',
      category: 'agent',
      tag: 'AI',
      tagClass: 'tag-agent',
      isRss: true
    }
  ],
  // 每页最多文章数（从所有来源收集更多，确保 RSS 新文章能进入排序）
  maxArticles: 10,
  // 输出路径
  outputFile: path.join(__dirname, '..', 'index.html'),
  templateFile: path.join(__dirname, '..', 'template.html')
};

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
      articles.push({ title, url: link, date, description, sourceCategory: source.category, tag: source.tag, tagClass: source.tagClass });
    }
  }

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
    article.sourceCategory = source.category;
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
        sourceCategory: source.category,
        tag: source.tag,
        tagClass: source.tagClass,
      });
    });
  }

  return articles.slice(0, CONFIG.maxArticles);
}

/**
 * 抓取所有来源
 */
/**
 * 使用 MiniMax AI 生成文章摘要（中文，一句话概括）
 */
async function generateSummary(article) {
  if (!article.title || !article.description) return article;

  const prompt = `一句话概括这段新闻（限50字内）：${article.title}。${article.description.substring(0, 200)}`;

  // 直接使用原文描述作为摘要，跳过AI生成
  const summary = article.description ? article.description.substring(0, 80).trim() : '';
  if (summary) {
    return { ...article, summary };
  }
  return article;
}

async function translateToChinese(text) {
  if (!text || text.trim().length === 0) return text;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function tryTranslate(provider, attempt = 1) {
    if (attempt > 2) return null;
    try {
      const result = await provider();
      if (result) return result;
    } catch (err) {
      console.warn(`   ⚠️ 翻译失败（尝试 ${attempt}/2）: ${err.message}`);
    }
    await sleep(attempt * 800);
    return tryTranslate(provider, attempt + 1);
  }

  // MyMemory 免费 API，带重试
  const tryMyMemory = async () => {
    const { data } = await axios.get(
      'https://api.mymemory.translated.net/get',
      {
        params: {
          q: text.substring(0, 500),
          langpair: 'en|zh',
          de: 'ai-agent-weekly@proton.me',
        },
        timeout: 12000,
      }
    );
    if (data && data.responseStatus === 200 && data.responseData && data.responseData.translatedText) {
      return data.responseData.translatedText;
    }
    return null;
  };

  const result = await tryTranslate(tryMyMemory);
  return result || text;
}

async function generateTitle(text) {
  if (!text || text.trim().length === 0) return text;

  const prompt = `${text}`;

  try {
    const { data } = await axios.post(
      'https://api.minimaxi.com/v1/chat/completions',
      {
        model: 'MiniMax-M2.5',
        messages: [
          { role: 'user', content: `把下面标题翻译成中文（20字以内），只输出翻译结果：\n${prompt}` }
        ],
        max_tokens: 50,
        temperature: 0.3,
        think_config: { enabled: false },
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    if (data && data.choices && data.choices[0] && data.choices[0].message) {
      let title = data.choices[0].message.content.trim();
      // 去掉思考过程标记
      title = title.split('🤖').join('').split('<think>').join('').split('</think>').join('').trim();
      if (title && title.length <= 20) return title;
      if (title) return title.substring(0, 20);
    }
  } catch (err) {
    console.warn(`   ⚠️ AI标题生成失败: ${err.message}`);
  }
  return text;
}

// 用翻译 API 处理标题（更稳定）
async function translateTitle(text) {
  return translateToChinese(text);
}

async function enrichArticle(article) {
  const rawTitle = (article.title || '').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
  const rawDesc = (article.description || '').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();

  try {
    const $ = await fetchPage(article.url);
    if ($) {
      const metaTitle = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
      const metaDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
      const metaDate = $('meta[property="article:published_time"]').attr('content') || '';
      const metaImage = $('meta[property="og:image"]').attr('content') || '';

      const title = (metaTitle || rawTitle).replace(/&#039;/g, "'").replace(/\s+/g, ' ').replace(/\s*\|\s*TechCrunch\s*$/i, '').trim();
      const desc = (metaDesc || rawDesc).replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
      const [translatedTitle, translatedDesc] = await Promise.all([
        translateTitle(title),
        translateToChinese(desc),
      ]);

      return {
        ...article,
        title: generatedTitle || title,
        description: translatedDesc || desc,
        date: metaDate ? metaDate.substring(0, 10) : article.date,
        image: metaImage || article.image,
      };
    }
  } catch (error) {
    // 页面抓取失败不影响翻译
  }

  const [translatedTitle, translatedDesc] = await Promise.all([
    translateTitle(rawTitle),
    translateToChinese(rawDesc),
  ]);

  return {
    ...article,
    title: translatedTitle || rawTitle,
    description: translatedDesc || rawDesc,
  };
}

async function scrapeAllSources() {
  const allArticles = [];
  const seen = new Set();
  const pendingEnrichments = [];

  for (const source of CONFIG.sources) {
    console.log(`\n📡 正在抓取: ${source.name}`);
    
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

    // 使用 MiniMax AI 生成中文摘要（并发）
    console.log(`\n🤖 并发生成 AI 摘要...`);
    const summaryPromises = results.map(article => generateSummary(article));
    const summarized = await Promise.all(summaryPromises);
    allArticles.push(...summarized);
  }

  allArticles.sort((a, b) => {
    const dateA = new Date(a.date || '1970-01-01');
    const dateB = new Date(b.date || '1970-01-01');
    return dateB - dateA;
  });

  return allArticles.slice(0, CONFIG.maxArticles);
}

/**
 * 生成文章卡片 HTML
 */
function generateArticleCard(article, isFeatured = false) {
  const imageIndex = Math.abs(article.title.hashCode()) % 10;
  const imageUrl = article.image || `https://picsum.photos/seed/${imageIndex}/800/400`;
  
  const tagMap = {
    'tag-agent': { bg: 'linear-gradient(135deg, #6366f1, #8b5cf6)', label: article.tag || 'Agent' },
    'tag-automation': { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', label: '自动化' },
    'tag-physical': { bg: 'linear-gradient(135deg, #10b981, #059669)', label: '具身智能' },
    'tag-research': { bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', label: '研究' },
    'tag-finance': { bg: 'linear-gradient(135deg, #ec4899, #db2777)', label: '金融' }
  };
  const tagInfo = tagMap[article.tagClass] || { bg: 'linear-gradient(135deg, #6366f1, #764ba2)', label: article.tag || 'AI' };

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
          <div class="card-source">
            <span class="icon" style="background:${tagInfo.bg.split(',')[0].replace('linear-gradient(135deg, ', '')}">${article.title.charAt(0)}</span>
            artificialintelligence-news.com · ${article.date}
          </div>
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
        <h3 class="card-title">
          <a href="${article.url}" target="_blank">${article.title}</a>
        </h3>
        ${article.summary ? `<p class="card-summary">${article.summary}</p>` : `<p class="card-desc">${article.description}</p>`}
        <div class="card-meta">
          <div class="card-source">
            <span class="icon" style="background:${tagInfo.bg.split(',')[0].replace('linear-gradient(135deg, ', '')}">${article.title.charAt(0)}</span>
            artificialintelligence-news.com
          </div>
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

  const featured = articles[0];
  const rest = articles.slice(1);
  
  const featuredHTML = generateArticleCard(featured, true);
  const articlesHTML = rest.map(a => generateArticleCard(a)).join('\n');

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
        .article-card .card-source { display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); font-size: 0.8rem; }
        .article-card .card-source .icon {
            width: 20px; height: 20px; border-radius: 5px;
            display: flex; align-items: center; justify-content: center;
            font-size: 10px; color: white; font-weight: 700;
        }
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
        .featured-card .card-source { display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); font-size: 0.82rem; }
        .featured-card .card-source .icon {
            width: 22px; height: 22px; border-radius: 6px;
            display: flex; align-items: center; justify-content: center;
            font-size: 11px; color: white; font-weight: 700;
        }
        .read-btn {
            display: inline-flex; align-items: center; gap: 0.4rem;
            padding: 0.5rem 1.2rem; border-radius: 50px;
            background: var(--primary); color: white;
            font-size: 0.85rem; font-weight: 500;
            text-decoration: none; transition: all 0.3s ease;
        }
        .read-btn:hover { background: var(--primary-dark); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(99,102,241,0.4); }
        .source-note { text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.82rem; border-top: 1px solid var(--border); margin-top: 2.5rem; transition: border-color 0.4s ease; }
        .source-note a { color: var(--primary); text-decoration: none; }
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
        @media (max-width: 768px) {
            .featured-card { flex-direction: column; }
            .featured-card .card-thumb { width: 100%; min-height: 200px; }
            .article-card { flex-direction: column; }
            .article-card .card-thumb { width: 100%; min-height: 160px; }
            .hero h1 { font-size: 2rem; }
            .hero-stats { gap: 1.5rem; }
            .hero-stats .stat-num { font-size: 1.4rem; }
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
            <h1>AI Agent 本周动态</h1>
            <p>追踪 AI Agent、具身智能、多智能体系统的最新进展与行业应用</p>
            <div class="hero-stats">
                <div class="stat-item">
                    <div class="stat-num">${articles.length}</div>
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
        ${featuredHTML}

        <div class="article-list" id="articleList">
            ${articlesHTML}
        </div>

        <div class="source-note">
            📡 数据来源：<a href="https://www.artificialintelligence-news.com/" target="_blank">artificialintelligence-news.com</a> · 
            自动抓取 · 更新时间：${updateDate} ${updateTime}
        </div>

        <div id="emptyState" class="empty-state">
            <div class="empty-icon">🔍</div>
            <p>该分类下暂无文章</p>
        </div>
    </main>

    <footer>
        <p>AI Agent 前沿动态 | 数据来源：artificialintelligence-news.com（每日自动更新）</p>
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
            const featured = document.getElementById('featured');
            const list = document.getElementById('articleList');
            const emptyState = document.getElementById('emptyState');
            if (featured) featured.style.display = (category === 'all') ? 'flex' : 'none';
            const cards = list.querySelectorAll('.article-card');
            let visibleCount = 0;
            cards.forEach((card, index) => {
                const show = category === 'all' || card.dataset.category === category;
                if (show) {
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

main().catch(console.error);
