import { createAssessmentServer } from '../api/node-server.ts';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
for (const key of ['DEEPSEEK_API_KEY', 'REPORT_ACCESS_CODE', 'ALLOWED_ORIGINS']) {
  if (!process.env[key]) throw new Error('Missing server configuration: ' + key);
}
const root = fileURLToPath(new URL('../dist', import.meta.url));
const server = createAssessmentServer(process.env, root);
server.listen(port, host, () => console.log('Assessment server listening on http://' + host + ':' + port));
