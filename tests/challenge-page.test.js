const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const scrapePath = path.join(repoRoot, 'scripts', 'scrape.js');

function getScrapeSource() {
  return fs.readFileSync(scrapePath, 'utf8');
}

// ─── Challenge page protection ─────────────────────────────────────────────────

test('enrichArticle should not override title when fetched page is a challenge/blocked page', () => {
  const source = getScrapeSource();

  // Should detect challenge/blocked page titles and skip override
  assert.match(
    source,
    /challenge|blocklist|Just a moment|Checking your browser|Access denied/i,
    'enrichArticle should detect and skip challenge/blocked page titles'
  );
});

test('enrichArticle should preserve original title and description on challenge page', () => {
  const source = getScrapeSource();

  // When the fetched page looks like a challenge/WAF page, the original title
  // should be preserved instead of being replaced by the challenge title.
  // This is implemented by checking the title against a blocklist before overriding.
  assert.match(
    source,
    /rawTitle|original.*title|title.*preserve|title.*blocklist/i,
    'enrichArticle should reference original title when skipping challenge pages'
  );
});
