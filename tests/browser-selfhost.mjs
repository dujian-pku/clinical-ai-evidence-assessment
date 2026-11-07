const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createAssessmentServer } from '../api/node-server.ts';

const paragraphs = ['甲', '乙', '丙', '丁'].map(label => label + '已有研究结果用于讨论评价问题。比较条件和病例构成关系到结果解释，后续研究可进一步核实判读流程和错误分布。'.repeat(3));
const highlights = paragraphs.map((p, paragraph) => ({ paragraph, text: '比较条件和病例构成关系到结果解释' }));
const mockFetch = async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ paragraphs, highlights }) } }] });
const env = { DEEPSEEK_API_KEY: 'server-test-key', REPORT_ACCESS_CODE: 'browser-test-code', ALLOWED_ORIGINS: '' };
const server = createAssessmentServer(env, fileURLToPath(new URL('../dist', import.meta.url)), mockFetch);
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = 'http://127.0.0.1:' + server.address().port;
env.ALLOWED_ORIGINS = origin;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.locator('.examples-picker > summary').click();
  await page.getByRole('button', { name: '颅内出血研究', exact: true }).click();
  assert.match(await page.locator('.score-number').nth(0).innerText(), /1.25/);
  assert.match(await page.locator('.score-number').nth(1).innerText(), /3.62/);
  await page.getByRole('button', { name: '生成评估报告', exact: true }).click();
  assert.match(await page.getByRole('alert').innerText(), /报告访问码/);
  await page.getByLabel('报告访问码', { exact: true }).fill(env.REPORT_ACCESS_CODE);
  await page.getByRole('button', { name: '生成评估报告', exact: true }).click();
  await page.locator('#report').waitFor();
  assert.equal(await page.locator('.report-highlight').count(), 4);
  assert.deepEqual(await page.locator('.report-body > p').allTextContents(), paragraphs);
  await page.getByRole('button', { name: '保存本机', exact: true }).click();
  assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes(env.REPORT_ACCESS_CODE));
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 TXT', exact: true }).click();
  const stream = await (await downloaded).createReadStream();
  let exported = '';
  for await (const chunk of stream) exported += chunk.toString();
  assert.ok(exported.includes(paragraphs[0]) && exported.includes('3.62 / 5'));
  assert.ok(!exported.includes(env.REPORT_ACCESS_CODE));
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'passed', checks: ['standalone server', 'real study scores', 'access code', 'report paragraphs and highlights', 'TXT export', 'no access code in saved data', 'responsive layout'] }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
