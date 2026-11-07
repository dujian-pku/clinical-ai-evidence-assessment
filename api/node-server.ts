import { createServer, type IncomingMessage } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { handleReport, type ReportEnvironment } from './report-handler.ts';

export function createAssessmentServer(env: ReportEnvironment, staticDirectory: string, upstreamFetch: typeof fetch = fetch) {
  const root = resolve(staticDirectory);
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end('{"status":"ok"}'); return;
      }
      if (url.pathname === '/api/report') {
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(',') : value);
        // Client-supplied forwarding headers do not determine the request limit.
        headers.set('cf-connecting-ip', req.socket.remoteAddress || 'local');
        let body: string | undefined;
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method || 'GET')) body = await readBody(req);
        const request = new Request(url, { method: req.method, headers, body });
        const response = await handleReport(request, env, upstreamFetch);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(await response.text()); return;
      }
      if (!['GET', 'HEAD'].includes(req.method || 'GET')) { res.writeHead(405); res.end(); return; }
      const pathname = decodeURIComponent(url.pathname);
      const asset = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      if (!(asset === 'index.html' || asset === 'favicon.svg' || /^assets\/[A-Za-z0-9._/-]+\.(js|css|woff2?|png|svg)$/.test(asset))) {
        res.writeHead(404); res.end('Not found'); return;
      }
      const file = resolve(root, asset);
      if (!file.startsWith(root + sep)) { res.writeHead(404); res.end('Not found'); return; }
      const content = await readFile(file);
      const type = file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : file.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': file.endsWith('.html') ? 'no-cache' : 'public, max-age=3600' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === 'payload_too_large';
      res.writeHead(tooLarge ? 413 : 404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: tooLarge ? '填写内容过长。' : '请求资源不存在。' }));
    }
  });
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 20000) throw new Error('payload_too_large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}
