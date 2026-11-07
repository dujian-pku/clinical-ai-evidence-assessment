export const RULE_VERSION = 'CJ01-Excel-20261107';
export const dimensions = [
  { key: 'safety', name: '安全性', weight: 1.8, description: '错误与伤害、诊疗延误、不适当检查或用药、不良事件。' },
  { key: 'effectiveness', name: '有效性', weight: 1.25, description: '综合表现、性能指标、流程质量、患者报告结局及临床终点。' },
  { key: 'economics', name: '经济性', weight: 0.2, description: '时间与效率、医疗资源利用、成本与效果。' },
  { key: 'suitability', name: '适宜性', weight: 0.4, description: '与应用场景的契合程度、可用性和实施可行性。' },
  { key: 'accessibility', name: '可及性', weight: 0.35, description: '使用参与和依从、理解与知情准备、弱势人群可及性。' },
  { key: 'oversight', name: '人机交互与监督', weight: 0.6, description: '满意度与决策体验、交互负担、人工审核与接管。' },
  { key: 'governance', name: 'AI 治理与公平性', weight: 0.4, description: '伦理与知情、隐私和数据安全、亚组差异、日志及版本。' },
] as const;
export type DimensionKey = typeof dimensions[number]['key'];
export const statuses = ['已报告', '未报告', '不适用'] as const;
export const outcomes = ['改善', '等效', '劣势', '未报告'] as const;
export const metrics = ['accuracy', 'AUC', 'detection rate', '未报告'] as const;
export const scenes = ['疾病筛查', '诊断辅助', '风险预测/分层', '鉴别诊断', '临床建议支持', '其他'] as const;
export const users = ['医生', '护士/其他医务人员', '多专业团队'] as const;
export type Assessment = {
  studyId: string; aiType: string; scene: string; user: string; disease: string;
  states: Record<DimensionKey, string>; overall: string; metric: string; metricValue: string;
  patient: string; notes: string; demo: string; sourceId: string;
};
export function emptyAssessment(): Assessment {
  return { studyId: '', aiType: '', scene: '', user: '', disease: '',
    states: Object.fromEntries(dimensions.map(d => [d.key, ''])) as Assessment['states'],
    overall: '', metric: '', metricValue: '', patient: '', notes: '', demo: '', sourceId: '' };
}
export function example(which: 'a' | 'b'): Assessment {
  const b = which === 'b';
  return { studyId: b ? '示例b' : '示例a', aiType: b ? 'bb' : 'aa', scene: b ? '诊断辅助' : '疾病筛查', user: '医生', disease: b ? 'bb' : 'aa',
    states: { safety: '已报告', effectiveness: '已报告', economics: '未报告', suitability: b ? '不适用' : '未报告', accessibility: '未报告', oversight: b ? '未报告' : '已报告', governance: '未报告' },
    overall: '改善', metric: b ? 'detection rate' : '未报告', metricValue: b ? '0.7' : '', patient: '未报告', notes: '', demo: which, sourceId: '' };
}
const outcomeScore: Record<string, number> = { '改善': 5, '等效': 3, '劣势': 0, '未报告': 3 };
export function parseMetric(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+(?:\.\d+)?\s*%?$/.test(text) && !/^\.\d+\s*%?$/.test(text)) return null;
  const value = Number(text.replace('%', '').trim()) / (text.endsWith('%') ? 100 : 1);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}
export function calculate(data: Assessment) {
  const reported = dimensions.filter(d => data.states[d.key] === '已报告');
  const missing = dimensions.filter(d => data.states[d.key] === '未报告');
  const na = dimensions.filter(d => data.states[d.key] === '不适用');
  const unanswered = dimensions.filter(d => !statuses.includes(data.states[d.key] as typeof statuses[number]));
  const evidence = data.studyId.trim() && !unanswered.length ? Math.round(reported.reduce((s, d) => s + d.weight, 0) * 100) / 100 : null;
  const numeric = parseMetric(data.metricValue);
  let effect: number | null = null;
  let effectError = '';
  if (!outcomes.includes(data.overall as typeof outcomes[number]) || !outcomes.includes(data.patient as typeof outcomes[number]) || !metrics.includes(data.metric as typeof metrics[number])) effectError = '请完成综合评价、性能指标和患者报告结局。';
  else if (data.metric === '未报告' && data.metricValue.trim()) effectError = '性能指标未报告时，请清空性能数值。';
  else if (data.metric !== '未报告' && numeric === null) effectError = '性能数值须为 0–1，或带 % 的百分比。';
  else if (data.studyId.trim()) effect = (outcomeScore[data.overall] + (data.metric === '未报告' ? 0 : numeric! * 5) + outcomeScore[data.patient]) / 3;
  return { evidence, effect, effectError, reported, missing, na, unanswered, numeric };
}
export function validate(data: Assessment): string[] {
  const errors: string[] = [];
  for (const [key, label] of [['studyId', '研究 / 注册编号'], ['aiType', 'AI 类型'], ['disease', '疾病领域']] as const) if (!data[key].trim()) errors.push('请填写' + label + '。');
  if (!scenes.includes(data.scene as typeof scenes[number])) errors.push('请选择具体任务。');
  if (!users.includes(data.user as typeof users[number])) errors.push('请选择使用者。');
  const score = calculate(data);
  if (score.unanswered.length) errors.push('请完成七个维度的报告状态。');
  if (score.effectError) errors.push(score.effectError);
  return errors;
}
export function decodeAssessment(value: unknown): Assessment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const d = value as Record<string, unknown>;
  const base = emptyAssessment();
  for (const k of Object.keys(base).filter(k => k !== 'states') as Exclude<keyof Assessment, 'states'>[]) {
    if (k === 'sourceId' && d[k] === undefined) continue;
    if (typeof d[k] !== 'string' || (d[k] as string).length > (k === 'notes' ? 2000 : 200)) return null;
    base[k] = d[k] as string;
  }
  if (!d.states || typeof d.states !== 'object' || Array.isArray(d.states)) return null;
  for (const dim of dimensions) {
    const v = (d.states as Record<string, unknown>)[dim.key];
    if (typeof v !== 'string' || (v !== '' && !statuses.includes(v as typeof statuses[number]))) return null;
    base.states[dim.key] = v;
  }
  if (!['', ...outcomes].includes(base.overall) || !['', ...outcomes].includes(base.patient) || !['', ...metrics].includes(base.metric) || !['', ...scenes].includes(base.scene) || !['', ...users].includes(base.user) || !['', 'a', 'b'].includes(base.demo)) return null;
  if (!['', '37087370', '37029272'].includes(base.sourceId)) return null;
  return base;
}
export type ReportHighlight = { paragraph: number; text: string };
export type Report = { paragraphs: string[]; highlights?: ReportHighlight[] };
export function scoreNotes(data: Assessment): string {
  const s = calculate(data);
  return [
    s.na.length ? '不适用项计 0 分，完整性满分仍为 5 分。' : '',
    data.overall === '未报告' || data.patient === '未报告' ? '综合评价或患者报告结局的未报告项计 3 分，与等效选项分值相同、含义不同。' : '',
    data.metric === '未报告' ? '性能未报告计 0 分，效果评分按三项平均。' : '',
  ].join('');
}
export function factualReport(data: Assessment): Report {
  const s = calculate(data);
  const list = (items: typeof s.reported) => items.map(d => d.name).join('、') || '无';
  const performance = data.metric === '未报告' ? '当前填写中未提供主要性能指标' : `${data.metric}，数值为 ${s.numeric}`;
  return { paragraphs: [
    `研究 ${data.studyId} 使用${data.aiType}开展${data.disease}领域的${data.scene}，面向${data.user}。${data.metric === '未报告' ? '当前填写中未提供主要性能指标。' : `填写的主要性能指标为 ${data.metric}，数值为 ${s.numeric}。`}综合评价填写为${data.overall}，患者报告结局填写为${data.patient}。`,
    `现有填报记录中，${s.reported.length ? `已报告的维度包括${list(s.reported)}。` : '七个维度均无已报告项。'}${s.missing.length ? `${list(s.missing)}列为未报告。` : ''}${s.na.length ? `${list(s.na)}列为不适用。` : ''}证据完整性评分为 ${s.evidence?.toFixed(2)} / 5，模型效果评分为 ${s.effect?.toFixed(2)} / 5。`,
  ], highlights: [
    { paragraph: 0, text: performance },
    { paragraph: 1, text: `证据完整性评分为 ${s.evidence?.toFixed(2)} / 5` },
    { paragraph: 1, text: `模型效果评分为 ${s.effect?.toFixed(2)} / 5` },
  ] };
}
