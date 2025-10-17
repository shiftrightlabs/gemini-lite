/**
 * esbuild configuration for gemini-lite
 * Bundles the TypeScript output for distribution
 */

import { build } from 'esbuild';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

await build({
  entryPoints: ['./dist/index.js'],
  bundle: true, // Bundle with external dependencies
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: './dist',
  allowOverwrite: true,
  minify: false, // Keep readable for auditing
  sourcemap: true,
  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ],
});

console.log('✅ esbuild complete');
