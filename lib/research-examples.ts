import type { Assessment } from './assessment';

// Seven-dimension coding follows records 123 and 52 of the supplied evidence
// workbook (sheet 研究信息提取表, rows 125 and 54). The performance values
// and study designs were checked against the linked original publications.
// Empty O/R cells remain 未报告; diagnostic performance is not recoded as
// an overall clinical benefit or a patient-reported outcome.
const sourceScope = '七维状态沿用证据库记录，性能数值已核对论文。综合评价与患者报告结局按证据库空项填写为未报告。';
export const researchExamples = [
  {
    id: '37087370', label: '口咽癌研究', title: '口咽癌淋巴结包膜外侵犯预测',
    journal: 'The Lancet Digital Health · 2023', record: 123,
    url: 'https://doi.org/10.1016/S2589-7500(23)00046-8',
    pubmed: 'https://pubmed.ncbi.nlm.nih.gov/37087370/',
    summary: '基于 E3311 试验影像数据的诊断验证研究。以病理结果为参照，CT 深度学习模型的 AUC 为 0.86（95% CI 0.82–0.90）。',
    scope: sourceScope,
    data: {
      studyId: 'PMID:37087370', aiType: '深度学习 / 计算机视觉', scene: '诊断辅助', user: '医生', disease: 'HPV 相关口咽癌',
      states: { safety: '已报告', effectiveness: '已报告', economics: '未报告', suitability: '未报告', accessibility: '未报告', oversight: '未报告', governance: '未报告' },
      overall: '未报告', metric: 'AUC', metricValue: '0.86', patient: '未报告', demo: '', sourceId: '37087370',
      notes: 'E3311 试验影像数据的诊断验证分析，以病理结果为参照评估淋巴结包膜外侵犯。此处填入独立模型的 AUC 0.86（95% CI 0.82–0.90），该数值未描述医生使用模型后的表现。七维状态取自证据库第 123 项；安全性记录为假阳性率。证据库未提取综合评价和患者报告结局，对应选项填写为未报告。论文：10.1016/S2589-7500(23)00046-8。',
    } satisfies Assessment,
  },
  {
    id: '37029272', label: '颅内出血研究', title: '颅内出血 CT 辅助诊断',
    journal: 'npj Digital Medicine · 2023', record: 52,
    url: 'https://doi.org/10.1038/s41746-023-00798-8',
    pubmed: 'https://pubmed.ncbi.nlm.nih.gov/37029272/',
    summary: '回顾性多阅片者随机交叉研究。患者层面的诊断准确率为 97.03%（AI 辅助）和 94.71%（无 AI 辅助）。',
    scope: sourceScope,
    data: {
      studyId: 'PMID:37029272', aiType: '深度学习 / 计算机视觉', scene: '诊断辅助', user: '医生', disease: '急性颅内出血',
      states: { safety: '未报告', effectiveness: '已报告', economics: '未报告', suitability: '未报告', accessibility: '未报告', oversight: '未报告', governance: '未报告' },
      overall: '未报告', metric: 'accuracy', metricValue: '0.9703', patient: '未报告', demo: '', sourceId: '37029272',
      notes: '回顾性多阅片者随机交叉研究：9 名阅片者评估 296 例患者的 CT 图像。此处填入 AI 辅助组患者层面的诊断准确率 0.9703，对照为无 AI 辅助组的 0.9471。七维状态取自证据库第 52 项。证据库未提取综合评价和患者报告结局，对应选项填写为未报告。论文：10.1038/s41746-023-00798-8。',
    } satisfies Assessment,
  },
];
export function researchExample(id: string): Assessment {
  const source = researchExamples.find(item => item.id === id);
  if (!source) throw new Error('未找到研究示例。');
  return { ...source.data, states: { ...source.data.states } };
}
export function exampleSource(data: Assessment) {
  const source = researchExamples.find(item => item.id === data.sourceId);
  if (!source) return null;
  const changed = Object.keys(source.data).some(key => {
    const k = key as keyof Assessment;
    return k === 'states'
      ? Object.keys(source.data.states).some(dim => data.states[dim as keyof Assessment['states']] !== source.data.states[dim as keyof Assessment['states']])
      : data[k] !== source.data[k];
  });
  return { ...source, changed };
}
export function sourceCitation(data: Assessment): string {
  const source = exampleSource(data);
  return source ? `示例来源：${source.title}\n${source.journal}；PMID:${source.id}\n${source.url}\n${source.scope}${source.changed ? '\n当前填写已修改。' : ''}` : '';
}
