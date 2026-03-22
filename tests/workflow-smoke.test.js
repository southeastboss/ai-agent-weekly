const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const workflowPath = path.join(repoRoot, '.github', 'workflows', 'daily-update.yml');
const smokeCheckPath = path.join(repoRoot, 'scripts', 'smoke-check.js');

function makeHtml({ featured = 1, articles = 9 }) {
  return `<!DOCTYPE html>
  <html>
    <body>
      <main>
        ${Array.from({ length: featured }).map((_, index) => `
          <div class="featured-card">
            <h2 class="card-title"><a href="https://example.com/featured-${index}">Featured ${index}</a></h2>
          </div>
        `).join('')}
        <div class="article-list">
          ${Array.from({ length: articles }).map((_, index) => `
            <div class="article-card">
              <h3 class="card-title"><a href="https://example.com/article-${index}">Article ${index}</a></h3>
            </div>
          `).join('')}
        </div>
      </main>
    </body>
  </html>`;
}

test('workflow runs smoke check after scrape and opts out of Node 20 deprecation risk', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  const scrapeIdx = workflow.indexOf('npm run scrape');
  const smokeIdx = workflow.indexOf('npm run smoke-check');
  assert.ok(scrapeIdx !== -1, 'should have npm run scrape');
  assert.ok(smokeIdx !== -1, 'should have npm run smoke-check');
  assert.ok(smokeIdx > scrapeIdx, 'smoke check should run after scraper');

  const pullIdx = workflow.indexOf('git pull --rebase origin master');
  assert.ok(pullIdx !== -1 && pullIdx < scrapeIdx, 'git pull --rebase should come before scrape');

  assert.match(workflow, /FORCE_JAVASCRIPT_ACTIONS_TO_NODE24:\s*true|FORCE_JAVASCRIPT_ACTIONS_TO_NODE24:\s*'true'/);
  assert.match(workflow, /uses:\s*actions\/checkout@v6/);
  assert.match(workflow, /uses:\s*actions\/setup-node@v6/);
  assert.match(workflow, /uses:\s*actions\/upload-artifact@v7/);
});

test('smoke check passes for populated generated HTML', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-weekly-'));
  const htmlPath = path.join(tempDir, 'index.html');
  fs.writeFileSync(htmlPath, makeHtml({ featured: 1, articles: 9 }));

  const result = spawnSync(process.execPath, [smokeCheckPath, htmlPath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Smoke check passed/i);
});

test('smoke check fails when generated page has no article cards', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-weekly-'));
  const htmlPath = path.join(tempDir, 'index.html');
  fs.writeFileSync(htmlPath, makeHtml({ featured: 0, articles: 0 }));

  const result = spawnSync(process.execPath, [smokeCheckPath, htmlPath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0, 'smoke check should fail for empty pages');
  assert.match(`${result.stderr}${result.stdout}`, /Smoke check failed|No article cards|Expected/i);
});
