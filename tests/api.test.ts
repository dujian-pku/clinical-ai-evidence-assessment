import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleReport } from '../api/report-handler.ts';
import { researchExample } from '../lib/research-examples.ts';

const env = { DEEPSEEK_API_KEY: 'test-server-secret', REPORT_ACCESS_CODE: 'test-access-code', ALLOWED_ORIGINS: 'https://dujian-pku.github.io' };
let requestNumber = 0;
function request(overrides: RequestInit = {}, headers: Record<string, string> = {}) {
  return new Request('https://worker.example/api/report', { method: 'POST', body: JSON.stringify(researchExample('37029272')), ...overrides,
    headers: { origin: env.ALLOWED_ORIGINS, 'content-type': 'application/json', authorization: 'Bearer ' + env.REPORT_ACCESS_CODE, 'cf-connecting-ip': 'test-' + (++requestNumber), ...headers },
  });
}

test('报告接口仅允许指定来源，预检允许访问码请求头', async () => {
  const accepted = await handleReport(request({ method: 'OPTIONS', body: undefined }), env);
  assert.equal(accepted.status, 204);
  assert.equal(accepted.headers.get('access-control-allow-origin'), env.ALLOWED_ORIGINS);
  assert.match(accepted.headers.get('access-control-allow-headers')!, /Authorization/);
  for (const origin of ['', 'https://dujian-pku.github.io.evil.example', 'https://example.com']) {
    const denied = await handleReport(request({}, { origin }), env);
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  }
});

test('访问码和输入校验失败时不调用 DeepSeek，错误响应可跨域读取', async () => {
  const unused = (async () => { assert.fail('unexpected upstream call'); }) as typeof fetch;
  const denied = await handleReport(request({}, { authorization: 'Bearer wrong' }), env, unused);
  assert.equal(denied.status, 401);
  assert.equal(denied.headers.get('access-control-allow-origin'), env.ALLOWED_ORIGINS);
  assert.equal((await handleReport(request(), { ...env, REPORT_ACCESS_CODE: '' }, unused)).status, 503);
  assert.equal((await handleReport(request({ body: '{}' }), env, unused)).status, 400);
  assert.equal((await handleReport(request({ body: 'x'.repeat(20001) }), env, unused)).status, 413);
  assert.equal((await handleReport(request({}, { 'content-type': 'text/plain' }), env, unused)).status, 415);
});

test('服务端调用保留正文与高亮，密钥和思考内容不进入响应', async () => {
  const paragraphs = ['甲', '乙', '丙', '丁'].map(label => label + '测试正文说明已有研究结果与后续评价问题，保持连续段落。'.repeat(5));
  const highlights = [{ paragraph: 0, text: '已有研究结果与后续评价问题' }];
  const upstream = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer ' + env.DEEPSEEK_API_KEY);
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.model, 'deepseek-flash');
    assert.ok(!JSON.stringify(payload).includes(env.REPORT_ACCESS_CODE));
    return Response.json({ choices: [{ finish_reason: 'stop', message: { reasoning_content: 'private reasoning', content: JSON.stringify({ paragraphs, highlights }) } }] });
  }) as typeof fetch;
  const response = await handleReport(request(), env, upstream);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.report, { paragraphs, highlights });
  assert.ok(!JSON.stringify(body).includes('private reasoning'));
  assert.ok(!JSON.stringify(body).includes(env.DEEPSEEK_API_KEY));
  const incomplete = (async () => Response.json({ choices: [{ finish_reason: 'length' }] })) as typeof fetch;
  assert.equal((await handleReport(request(), env, incomplete)).status, 502);
});

test('错误访问码计入请求频次', async () => {
  const headers = { authorization: 'wrong', 'cf-connecting-ip': 'rate-limit-test' };
  for (let i = 0; i < 6; i++) assert.equal((await handleReport(request({}, headers), env)).status, 401);
  assert.equal((await handleReport(request({}, headers), env)).status, 429);
});
