import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const r = (p: string) => resolve(__dirname, p);

export default defineConfig({
  resolve: {
    alias: {
      '@': r('src'),
      '@wallet-adapter': r('src/adapters/wallet-adapter'),
      '@features': r('src/features'),
      '@adapters': r('src/adapters'),
      '@shared': r('src/shared'),
      '@components': r('src/components'),
      '@pages': r('src/pages'),
      '@main': r('src/main'),
      '@Layout': r('src/Layout')
    }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    css: true
  }
});
