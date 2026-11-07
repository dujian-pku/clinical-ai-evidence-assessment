import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createAssessmentServer } from '../api/node-server.ts';
import { researchExample } from '../lib/research-examples.ts';

test('独立 Node 服务提供静态网页，保护配置文件并调用报告接口', async () => {
  const root = await mkdtemp(join(tmpdir(), 'clinical-ai-server-'));
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'index.html'), '<h1>assessment</h1>');
  await writeFile(join(root, 'assets/app.js'), 'console.log("ready")');
  await writeFile(join(root, '.env.production'), 'DO_NOT_SERVE');
  const paragraphs = ['甲', '乙', '丙', '丁'].map(label => label + '测试正文说明已有研究结果与后续评价问题，保持连续段落。'.repeat(5));
  const mockFetch = (async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ paragraphs }) } }] })) as typeof fetch;
  const env = { DEEPSEEK_API_KEY: 'server-test-key', REPORT_ACCESS_CODE: 'test-code', ALLOWED_ORIGINS: '' };
  const server = createAssessmentServer(env, root, mockFetch);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = 'http://127.0.0.1:' + address.port;
  env.ALLOWED_ORIGINS = origin;
  try {
    assert.match(await (await fetch(origin)).text(), /assessment/);
    assert.equal((await fetch(origin + '/assets/app.js')).status, 200);
    for (const path of ['/.env.production', '/api/node-server.ts', '/assets/%2e%2e/.env.production']) assert.equal((await fetch(origin + path)).status, 404);
    const headers = { origin, 'content-type': 'application/json', authorization: 'Bearer test-code' };
    const response = await fetch(origin + '/api/report', { method: 'POST', headers, body: JSON.stringify(researchExample('37029272')) });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).report.paragraphs, paragraphs);
    const denied = await fetch(origin + '/api/report', { method: 'POST', headers: { ...headers, authorization: 'wrong' }, body: '{}' });
    assert.equal(denied.status, 401);
    const oversized = await fetch(origin + '/api/report', { method: 'POST', headers, body: 'x'.repeat(20001) });
    assert.equal(oversized.status, 413);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
