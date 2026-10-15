import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Lists every built JS/CSS file (including lazily loaded chunks such as the backup zipper)
// so the service worker can precache the whole app for offline use.
const assetList = () => ({
  name: 'glimmer-asset-list',
  generateBundle(_options, bundle) {
    const files = Object.keys(bundle).filter((f) => f.startsWith('assets/'));
    this.emitFile({ type: 'asset', fileName: 'asset-list.json', source: JSON.stringify(files) });
  },
});

// base './' keeps every asset path relative, so the same build works on
// GitHub Pages (/<repo>/), Netlify, Vercel or any static host.
export default defineConfig({
  base: './',
  plugins: [react(), assetList()],
  // Preact's React-compatible layer: same code, roughly 40 KB smaller on her phone.
  resolve: {
    alias: {
      'react-dom/client': 'preact/compat/client',
      'react-dom': 'preact/compat',
      react: 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
    },
  },
  build: { target: 'safari15', assetsInlineLimit: 0 },
});
