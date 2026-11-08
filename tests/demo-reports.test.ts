import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeAssessment, emptyAssessment } from '../lib/assessment.ts';
import { preGeneratedReport } from '../lib/demo-reports.ts';
import { researchExample, researchExamples } from '../lib/research-examples.ts';
import { decodeNarrativeReport, reportContext } from '../lib/report.ts';

test('两项真实研究各自匹配完整报告，正文数值和高亮通过现有契约', () => {
  for (const example of researchExamples) {
    const data = researchExample(example.id);
    const report = preGeneratedReport(data);
    assert.ok(report);
    assert.equal(report.paragraphs.length, 4);
    assert.ok(report.highlights && report.highlights.length >= 4);
    assert.deepEqual(decodeNarrativeReport(report, reportContext(data)), report);
    assert.deepEqual(preGeneratedReport(decodeAssessment(JSON.parse(JSON.stringify(data)))!), report);
  }
  assert.match(preGeneratedReport(researchExample('37029272'))!.paragraphs[0], /0.9703/);
  assert.match(preGeneratedReport(researchExample('37087370'))!.paragraphs[0], /0.86/);
});

test('改变研究结果、疾病、状态或说明后不套用旧报告', () => {
  for (const patch of [
    { studyId: '另一项研究' }, { sourceId: '37029272' }, { disease: '肺癌' },
    { metricValue: '0.9' }, { overall: '改善' }, { notes: '新增研究结果' },
  ]) assert.equal(preGeneratedReport({ ...researchExample('37087370'), ...patch }), null);
  const data = researchExample('37087370');
  data.states.safety = '未报告';
  assert.equal(preGeneratedReport(data), null);
  assert.equal(preGeneratedReport(emptyAssessment()), null);
  assert.equal(preGeneratedReport({ ...data, sourceId: 'toString' }), null);
});

test('展示副本的修改不改变之后载入的预生成报告', () => {
  const data = researchExample('37029272');
  const report = preGeneratedReport(data)!;
  report.paragraphs[0] = '已修改';
  report.highlights!.length = 0;
  const next = preGeneratedReport(data)!;
  assert.match(next.paragraphs[0], /0.9703/);
  assert.equal(next.highlights!.length, 5);
});
