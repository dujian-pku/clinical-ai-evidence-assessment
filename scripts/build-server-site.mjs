import { build } from 'vite';
process.env.VITE_REPORT_API_URL = '/api/report';
process.env.PAGES_BASE_PATH = '/';
await build();
