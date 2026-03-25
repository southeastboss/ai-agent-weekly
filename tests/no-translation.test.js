const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('scrape.js no longer contains MyMemory translation API calls', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../scripts/scrape.js'),
    'utf8'
  );

  assert.ok(
    !source.includes('mymemory.translated.net'),
    'Source should not contain mymemory.translated.net (translation API call)'
  );

  assert.ok(
    !source.includes('translateToChinese'),
    'Source should not contain translateToChinese function'
  );
});
