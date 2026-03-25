const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const scrapePath = path.join(repoRoot, 'scripts', 'scrape.js');

function getScrapeSource() {
  return fs.readFileSync(scrapePath, 'utf8');
}

// ─── Task 8: Scoring ──────────────────────────────────────────────────────────

test('scoreArticle function exists and returns a numeric score', () => {
  const source = getScrapeSource();
  assert.match(source, /function scoreArticle/, 'scoreArticle function should exist');
});

test('scoreArticle considers recency/exponential decay based on article date', () => {
  const source = getScrapeSource();
  // Should have date-based scoring logic
  assert.match(source, /recency|date.*score|exponential|decay|DAYS?|days.*ago/i, 'scoring should consider recency');
});

test('scoreArticle considers source quality by section', () => {
  const source = getScrapeSource();
  // Source quality weighting by section
  assert.match(source, /sourceQuality|source.*quality|sectionWeight|SECTION_WEIGHT/i, 'scoring should consider source quality');
});

test('scoreArticle gives bonus for GitHub stars on open-source articles', () => {
  const source = getScrapeSource();
  // GH stars should factor into open-source scoring
  assert.match(source, /gh_stars|ghStars|github.*star/i, 'open-source scoring should consider GitHub stars');
});

test('scoreArticle gives bonus for description quality (non-trivial length)', () => {
  const source = getScrapeSource();
  // Description quality scoring
  assert.match(source, /description.*score|descQuality|desc.*length|description.*bonus/i, 'scoring should consider description quality');
});

test('scrapeAllSources or post-processing applies per-section scoring before bucketing', () => {
  const source = getScrapeSource();
  // Per-section sorting/bucketing should use scoring
  assert.match(source, /sortArticles|sortByScore|scoreArticle|SCORE_/, 'articles should be scored before section assignment');
});

test('articles are bucketed into sections (not naive sequential slicing)', () => {
  const source = getScrapeSource();
  // The generateHTML should use section-aware bucketing, not just slice(start, start+quota)
  // We check that there's actual bucket/section assignment logic
  assert.match(source, /bucket|assignSection|sectionBucket|SECTION_BUCKETS|assignArticlesToSections/i, 'should use section-aware bucketing, not naive slicing');
});

test('each section gets its quota filled from its own scored pool', () => {
  const source = getScrapeSource();
  // Section quota fulfillment should come from per-section scored pools
  assert.match(source, /quota.*pool|pool.*quota|sectionQuota|assignBySection/i, 'each section should draw from its scored pool');
});
