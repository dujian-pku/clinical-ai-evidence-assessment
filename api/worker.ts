import { handleReport, type ReportEnvironment } from './report-handler.ts';

export default {
  async fetch(request: Request, env: ReportEnvironment) {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (url.pathname !== '/api/report') return new Response('Not found', { status: 404 });
    return handleReport(request, env);
  },
};
