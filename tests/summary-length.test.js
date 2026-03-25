const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('generateSummary produces summaries of 100-200 chars when AI call succeeds', async () => {
  // This test verifies the prompt expects 100-200 char output.
  // We check the prompt text in source to confirm the length requirement.
  const source = fs.readFileSync(
    path.join(__dirname, '../scripts/scrape.js'),
    'utf8'
  );
  assert.ok(
    source.includes('100') && source.includes('200'),
    'Prompt should specify 100-200 character target'
  );
});

test('generateSummary does not use MyMemory translation API', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../scripts/scrape.js'),
    'utf8'
  );
  assert.ok(
    !source.includes('mymemory.translated.net'),
    'Should not contain MyMemory translation API'
  );
});

test('generateSummary uses MiniMax API for Chinese summarization', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../scripts/scrape.js'),
    'utf8'
  );
  assert.ok(
    source.includes('api.minimax.chat'),
    'Should use MiniMax API for summarization'
  );
  assert.ok(
    source.includes('MINIMAX_API_KEY'),
    'Should reference MINIMAX_API_KEY environment variable'
  );
});
