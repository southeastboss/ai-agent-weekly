const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');

const inputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '..', 'index.html');

function fail(message) {
  console.error(`❌ Smoke check failed: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(inputPath)) {
  fail(`HTML file not found: ${inputPath}`);
}

const html = fs.readFileSync(inputPath, 'utf8');
const $ = cheerio.load(html);

const featuredCards = $('.featured-card').length;
const articleCards = $('.article-card').length;
const sectionBlocks = $('.section-block').length;
const totalCards = featuredCards + articleCards;
const linkedTitles = $('.featured-card .card-title a, .article-card .card-title a').length;

// Accept either a featured card OR section blocks as valid content structure
if (featuredCards < 1 && sectionBlocks < 1) {
  fail('Expected at least 1 featured card or 1 section block');
}

if (articleCards < 9) {
  fail(`Expected at least 9 article cards, got ${articleCards}`);
}

if (totalCards < 9) {
  fail(`Expected at least 9 total cards, got ${totalCards}`);
}

if (linkedTitles < totalCards) {
  fail(`Expected at least ${totalCards} linked titles, got ${linkedTitles}`);
}

console.log(`✅ Smoke check passed: ${featuredCards} featured, ${sectionBlocks} sections, ${articleCards} articles, ${linkedTitles} linked titles`);
