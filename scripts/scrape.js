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
  // 目标新闻分类页面（AI Agent / Physical AI 相关）
  sources: [
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
    }
  ],
  // 每页最多文章数
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
 * 抓取单个页面
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
 * 从页面提取文章数据
 */
function extractArticles($, source) {
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
    article.title = titleEl.text().trim();
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
async function enrichArticle(article) {
  try {
    const $ = await fetchPage(article.url);
    if (!$) return article;

    const metaTitle = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
    const metaDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
    const metaDate = $('meta[property="article:published_time"]').attr('content') || '';
    const metaImage = $('meta[property="og:image"]').attr('content') || '';

    return {
      ...article,
      title: (metaTitle || article.title || '').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim(),
      description: (metaDesc || article.description || '').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim(),
      date: metaDate ? metaDate.substring(0, 10) : article.date,
      image: metaImage,
    };
  } catch (error) {
    console.warn(`   ⚠️ 文章详情补全失败: ${article.url}`);
    console.warn(`      ${error.message}`);
    return article;
  }
}

async function scrapeAllSources() {
  const allArticles = [];
  const seen = new Set();

  for (const source of CONFIG.sources) {
    console.log(`\n📡 正在抓取: ${source.name}`);
    const $ = await fetchPage(source.url);
    
    if ($) {
      const articles = extractArticles($, source);
      console.log(`   📰 分类页抽取到 ${articles.length} 篇文章`);

      for (const article of articles) {
        if (seen.has(article.url)) continue;
        seen.add(article.url);
        const enriched = await enrichArticle(article);
        allArticles.push(enriched);
        if (allArticles.length >= CONFIG.maxArticles) break;
      }
    }

    if (allArticles.length >= CONFIG.maxArticles) break;
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
        <p class="card-desc">${article.description}</p>
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
        <p class="card-desc">${article.description}</p>
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
 * 生成 HTML 页面
 */
function generateHTML(articles) {
  const now = new Date();
  const updateDate = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;
  const updateTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

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
            <div class="pill">🧠 专注 · AI Agent 与 Physical AI 前沿</div>
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
