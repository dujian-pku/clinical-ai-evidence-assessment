import { decodeAssessment, validate } from '../lib/assessment.ts';
import { decodeNarrativeReport, reportContext, REPORT_SYSTEM_PROMPT } from '../lib/report.ts';

export type ReportEnvironment = {
  DEEPSEEK_API_KEY?: string;
  REPORT_ACCESS_CODE?: string;
  ALLOWED_ORIGINS?: string;
};
const requests = new Map<string, { started: number; count: number }>();

export async function handleReport(request: Request, env: ReportEnvironment, upstreamFetch: typeof fetch = fetch) {
  const origin = request.headers.get('origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  const originAllowed = allowed.includes(origin);
  const headers: Record<string, string> = {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin',
    ...(originAllowed ? { 'Access-Control-Allow-Origin': origin } : {}),
  };
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (!originAllowed) return json({ error: '请从评估网页提交请求。' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
    ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600',
  } });
  if (request.method !== 'POST') return json({ error: '请求方式无效。' }, 405);
  const now = Date.now();
  for (const [key, value] of requests) if (now - value.started > 60000) requests.delete(key);
  const key = request.headers.get('cf-connecting-ip') || 'local';
  if (requests.size >= 1000 && !requests.has(key)) return json({ error: '服务繁忙，请稍后再试。' }, 429);
  const counter = requests.get(key) || { started: now, count: 0 };
  if (counter.count >= 6) return json({ error: '请求较频繁，请一分钟后重试。' }, 429);
  counter.count++; requests.set(key, counter);
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey || !env.REPORT_ACCESS_CODE) return json({ error: '报告服务尚未配置。可先生成简版报告。' }, 503);
  if (request.headers.get('authorization') !== 'Bearer ' + env.REPORT_ACCESS_CODE) {
    return json({ error: '报告访问码不正确，请重新填写。' }, 401);
  }
  if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: '请提交 JSON 格式的评估信息。' }, 415);
  if (Number(request.headers.get('content-length')) > 20000) return json({ error: '填写内容过长。' }, 413);
  let raw: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 20000) return json({ error: '填写内容过长。' }, 413);
    raw = JSON.parse(text);
  } catch { return json({ error: '填写内容格式无效。' }, 400); }
  const data = decodeAssessment(raw);
  if (!data) return json({ error: '填写内容或选项格式无效。' }, 400);
  const errors = validate(data);
  if (errors.length) return json({ error: errors.join(' ') }, 400);
  const context = reportContext(data);
  try {
    const upstream = await upstreamFetch('https://api.deepseek.com/chat/completions', {
      method: 'POST', headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'deepseek-flash', thinking: { type: 'enabled' }, reasoning_effort: 'high', max_tokens: 8192, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: REPORT_SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify(context) }] }),
      signal: AbortSignal.timeout(75000),
    });
    if (!upstream.ok) {
      const error = upstream.status === 401 ? 'AI 接口认证失败，请检查服务端密钥。' : upstream.status === 402 ? 'AI 接口账户余额不足。' : upstream.status === 429 ? 'AI 接口繁忙，请稍后重试。' : 'AI 接口暂时不可用，请稍后重试。';
      return json({ error: error + ' 可先生成简版报告。' }, 502);
    }
    const result = await upstream.json() as { choices?: { finish_reason?: string; message?: { content?: string } }[] };
    const choice = result.choices?.[0];
    if (choice?.finish_reason !== 'stop') throw new Error('incomplete_report');
    const report = decodeNarrativeReport(JSON.parse(choice.message?.content || '{}'), context);
    if (!report) throw new Error('invalid_report');
    return json({ report, mode: '综合评估报告 · DeepSeek' });
  } catch {
    return json({ error: 'AI 接口超时或返回格式异常，请重试。也可先生成简版报告。' }, 502);
  }
}
