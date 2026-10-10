import { defineConfig } from 'vite';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function smartTrainerPwa() {
  return {
    name: 'smart-trainer-pwa',
    apply: 'build',
    async closeBundle() {
      const root = process.cwd();
      const dist = path.join(root, 'dist');
      await mkdir(path.join(dist, 'assets', 'models'), { recursive: true });
      await Promise.all([
        cp(path.join(root, 'manifest.json'), path.join(dist, 'manifest.json')),
        cp(path.join(root, 'icon-192x192.png'), path.join(dist, 'icon-192x192.png')),
        cp(path.join(root, 'icon-512x512.png'), path.join(dist, 'icon-512x512.png')),
        cp(path.join(root, 'assets', 'models'), path.join(dist, 'assets', 'models'), { recursive: true }),
      ]);

      const collectFiles = async (directory, prefix = '') => {
        const entries = await readdir(directory, { withFileTypes: true });
        const nested = await Promise.all(entries.map(async (entry) => {
          const relative = path.posix.join(prefix, entry.name);
          if (entry.isDirectory()) return collectFiles(path.join(directory, entry.name), relative);
          return relative === 'sw.js' || relative.endsWith('.map') ? [] : [relative];
        }));
        return nested.flat();
      };

      const files = await collectFiles(dist);
      const precache = files
        .filter((file) => !file.endsWith('.glb') && !file.startsWith('server/'))
        .map((file) => `./${file}`);
      const template = await readFile(path.join(root, 'src', 'pwa', 'sw-template.js'), 'utf8');
      await writeFile(
        path.join(dist, 'sw.js'),
        template.replace('__PRECACHE_MANIFEST__', JSON.stringify(precache)),
      );
      await mkdir(path.join(dist, 'server'), { recursive: true });
      await writeFile(
        path.join(dist, 'server', 'index.js'),
        `export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== 'GET') return response;
    const url = new URL(request.url);
    url.pathname = url.pathname.replace(/[^/]*$/, 'index.html');
    return env.ASSETS.fetch(new Request(url, request));
  },
};
`,
      );
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('three')) return 'three';
          return undefined;
        },
      },
    },
  },
  plugins: [smartTrainerPwa()],
  test: {
    environment: 'node',
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
