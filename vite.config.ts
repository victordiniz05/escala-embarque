import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

/**
 * Política de segurança de conteúdo (CSP) do app publicado: só carrega scripts,
 * estilos, imagens e conexões do próprio endereço. O GitHub Pages não permite
 * cabeçalhos próprios, então vai como <meta>.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // React aplica estilos de largura (barras) via atributo; não executa código.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function seguranca(): Plugin {
  return {
    name: 'escala-seguranca',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <meta name="referrer" content="no-referrer" />`,
      );
    },
  };
}

// No GitHub Pages o app fica em https://<usuario>.github.io/escala-embarque/
const base = process.env.BASE_PATH ?? '/escala-embarque/';

// VITE_PREVIA=1 gera um único arquivo HTML, sem service worker, para pré-visualização.
const previa = process.env.VITE_PREVIA === '1';

export default defineConfig({
  base: previa ? './' : base,
  build: previa
    ? { outDir: 'dist-previa', assetsInlineLimit: Infinity, rolldownOptions: { output: { inlineDynamicImports: true } } }
    : undefined,
  plugins: [
    react(),
    !previa && seguranca(),
    tailwindcss(),
    !previa && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'icone.svg'],
      manifest: {
        name: 'Escala Embarque',
        short_name: 'Escala',
        description: 'Escala de embarque para marítimos offshore',
        lang: 'pt-BR',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b1f3a',
        theme_color: '#0b1f3a',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tudo o que o app precisa fica em cache: funciona sem internet a bordo.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // As telas de abertura do iPhone não precisam ir para o cache offline.
        globIgnores: ['**/splash/**'],
        navigateFallback: 'index.html',
      },
    }),
  ],
});
