const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const scrapePath = path.join(repoRoot, 'scripts', 'scrape.js');

// ─── Helper: extract CONFIG from scrape.js via vm-like evaluation ─────────────
function getConfig() {
  // We read the file and extract CONFIG.sources structure
  const source = fs.readFileSync(scrapePath, 'utf8');

  // Verify sources is organized by section (object with sectionId keys)
  assert.match(source, /sources:\s*\{/, 'CONFIG.sources should be an object (organized by section)');
  assert.match(source, /'open-source':\s*\[/, "sources should have 'open-source' key");
  assert.match(source, /'vendor':\s*\[/, "sources should have 'vendor' key");
  assert.match(source, /'frontier':\s*\[/, "sources should have 'frontier' key");

  // Each source should have sectionId
  assert.match(source, /sectionId:\s*'open-source'/, 'open-source sources should have sectionId');
  assert.match(source, /sectionId:\s*'vendor'/, 'vendor sources should have sectionId');
  assert.match(source, /sectionId:\s*'frontier'/, 'frontier sources should have sectionId');

  return true;
}

// ─── Chunk 2 Tests ────────────────────────────────────────────────────────────

test('CONFIG.sources is organized by section (open-source / vendor / frontier)', () => {
  getConfig();
});

test('open-source section has GitHub Trending sources with isGitHubTrending flag', () => {
  const source = fs.readFileSync(scrapePath, 'utf8');
  assert.match(source, /isGitHubTrending:\s*true/, 'GitHub trending sources should have isGitHubTrending: true');
  assert.match(source, /trendingLang:/, 'GitHub trending sources should specify trendingLang');
});

test('vendor section has at least 2 official vendor blog sources', () => {
  const source = fs.readFileSync(scrapePath, 'utf8');
  // Count isRss sources in vendor section
  const vendorSectionMatch = source.match(/'vendor':\s*\[([\s\S]*?)\],/);
  assert.ok(vendorSectionMatch, 'vendor section should exist');
  const vendorSection = vendorSectionMatch[1];
  // Should have OpenAI and Anthropic at minimum
  assert.match(vendorSection, /OpenAI Blog/, 'vendor section should have OpenAI Blog');
  assert.match(vendorSection, /Anthropic Blog/, 'vendor section should have Anthropic Blog');
  assert.match(vendorSection, /isRss:\s*true/, 'vendor sources should be RSS');
});

test('extractGitHubTrendingArticles function exists and handles Box-row structure', () => {
  const source = fs.readFileSync(scrapePath, 'utf8');
  assert.match(source, /function extractGitHubTrendingArticles/, 'extractGitHubTrendingArticles function should exist');
  assert.match(source, /article\.Box-row/, 'GitHub trending extraction should target Box-row');
  assert.match(source, /gh_stars:/, 'extracted articles should include gh_stars field');
  assert.match(source, /gh_lang:/, 'extracted articles should include gh_lang field');
});

test('enrichArticle has special GitHub handling branch', () => {
  const source = fs.readFileSync(scrapePath, 'utf8');
  assert.match(source, /GitHub 项目页面的 enrich 特殊处理/, 'enrichArticle should have GitHub-specific branch');
  assert.match(source, /article\.url\.includes\('github\.com'\)/, 'GitHub detection should check URL');
});

test('generateArticleCard has tag-vendor and tag-opensource in tagMap', () => {
  const source = fs.readFileSync(scrapePath, 'utf8');
  assert.match(source, /'tag-vendor':/, 'tagMap should have tag-vendor entry');
  assert.match(source, /'tag-opensource':/, 'tagMap should have tag-opensource entry');
});

test('generateArticleCard renders GitHub stars and language metadata', () => {
  const source = fs.readFileSync(scrapePath, 'utf8');
  assert.match(source, /extraMeta/, 'generateArticleCard should build extraMeta for GitHub fields');
  assert.match(source, /gh-stars/, 'GitHub stars should render as gh-stars span');
  assert.match(source, /gh-lang/, 'GitHub language should render as gh-lang span');
});

test('getAllSources helper flattens all section sources', () => {
  const source = fs.readFileSync(scrapePath, 'utf8');
  assert.match(source, /function getAllSources\(\)/, 'getAllSources function should exist');
  assert.match(source, /Object\.keys\(CONFIG\.sources\)/, 'getAllSources should iterate over CONFIG.sources keys');
});

test('scrapeAllSources iterates over flattened sources with sectionId logging', () => {
  const source = fs.readFileSync(scrapePath, 'utf8');
  assert.match(source, /getAllSources\(\)/, 'scrapeAllSources should call getAllSources()');
  assert.match(source, /\[\$\{source\.sectionId\}\]/, 'scrapeAllSources should log sectionId for each source');
  assert.match(source, /isGitHubTrending/, 'scrapeAllSources should handle isGitHubTrending sources');
});
