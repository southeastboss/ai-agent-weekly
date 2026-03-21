const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const scrapePath = path.join(repoRoot, 'scripts', 'scrape.js');

test('generated update timestamp is derived from Asia/Shanghai timezone logic', () => {
  const source = fs.readFileSync(scrapePath, 'utf8');
  const generateHtmlSection = source.split('function generateHTML')[1] || '';

  assert.match(source, /Asia\/Shanghai/, 'scrape.js should explicitly use Asia/Shanghai timezone');
  assert.doesNotMatch(
    generateHtmlSection,
    /getFullYear\(|getMonth\(|getDate\(|getHours\(|getMinutes\(/,
    'generateHTML should not use local machine timezone getters directly'
  );
});
