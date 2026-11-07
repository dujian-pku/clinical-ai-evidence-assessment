import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, decodeAssessment, dimensions, emptyAssessment, example, factualReport, parseMetric, scoreNotes, validate } from '../lib/assessment.ts';
import { exampleSource, researchExample, researchExamples, sourceCitation } from '../lib/research-examples.ts';

test('原 Excel 两个示例的四项结果一致', () => {
  assert.equal(calculate(example('a')).evidence, 3.65);
  assert.equal(calculate(example('a')).effect, 8 / 3);
  assert.equal(calculate(example('b')).evidence, 3.05);
  assert.equal(calculate(example('b')).effect, 11.5 / 3);
});
test('未填写不能显示成零分或完整评估', () => {
  const blank = emptyAssessment();
  assert.equal(calculate(blank).evidence, null);
  assert.equal(calculate(blank).effect, null);
  assert.ok(validate(blank).length >= 5);
  const data = example('a'); data.states.safety = '';
  assert.equal(calculate(data).evidence, null);
});
test('全报告为5分，不适用不重分配权重', () => {
  const data = example('a');
  for (const d of dimensions) data.states[d.key] = '已报告';
  assert.equal(calculate(data).evidence, 5);
  data.states.safety = '不适用';
  assert.equal(calculate(data).evidence, 3.2);
});
test('零值、百分比和错误输入被区分', () => {
  assert.equal(parseMetric('0'), 0); assert.equal(parseMetric('100%'), 1);
  assert.equal(parseMetric('70%'), .7); assert.equal(parseMetric('.7'), .7);
  for (const v of ['', '70', '-1', '1.01', '101%', 'NaN', 'Infinity', '0x1', '1e0']) assert.equal(parseMetric(v), null);
  const data = example('b'); data.metricValue = '0';
  assert.equal(calculate(data).effect, 8 / 3);
  data.metricValue = '70%'; assert.equal(calculate(data).effect, 11.5 / 3);
});
test('未报告的缺失规则沿用原表且解释明确', () => {
  const data = example('a'); data.overall = '未报告';
  assert.equal(calculate(data).effect, 2);
  assert.match(scoreNotes(data), /含义不同/);
  assert.match(factualReport(data).paragraphs.join('\n'), /综合评价填写为未报告/);
  data.metricValue = '0.7'; assert.equal(calculate(data).effect, null);
  data.metricValue = ''; data.patient = ''; assert.equal(calculate(data).effect, null);
});
test('输入契约排除非法选项、过长文本和伪造结构', () => {
  assert.deepEqual(decodeAssessment(example('b')), example('b'));
  assert.equal(decodeAssessment({ ...example('b'), overall: '优秀' }), null);
  assert.equal(decodeAssessment({ ...example('b'), notes: 'x'.repeat(2001) }), null);
  assert.equal(decodeAssessment({}), null);
  assert.equal(decodeAssessment({ ...example('b'), states: null }), null);
});

test('真实研究指标沿用指定分析，空白结局不推断为改善', () => {
  const ene = researchExample('37087370');
  assert.equal(ene.metric, 'AUC'); assert.equal(ene.metricValue, '0.86');
  assert.equal(calculate(ene).evidence, 3.05);
  assert.equal(calculate(ene).effect, (3 + 0.86 * 5 + 3) / 3);
  const ich = researchExample('37029272');
  assert.equal(ich.metric, 'accuracy'); assert.equal(ich.metricValue, '0.9703');
  assert.equal(calculate(ich).evidence, 1.25);
  for (const data of [ene, ich]) {
    assert.equal(data.overall, '未报告'); assert.equal(data.patient, '未报告');
    assert.equal(data.demo, ''); assert.deepEqual(validate(data), []);
    assert.deepEqual(decodeAssessment(data), data);
  }
});

test('示例修改和保存后保留出处；原始研究数据不被覆盖', () => {
  const data = researchExample('37087370');
  assert.equal(exampleSource(data)?.changed, false);
  data.states.safety = '未报告'; data.metricValue = '0.9';
  assert.equal(exampleSource(data)?.changed, true);
  assert.match(sourceCitation(data), /当前填写已修改/);
  assert.equal(researchExample('37087370').states.safety, '已报告');
  assert.equal(researchExamples[0].data.metricValue, '0.86');
  assert.equal(decodeAssessment({ ...data, sourceId: 'unknown' }), null);
  const legacy = example('a');
  assert.equal(decodeAssessment({ ...legacy, sourceId: undefined })?.sourceId, '');
});
