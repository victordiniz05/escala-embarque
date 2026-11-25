// Regra do projeto: datas do dia a dia são strings 'yyyy-MM-dd' (DiaISO) e as
// contas ficam em src/dominio/datas.ts. Fora dele, `new Date('2026-01-01')`
// vira meia-noite UTC = dia anterior no Brasil. Esta checagem barra:
//   - new Date(...) com argumento   (new Date() sem argumento, "agora", é permitido)
//   - Date.parse(...)
// Exceção: a linha (ou a anterior) com o comentário `datas-ok: <motivo>`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = 'src';
const PERMITIDOS = new Set(['src/dominio/datas.ts']);
const PROIBIDO = [
  { re: /new\s+Date\s*\(\s*[^)\s]/, msg: 'new Date(...) com argumento' },
  { re: /\bDate\.parse\s*\(/, msg: 'Date.parse(...)' },
];

function arquivos(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return nome === '__tests__' ? [] : arquivos(caminho);
    return /\.(ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

const problemas = [];
for (const arquivo of arquivos(RAIZ)) {
  const rel = relative('.', arquivo).replaceAll('\\', '/');
  if (PERMITIDOS.has(rel)) continue;
  const linhas = readFileSync(arquivo, 'utf8').split('\n');
  linhas.forEach((linha, i) => {
    const liberada = /datas-ok:/.test(linha) || /datas-ok:/.test(linhas[i - 1] ?? '');
    for (const { re, msg } of PROIBIDO) {
      if (re.test(linha) && !liberada) problemas.push(`${rel}:${i + 1}  ${msg}\n    ${linha.trim()}`);
    }
  });
}

if (problemas.length > 0) {
  console.error('Uso de Date fora de src/dominio/datas.ts (risco de erro de fuso/virada de dia):\n');
  console.error(problemas.join('\n'));
  console.error('\nUse as funções de src/dominio/datas.ts ou justifique com o comentário `// datas-ok: <motivo>`.');
  process.exit(1);
}
console.log('Datas: nenhum uso arriscado de Date encontrado.');
