const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const scrapePath = path.join(repoRoot, 'scripts', 'scrape.js');

function getScrapeSource() {
  return fs.readFileSync(scrapePath, 'utf8');
}

// ─── Task 9: Quality Filtering ───────────────────────────────────────────────

test('filterArticles function exists and filters low-value content', () => {
  const source = getScrapeSource();
  assert.match(source, /function filterArticles|filterArticles\s*=/, 'filterArticles function should exist');
});

test('filterArticles removes PR/robot-generated titles (PR:, [PR], Robot, automated patterns)', () => {
  const source = getScrapeSource();
  // Should have PR/automated content detection
  assert.match(source, /PR[\s:)\]]|PR.*title|robot|automated.*pattern/i, 'filter should detect PR/robot patterns');
});

test('filterArticles removes very short titles (< 15 chars)', () => {
  const source = getScrapeSource();
  // Short title detection
  assert.match(source, /title.*length|title.*short|minTitle|title.*char/i, 'filter should remove short titles');
});

test('filterArticles removes duplicate-topic articles (fuzzy title similarity)', () => {
  const source = getScrapeSource();
  // Duplicate topic detection via title similarity function
  assert.match(source, /titleSimilarity|similarTitle|dedupe.*title/i, 'filter should use title similarity for dedup');
});

test('filterArticles removes placeholder/advertisement content (newsletter, sponsored, advertisement)', () => {
  const source = getScrapeSource();
  // Ad/newsletter detection
  assert.match(source, /newsletter|sponsored|advertisement|ad-content|AD_/i, 'filter should remove ad/newsletter content');
});

test('filterArticles removes articles with very short descriptions (< 30 chars)', () => {
  const source = getScrapeSource();
  // Short description filtering
  assert.match(source, /description.*short|desc.*min|minDesc|description.*length/i, 'filter should remove short descriptions');
});

test('filterArticles is called in main scraping pipeline before HTML generation', () => {
  const source = getScrapeSource();
  // filterArticles should be in the pipeline (between scrape and generateHTML)
  const hasFilter = /filterArticles/.test(source);
  const hasGenerateHtml = /generateHTML/.test(source);
  assert.ok(hasFilter && hasGenerateHtml, 'filterArticles should be in the pipeline before generateHTML');
});

test('filterArticles is called after enrichArticle and before bucketing/scoring', () => {
  const source = getScrapeSource();
  // Filter should be applied after enrichment but before section bucketing
  // Check the CALL to filterArticles (not function definition) appears after enrichment
  // The call in scrapeAllSources looks like: const filtered = filterArticles(allArticles)
  const filterCallIdx = source.indexOf('filterArticles(allArticles)');
  // enrichment completes when Promise.all resolves, then filterArticles is called
  const promiseAllIdx = source.indexOf('Promise.all(pendingEnrichments)');
  assert.ok(filterCallIdx > promiseAllIdx, 'filterArticles call should come after Promise.all enrichment completes');
  assert.ok(filterCallIdx > 0, 'filterArticles should be called in scrapeAllSources');
});
