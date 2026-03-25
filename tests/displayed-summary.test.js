const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const scrapePath = path.join(repoRoot, 'scripts', 'scrape.js');
const scrape = require(scrapePath);

function makeArticle(sectionId, index, extra = {}) {
  const topicWords = {
    'open-source': ['sandbox', 'memory', 'agentic', 'tooling', 'orchestration', 'runtime'],
    vendor: ['model', 'enterprise', 'release', 'benchmark', 'platform', 'ecosystem'],
    frontier: ['robotics', 'multimodal', 'research', 'alignment', 'reasoning', 'embodied'],
  };
  const topic = topicWords[sectionId][index] || `topic-${index}`;
  const uniqueSlug = `${sectionId}-${topic}-quasar-lattice-${index}`;
  return {
    title: `${uniqueSlug}${extra.titleSuffix ? `-${extra.titleSuffix.replace(/\s+/g, '-')}` : ''}`.trim(),
    description: extra.description || `Detailed coverage of ${uniqueSlug} covering implementation specifics, measurable impact, technical tradeoffs, and deployment notes for production teams.`,
    date: extra.date || '2026-03-25T08:00:00Z',
    url: extra.url || `https://example.com/${sectionId}/${index}`,
    sourceCategory: sectionId,
    _sourceName: extra._sourceName || 'TechCrunch AI',
    image: extra.image,
    gh_stars: extra.gh_stars,
  };
}

test('finalizeArticlesForDisplay summarizes only the selected 9 UI articles', async () => {
  assert.equal(typeof scrape.finalizeArticlesForDisplay, 'function', 'finalizeArticlesForDisplay should be exported');

  const articles = [];
  for (const sectionId of ['open-source', 'vendor', 'frontier']) {
    for (let i = 0; i < 6; i++) {
      articles.push(makeArticle(sectionId, i, {
        image: i < 5 ? `https://img.example.com/${sectionId}/${i}.png` : '',
        gh_stars: sectionId === 'open-source' && i < 5 ? String(500 - i * 10) : undefined,
        date: i < 5 ? `2026-03-2${5 - i}T08:00:00Z` : '2025-01-01T08:00:00Z',
        titleSuffix: i === 5 ? 'overflow candidate' : `display candidate ${i}`,
      }));
    }
  }

  const summarizedTitles = [];
  const result = await scrape.finalizeArticlesForDisplay(articles, async (article) => {
    summarizedTitles.push(article.title);
    return { ...article, summary: `中文摘要: ${article.title}` };
  });

  assert.equal(result.length, scrape.CONFIG.maxArticles, 'should only return displayed article count');
  assert.equal(summarizedTitles.length, scrape.CONFIG.maxArticles, 'should only summarize displayed articles');
  assert.ok(result.every(article => article.summary && article.summary.startsWith('中文摘要:')), 'displayed articles should have generated summaries');

  const overflowTitles = articles
    .filter(article => article.title.includes('overflow-candidate'))
    .map(article => article.title);

  for (const title of overflowTitles) {
    assert.ok(!summarizedTitles.includes(title), `overflow article should not be summarized: ${title}`);
  }
});

test('scrape.js Python summary subprocess timeout matches 180 seconds', () => {
  const source = fs.readFileSync(scrapePath, 'utf8');
  assert.match(source, /execFileSync\([\s\S]*timeout:\s*180000/, 'Python summary subprocess timeout should be 180000ms');
});
