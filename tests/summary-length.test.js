const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSummary } = require('../scripts/scrape.js');

test('buildSummary keeps medium-length summaries intact (100-200 chars)', () => {
  const input = '这是一段用于测试的中文摘要内容，目标是确认在长度已经落在一百到两百字之间时，系统不会再额外截断它，而是直接保留原始信息密度，让卡片里的内容足够完整，方便用户快速判断是否值得点进去继续阅读。这里再补充几句，用于把总长度稳定拉到一百字以上，同时仍然保持一段自然可读的说明文本。';
  assert.ok(input.length >= 100 && input.length <= 200, `fixture length should be 100-200, got ${input.length}`);
  assert.equal(buildSummary(input), input);
});

test('buildSummary truncates overly long summaries to 200 chars', () => {
  const input = '这是一段很长的中文摘要内容，用来验证系统在面对过长描述时会把摘要收敛到两百字以内，同时尽量保留更多有效信息，而不是像以前一样只截取到一百字。为了确保测试稳定，我们继续补充一些语句，让它明显超过两百个字符，从而验证最终输出确实被限制在两百字以内，而且开头内容仍然保持不变，便于确认截断逻辑没有破坏原始顺序和阅读体验。这里继续补充额外的说明文字，包括技术背景、影响范围、实现方式、适用场景以及潜在价值，让整段内容明确超过两百字，并且在被截断时仍然能保持前半部分的信息完整性。';
  assert.ok(input.length > 200, `fixture length should be >200, got ${input.length}`);
  const summary = buildSummary(input);
  assert.equal(summary.length, 200);
  assert.equal(summary, input.substring(0, 200).trim());
});

test('buildSummary preserves short summaries when source text is under 100 chars', () => {
  const input = '短摘要也应保留原文，不强行填充。';
  assert.ok(input.length < 100, `fixture length should be <100, got ${input.length}`);
  assert.equal(buildSummary(input), input);
});
