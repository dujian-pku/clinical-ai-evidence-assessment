import type { Assessment, Report } from './assessment.ts';
import savedReports from './demo-reports.json' with { type: 'json' };

export const DEMO_DELAY_MS = 5000;
export const DEMO_REPORT_MODE = '演示报告 · DeepSeek 预先生成';
export const DEFAULT_DEMO_STUDY = '37029272';

const reports = savedReports as Record<string, { provider: string; sourceFile: string; input: Assessment; report: Report }>;

// Match the saved input as well as the study ID, so edited evidence never
// receives a narrative prepared for a different set of results.
export function preGeneratedReport(data: Assessment): Report | null {
  if (!Object.hasOwn(reports, data.sourceId)) return null;
  const saved = reports[data.sourceId];
  if (!saved) return null;
  const matches = (Object.keys(saved.input) as (keyof Assessment)[]).every(key => key === 'states'
    ? (Object.keys(saved.input.states) as (keyof Assessment['states'])[]).every(dimension => data.states[dimension] === saved.input.states[dimension])
    : data[key] === saved.input[key]);
  return matches ? structuredClone(saved.report) : null;
}
