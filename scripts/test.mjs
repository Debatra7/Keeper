import { build } from 'vite';
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

await build({
  build: {
    lib: {
      entry: 'src/lib/sync/sync.test.ts',
      formats: ['es'],
      fileName: () => 'sync.test.js',
    },
    outDir: 'dist-test',
    emptyOutDir: true,
    rollupOptions: {
      external: ['node:test', 'node:assert/strict'],
    },
  },
});

const result = spawnSync(process.execPath, ['dist-test/sync.test.js'], { stdio: 'inherit' });
try {
  rmSync('dist-test', { recursive: true, force: true });
} catch {
  // Ignore cleanup errors
}

process.exit(result.status ?? 0);
