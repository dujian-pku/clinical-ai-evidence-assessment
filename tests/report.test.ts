import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeNarrativeReport, reportContext } from '../lib/report.ts';
import { researchExample } from '../lib/research-examples.ts';
import { selectReportHighlights } from '../lib/report-highlights.ts';

test('评述输入包含疾病任务、指标数值、当前状态和研究背景', () => {
  const data = researchExample('37087370');
  const context = reportContext(data);
  assert.equal(context.study.disease, 'HPV 相关口咽癌');
  assert.equal(context.performance.metric, 'AUC');
  assert.equal(context.performance.value, 0.86);
  assert.equal(context.evidence.length, 7);
  assert.match(context.researcherNotes, /E3311/);
  assert.match(context.metricInterpretation, /不写成准确率或百分比/);
  data.metricValue = '0.9'; data.states.safety = '不适用';
  const changed = reportContext(data);
  assert.equal(changed.performance.value, 0.9);
  assert.equal(changed.evidence[0].status, '不适用');
  assert.equal(changed.evidenceBasis.edited, true);
});

// Contract fixture, not a sample scientific report.
const paragraphs = ['甲', '乙', '丙', '丁'].map(label => label + '这段文字用于测试评述输出格式，确认段落能够完整保存且格式校验可以工作。'.repeat(4));
test('接受连续段落，拒绝短答、清单、空内容和重复段落', () => {
  const context = reportContext(researchExample('37087370'));
  assert.deepEqual(decodeNarrativeReport({ paragraphs }, context), { paragraphs });
  for (const value of [null, { summary: '短评' }, { paragraphs: ['短评'] }, { paragraphs: [paragraphs[0], ...paragraphs.slice(0, 3)] }, { paragraphs: ['【概况】' + paragraphs[0], ...paragraphs.slice(1)] }, { paragraphs: ['1. ' + paragraphs[0], ...paragraphs.slice(1)] }, { paragraphs: [paragraphs[0], 5, ...paragraphs.slice(2)] }]) {
    assert.equal(decodeNarrativeReport(value, context), null);
  }
});

test('保留输入数值和等值百分比，拒绝凭空增加数值', () => {
  const context = reportContext(researchExample('37029272'));
  const accepted = { paragraphs: [paragraphs[0] + '准确率为97.03%。', ...paragraphs.slice(1)] };
  assert.ok(decodeNarrativeReport(accepted, context));
  assert.equal(decodeNarrativeReport({ paragraphs: [paragraphs[0] + '样本量为10000人。', ...paragraphs.slice(1)] }, context), null);
});

test('高亮仅引用对应正文，忽略错位、改写、重叠和无效标记', () => {
  const body = ['比较条件仍需核实，已有研究记录可以用于讨论后续评价的重点。' + '正文保持完整，不因高亮改变内容。'.repeat(8)];
  const valid = { paragraph: 0, text: '比较条件仍需核实' };
  const invalid = [
    { paragraph: 1, text: valid.text }, { paragraph: -1, text: valid.text },
    { paragraph: 0.5, text: valid.text }, { paragraph: '0', text: valid.text },
    { paragraph: 0, text: '比较条件已核实' }, { paragraph: 0, text: '<script>执行</script>' },
    { paragraph: 0, text: 123 }, null,
  ];
  assert.deepEqual(selectReportHighlights(body, [valid, valid, { paragraph: 0, text: '比较条件仍需核实，已有研究记录' }, ...invalid]), [valid]);
  assert.deepEqual(selectReportHighlights(body, null), []);
  const context = reportContext(researchExample('37087370'));
  const accepted = { paragraph: 2, text: '这段文字用于测试评述输出格式' };
  assert.deepEqual(decodeNarrativeReport({ paragraphs, highlights: [...invalid, accepted] }, context), { paragraphs, highlights: [accepted] });
});

test('高亮限制段内密度、全文比例和数量，连续正文仍可独立阅读', () => {
  const phrases = ['研究结果仍需结合比较条件解释', '判读时间与复核次数需要一起考察', '已有资料可用于明确后续评价重点'];
  const short = phrases.join('。');
  assert.deepEqual(selectReportHighlights([short], [{ paragraph: 0, text: short }]), []);
  const dense = selectReportHighlights([short], phrases.map(text => ({ paragraph: 0, text })));
  assert.ok(dense.reduce((sum, h) => sum + h.text.length, 0) <= short.length * 0.25);
  const body = [short + '其余正文用于展开已有研究的具体问题。'.repeat(12)];
  assert.equal(selectReportHighlights(body, phrases.map(text => ({ paragraph: 0, text }))).length, 2);
  const many = Array.from({ length: 8 }, (_, i) => ({ paragraph: i, text: phrases[0] }));
  assert.equal(selectReportHighlights(Array(8).fill(body[0]), many).length, 6);
});
