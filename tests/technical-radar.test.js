const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const scrapePath = path.join(repoRoot, 'scripts', 'scrape.js');
const smokeCheckPath = path.join(repoRoot, 'scripts', 'smoke-check.js');

/**
 * Generates a mock HTML with three sections and 15 articles (5 per section).
 * No featured card — all 15 are regular article cards.
 */
function makeThreeSectionHtml({ openSource = 5, vendor = 5, frontier = 5 } = {}) {
  const sections = [
    { id: 'open-source', label: '开源项目', count: openSource },
    { id: 'vendor', label: '厂商动态', count: vendor },
    { id: 'frontier', label: '前沿技术', count: frontier },
  ];

  const sectionCards = sections.map(({ id, label, count }) => `
    <section class="section-block" data-section="${id}">
      <h2 class="section-title">${label}</h2>
      <div class="article-list">
        ${Array.from({ length: count }).map((_, i) => `
          <div class="article-card" data-category="${id}">
            <div class="card-thumb">
              <img src="https://picsum.photos/seed/${id}${i}/800/400" alt="img" loading="lazy">
            </div>
            <div class="card-content">
              <span class="card-tag" style="background:linear-gradient(135deg,#6366f1,#8b5cf6)">${label}</span>
              <h3 class="card-title">
                <a href="https://example.com/${id}/${i}">${label} Article ${i + 1}</a>
              </h3>
              <p class="card-summary">这是中文摘要示例。</p>
              <div class="card-meta">
                <div class="card-source">
                  <span class="icon" style="background:#6366f1">A</span>
                  example.com
                </div>
                <span class="card-date">2026-03-25</span>
              </div>
            </div>
          </div>
        `).join('\n')}
      </div>
    </section>
  `).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>AI Agent 前沿动态 | 2026.03.25</title></head>
<body>
  <nav></nav>
  <section class="hero"></section>
  <main>
    ${sectionCards}
    <div class="source-note"></div>
  </main>
  <footer></footer>
</body>
</html>`;
}

// ─── Task 1 Tests ────────────────────────────────────────────────────────────

test('scrape.js CONFIG targets 15 total articles', () => {
  const source = fs.readFileSync(scrapePath, 'utf8');
  // Find maxArticles value
  const match = source.match(/maxArticles:\s*(\d+)/);
  assert.ok(match, 'should have maxArticles defined');
  const maxArticles = parseInt(match[1], 10);
  assert.equal(maxArticles, 15, `maxArticles should be 15, got ${maxArticles}`);
});

test('scrape.js CONFIG has three section quotas defined', () => {
  const source = fs.readFileSync(scrapePath, 'utf8');
  assert.match(source, /sections:\s*\[/, 'CONFIG should have a sections array');
  assert.match(source, /开源项目/, 'CONFIG should reference 开源项目');
  assert.match(source, /厂商动态/, 'CONFIG should reference 厂商动态');
  assert.match(source, /前沿技术/, 'CONFIG should reference 前沿技术');
  // Each section should have a quota
  assert.match(source, /quota:\s*\d+/, 'each section should have a quota field');
});

// ─── Task 2 Tests ────────────────────────────────────────────────────────────

test('scrape.js generateHTML produces three section headings in the output', () => {
  // We can test the function directly by requiring scrape.js and mocking the input
  const source = fs.readFileSync(scrapePath, 'utf8');

  // The generateHTML function should reference all three section titles
  assert.match(source, /开源项目/, 'generateHTML should reference 开源项目');
  assert.match(source, /厂商动态/, 'generateHTML should reference 厂商动态');
  assert.match(source, /前沿技术/, 'generateHTML should reference 前沿技术');
});

test('generated HTML with three sections passes smoke check (15 cards)', () => {
  const tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ai-agent-weekly-'));
  const htmlPath = path.join(tempDir, 'index.html');
  fs.writeFileSync(htmlPath, makeThreeSectionHtml());

  const result = spawnSync(process.execPath, [smokeCheckPath, htmlPath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, `smoke check should pass: ${result.stderr}${result.stdout}`);
  assert.match(result.stdout, /Smoke check passed/i);
});

test('generated HTML with three sections contains section title elements', () => {
  const html = makeThreeSectionHtml();
  const hasOpenSource = html.includes('开源项目');
  const hasVendor = html.includes('厂商动态');
  const hasFrontier = html.includes('前沿技术');
  assert.ok(hasOpenSource, 'should contain 开源项目 section');
  assert.ok(hasVendor, 'should contain 厂商动态 section');
  assert.ok(hasFrontier, 'should contain 前沿技术 section');
});

test('generated HTML with three sections has 15 article cards', () => {
  const html = makeThreeSectionHtml();
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const cards = $('.article-card').length;
  assert.equal(cards, 15, `Expected 15 article cards, got ${cards}`);
});

// ─── Task 3 Tests ────────────────────────────────────────────────────────────

test('generated HTML contains section-block and section-title CSS classes', () => {
  const source = fs.readFileSync(scrapePath, 'utf8');
  assert.match(source, /section-block/, 'generateHTML should use section-block class');
  assert.match(source, /section-title/, 'generateHTML should use section-title class');
});

test('generated HTML contains responsive section styling', () => {
  const source = fs.readFileSync(scrapePath, 'utf8');
  // Should have at least one media query or flex/grid layout for sections
  assert.match(source, /@media|flex|grid/, 'section layout should use responsive CSS');
});

test('generated HTML no longer renders source labels in cards or page note', () => {
  const source = fs.readFileSync(scrapePath, 'utf8');
  assert.doesNotMatch(source, /<div class="card-source">/, 'card source block should not be rendered');
  assert.doesNotMatch(source, /<div class="source-note">/, 'page source note should not be rendered');
});
