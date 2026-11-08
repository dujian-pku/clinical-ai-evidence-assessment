const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createAssessmentServer } from '../api/node-server.ts';

let upstreamCalls = 0;
const mockFetch = async () => { upstreamCalls++; throw new Error('演示页面不应调用模型'); };
const env = { ALLOWED_ORIGINS: '' };
const server = createAssessmentServer(env, fileURLToPath(new URL('../dist', import.meta.url)), mockFetch);
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = 'http://127.0.0.1:' + server.address().port;
env.ALLOWED_ORIGINS = origin;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (['fetch', 'xhr'].includes(request.resourceType())) requests.push(request.url());
  });
  const output = new URL('../outputs/', import.meta.url);
  await fs.mkdir(output, { recursive: true });
  await page.goto(origin, { waitUntil: 'networkidle' });
  assert.equal(await page.getByLabel('研究 / 注册编号', { exact: true }).inputValue(), 'PMID:37029272');
  assert.equal(await page.getByLabel('报告访问码', { exact: true }).count(), 0);
  assert.match(await page.locator('.score-number').nth(0).innerText(), /1.25/);
  assert.match(await page.locator('.score-number').nth(1).innerText(), /3.62/);
  const start = performance.now();
  await page.getByRole('button', { name: '生成评估报告', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '正在生成报告…', exact: true }).isDisabled(), true);
  await page.screenshot({ path: new URL('demo-report-loading.png', output).pathname, fullPage: true });
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('#report').count(), 0);
  await page.locator('#report').waitFor({ timeout: 10000 });
  const elapsed = performance.now() - start;
  assert.ok(elapsed >= 4900 && elapsed < 15000, 'actual demo delay: ' + elapsed);
  assert.equal(await page.locator('.report-body > p').count(), 4);
  assert.equal(await page.locator('.report-highlight').count(), 5);
  assert.match(await page.locator('.report-body').innerText(), /0.9703/);
  assert.match(await page.locator('.report-header').innerText(), /演示报告 · DeepSeek 生成/);
  await page.locator('#report').screenshot({ path: new URL('demo-report-complete.png', output).pathname });
  await page.getByRole('button', { name: '保存本机', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 TXT', exact: true }).click();
  const stream = await (await downloaded).createReadStream();
  let exported = '';
  for await (const chunk of stream) exported += chunk.toString();
  assert.ok(exported.includes('0.9703') && exported.includes('3.62 / 5'));
  assert.ok(exported.includes('演示报告 · DeepSeek 生成') && exported.includes('展示时间：'));

  // Switching the study during the delay cancels the previous report.
  await page.getByRole('button', { name: '生成评估报告', exact: true }).click();
  await page.locator('.examples-picker > summary').click();
  await page.getByRole('button', { name: '口咽癌研究', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '生成评估报告', exact: true }).isDisabled(), false);
  await page.waitForTimeout(5200);
  assert.equal(await page.locator('#report').count(), 0);
  await page.getByRole('button', { name: '生成评估报告', exact: true }).click();
  await page.locator('#report').waitFor({ timeout: 10000 });
  assert.match(await page.locator('.report-body').innerText(), /E3311/);
  assert.match(await page.locator('.report-body').innerText(), /0.86/);
  assert.equal(await page.locator('.report-highlight').count(), 4);

  // Edited evidence keeps its own scoring/brief report, without a stale narrative.
  await page.getByRole('button', { name: '生成评估报告', exact: true }).click();
  await page.getByLabel('疾病领域', { exact: true }).fill('修改后的研究疾病');
  assert.equal(await page.getByRole('button', { name: '生成评估报告', exact: true }).isDisabled(), false);
  await page.waitForTimeout(5200);
  assert.equal(await page.locator('#report').count(), 0);
  await page.getByRole('button', { name: '生成评估报告', exact: true }).click();
  assert.match(await page.getByRole('alert').innerText(), /重新载入一项研究示例/);
  await page.getByRole('button', { name: '生成简版报告', exact: true }).click();
  assert.match(await page.locator('.report-body').innerText(), /修改后的研究疾病/);
  assert.ok(!(await page.locator('.report-header').innerText()).includes('DeepSeek'));
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  assert.deepEqual(requests, []);
  assert.equal(upstreamCalls, 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'passed', elapsed, checks: ['5-second demo delay', 'both pre-generated research reports', 'attribution and export', 'cancel on study switch or edits', 'custom brief report', 'no API requests', 'responsive layout'] }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
