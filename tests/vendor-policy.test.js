const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const scrapePath = path.join(repoRoot, 'scripts', 'scrape.js');

function getScrapeSource() {
  return fs.readFileSync(scrapePath, 'utf8');
}

test('vendor sources use all 5 configured feeds instead of random slice(0, 3)', () => {
  const source = getScrapeSource();
  assert.doesNotMatch(source, /selectedVendors\s*=\s*vendorPool\.slice\(0,\s*3\)/, 'vendor sources should no longer be randomly limited to 3');
  assert.match(source, /const\s+sources\s*=\s*CONFIG\.sources\[sectionId\]/, 'vendor should use all configured sources');
});

test('vendor freshness window is relaxed to 7 days', () => {
  const source = getScrapeSource();
  assert.match(source, /const\s+maxAgeDays\s*=\s*article\.sourceCategory\s*===\s*'vendor'\s*\?\s*7\s*:\s*3/, 'vendor articles should allow a 7-day window');
});

test('vendor source weights are normalized to the same score', () => {
  const source = getScrapeSource();
  const weights = [
    /'OpenAI Blog':\s*1\.0/,
    /'Google AI Blog':\s*1\.0/,
    /'AWS ML Blog':\s*1\.0/,
    /'Meta Engineering':\s*1\.0/,
    /'Microsoft AI Blog':\s*1\.0/,
  ];

  for (const pattern of weights) {
    assert.match(source, pattern, `expected normalized vendor weight: ${pattern}`);
  }
});
