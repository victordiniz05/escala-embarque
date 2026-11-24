// Gera um único arquivo HTML do app (sem service worker) para pré-visualização.
// Uso: VITE_PREVIA=1 npx vite build && node scripts/gerar-previa.mjs <saida.html>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const saida = process.argv[2] ?? 'dist-previa/escala-embarque.html';
const pasta = 'dist-previa/assets';
const arquivos = readdirSync(pasta);
const js = arquivos.filter((a) => a.endsWith('.js'));
const css = arquivos.filter((a) => a.endsWith('.css'));
if (js.length !== 1) throw new Error(`Esperava 1 arquivo JS, achei ${js.length}: ${js.join(', ')}`);

const codigo = readFileSync(join(pasta, js[0]), 'utf8').replaceAll('</script', '<\\/script');
const estilo = css.map((a) => readFileSync(join(pasta, a), 'utf8')).join('\n').replaceAll('</style', '<\\/style');

const html = `<title>Escala Embarque</title>
<meta name="apple-mobile-web-app-title" content="Escala">
<style>${estilo}</style>
<div id="root"></div>
<script type="module">${codigo}</script>
`;
writeFileSync(saida, html);
console.log(`${saida}: ${(html.length / 1024).toFixed(0)} KB`);
