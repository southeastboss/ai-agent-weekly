const test = require('node:test');
const assert = require('node:assert/strict');
const { generateArticleCard } = require('../scripts/scrape.js');

test('open-source article keeps og image and falls back to GitHub logo', () => {
  assert.equal(typeof generateArticleCard, 'function');

  const html = generateArticleCard({
    title: 'Repo article',
    url: 'https://github.com/foo/bar',
    image: 'https://opengraph.githubassets.com/test/foo/bar',
    sourceCategory: 'open-source',
    date: '2026-03-25',
    description: 'desc',
    tagClass: 'tag-agent',
    tag: 'Agent',
  });

  assert.match(html, /src="https:\/\/opengraph\.githubassets\.com\/test\/foo\/bar"/);
  assert.match(html, /onerror="this\.src='https:\/\/github\.githubassets\.com\/images\/modules\/logos_page\/GitHub-Logo\.png';this\.onerror=null"/);
});

test('vendor article keeps og image and falls back to vendor logo', () => {
  assert.equal(typeof generateArticleCard, 'function');

  const html = generateArticleCard({
    title: 'OpenAI article',
    url: 'https://openai.com/index/test-article',
    image: 'https://cdn.example.com/article-image.jpg',
    sourceCategory: 'vendor',
    date: '2026-03-25',
    description: 'desc',
    tagClass: 'tag-agent',
    tag: 'OpenAI',
  });

  assert.match(html, /src="https:\/\/cdn\.example\.com\/article-image\.jpg"/);
  assert.match(html, /onerror="this\.src='https:\/\/openai\.com\/content\/images\/logos\/openai-glyph-logo\.svg';this\.onerror=null"/);
});

test('vendor article without image prefers svg vendor logo as primary image when available', () => {
  assert.equal(typeof generateArticleCard, 'function');

  const html = generateArticleCard({
    title: 'OpenAI article without image',
    url: 'https://openai.com/index/test-article',
    image: '',
    sourceCategory: 'vendor',
    date: '2026-03-25',
    description: 'desc',
    tagClass: 'tag-agent',
    tag: 'OpenAI',
  });

  assert.match(html, /src="assets\/vendor-logos\/openai\.svg"/);
  assert.match(html, /onerror="this\.src='https:\/\/openai\.com\/content\/images\/logos\/openai-glyph-logo\.svg';this\.onerror=null"/);
});
