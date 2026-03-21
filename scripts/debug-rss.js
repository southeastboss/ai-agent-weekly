const { execFileSync } = require('child_process');

function fetchRawWithCurl(url) {
  return execFileSync('curl.exe', [
    '-L', '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    '--silent', '--max-time', '20', url
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}

const rssRaw = fetchRawWithCurl('https://www.artificialintelligence-news.com/feed/');

// Check first 1000 chars for RSS format
console.log('First 1000 chars:');
console.log(rssRaw.substring(0, 1000));
console.log('\n---\n');

// Try matching items
const itemRegex = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi;
let count = 0;
let match;
while ((match = itemRegex.exec(rssRaw)) !== null) {
  count++;
  if (count <= 3) {
    const item = match[1];
    const linkMatch = /<link[^>]*href=["']([^"']+)["'][^>]*>/i.exec(item);
    const titleMatch = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(item);
    const dateMatch = /<(?:pubDate|published)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:pubDate|published)>/i.exec(item);
    console.log(`Item ${count}:`);
    console.log('  title:', titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : 'NOT FOUND');
    console.log('  link (href):', linkMatch ? linkMatch[1].trim() : 'NOT FOUND');
    console.log('  date:', dateMatch ? dateMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : 'NOT FOUND');
  }
}
console.log('\nTotal items matched:', count);
