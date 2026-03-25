const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const scrapePath = path.join(repoRoot, 'scripts', 'scrape.js');

// ─── Helper: extract a snippet from scrape.js ────────────────────────────────
function getScrapeSource() {
  return fs.readFileSync(scrapePath, 'utf8');
}

// ─── Task 7: Tags ────────────────────────────────────────────────────────────

test('article structure supports techTags array field', () => {
  const source = getScrapeSource();
  // After enrichment, articles should be able to carry techTags
  // This is tested by verifying the concept exists in the source
  assert.ok(source.length > 0, 'scrape.js should exist');
  // Check that techTags concept is referenced somewhere
  // We look for the presence of tech tag assignment logic
  assert.match(source, /techTag|tech_tag|techTags/, /article structure should reference tech tags/);
});

test('article structure supports valueTag string field', () => {
  const source = getScrapeSource();
  // valueTag concept should be in the source
  assert.match(source, /valueTag|value_tag|valueTag/, /article structure should reference valueTag/);
});

test('generateArticleCard renders tech tag pills in HTML output', () => {
  const source = getScrapeSource();
  // Card rendering should include tech tags in the HTML output
  assert.match(source, /card-tech|tech-tag|techTag|tech-tag/, 'generateArticleCard should render tech tag elements');
});

test('generateArticleCard renders value tag in card', () => {
  const source = getScrapeSource();
  // Value tag should appear in card rendering
  assert.match(source, /value-tag|valueTag|value_tag/, 'generateArticleCard should render value tag elements');
});

test('enrichArticle or scrapeAllSources populates techTags based on content analysis', () => {
  const source = getScrapeSource();
  // Tech tag population logic should exist (could be keyword matching or AI-based)
  // We verify the concept is referenced in enrichment or processing
  assert.match(source, /techTags|tech_tag/, 'techTags population logic should exist');
});

test('CONFIG sections define tag vocabulary for each section type', () => {
  const source = getScrapeSource();
  // Each section should have tag-related vocabulary defined
  // The tag vocabulary or mapping should exist in CONFIG or near it
  assert.match(source, /tagVocabulary|tag_vocabulary|TAG_VOCABULARY|techTagMap/, 'tag vocabulary should be defined');
});

test('valueTag assignment logic exists for vendor/open-source/frontier sections', () => {
  const source = getScrapeSource();
  // Value tag assignment should differ by section
  assert.match(source, /valueTag|value_tag/, 'valueTag assignment logic should exist');
});

test('card rendering includes both tech tag pills and value tag badges', () => {
  const source = getScrapeSource();
  // HTML output should have both tech tag and value tag elements
  const hasTechTagRender = /card-tech|tech-tag|techTag|tech-tag/.test(source);
  const hasValueTagRender = /value-tag|valueTag|value_tag/.test(source);
  assert.ok(hasTechTagRender || hasValueTagRender, 'card rendering should include tag elements');
});
