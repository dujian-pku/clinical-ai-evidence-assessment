import { build } from 'esbuild';

await build({
  entryPoints: ['api/worker.ts'], outfile: 'outputs/worker/index.js',
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
  sourcemap: false, legalComments: 'none',
});
console.log('Built report service: outputs/worker/index.js');
