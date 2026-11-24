import { diaDaSemana, partes } from '../dominio/datas';
import type { DiaMostrado as DiaEscala } from '../dominio/historico';
import type { Categoria } from '../dominio/tipos';

/** Cores fixas (tema claro) para a imagem ficar legível no WhatsApp. */
const FUNDO: Record<Categoria, string> = {
  embarcado: '#2563eb',
  folga: '#d1fae5',
  viagem: '#fef3c7',
  curso: '#ede9fe',
  ferias: '#e0f2fe',
  afastamento: '#ffe4e6',
};
const TEXTO: Record<Categoria, string> = {
  embarcado: '#ffffff',
  folga: '#064e3b',
  viagem: '#78350f',
  curso: '#4c1d95',
  ferias: '#0c4a6e',
  afastamento: '#881337',
};
const ROTULO: Record<Categoria, string> = {
  embarcado: 'Embarcado',
  folga: 'Folga',
  viagem: 'Viagem',
  curso: 'Curso',
  ferias: 'Férias',
  afastamento: 'Afastamento',
};
const ORDEM: Categoria[] = ['embarcado', 'folga', 'viagem', 'curso', 'ferias', 'afastamento'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const FONTE = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const TINTA = '#0f172a';
const TINTA_SUAVE = '#64748b';

/** Semanas do mês (domingo a sábado), com `null` nos dias fora do mês. */
export function semanasDoMes<T extends { data: string }>(dias: readonly T[]): (T | null)[][] {
  if (dias.length === 0) return [];
  const celulas: (T | null)[] = [...Array(diaDaSemana(dias[0]!.data as never)).fill(null), ...dias];
  while (celulas.length % 7 !== 0) celulas.push(null);
  const semanas: (T | null)[][] = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

const FORA = { fundo: '#f1f5f9', texto: '#94a3b8' };
const fundo = (d: DiaEscala) => (d.foraDaEscala ? FORA.fundo : FUNDO[d.categoria]);
const texto = (d: DiaEscala) => (d.foraDaEscala ? FORA.texto : TEXTO[d.categoria]);

function contar(dias: readonly DiaEscala[]): Map<Categoria, number> {
  const m = new Map<Categoria, number>();
  for (const d of dias) if (!d.foraDaEscala) m.set(d.categoria, (m.get(d.categoria) ?? 0) + 1);
  return m;
}

function arredondado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function criarCanvas(largura: number, altura: number) {
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível gerar a imagem neste aparelho.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, largura, altura);
  ctx.textBaseline = 'middle';
  return { canvas, ctx };
}

function legenda(ctx: CanvasRenderingContext2D, dias: readonly DiaEscala[], x: number, y: number, largura: number) {
  const contagem = contar(dias);
  ctx.font = `500 30px ${FONTE}`;
  ctx.textAlign = 'left';
  let cx = x;
  let cy = y;
  for (const c of ORDEM) {
    const n = contagem.get(c);
    if (!n) continue;
    const texto = `${ROTULO[c]}: ${n}`;
    const w = 40 + ctx.measureText(texto).width + 36;
    if (cx + w > x + largura) {
      cx = x;
      cy += 52;
    }
    ctx.fillStyle = FUNDO[c];
    arredondado(ctx, cx, cy - 14, 28, 28, 6);
    ctx.fill();
    if (c !== 'embarcado') {
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = TINTA;
    ctx.fillText(texto, cx + 40, cy);
    cx += w;
  }
  return cy;
}

function rodape(ctx: CanvasRenderingContext2D, largura: number, altura: number) {
  ctx.font = `400 24px ${FONTE}`;
  ctx.fillStyle = TINTA_SUAVE;
  ctx.textAlign = 'center';
  ctx.fillText('Feito com Escala Embarque', largura / 2, altura - 36);
}

function cabecalho(ctx: CanvasRenderingContext2D, titulo: string, subtitulo: string, margem: number) {
  ctx.textAlign = 'left';
  ctx.fillStyle = TINTA;
  ctx.font = `700 64px ${FONTE}`;
  ctx.fillText(titulo, margem, 96);
  if (subtitulo) {
    ctx.fillStyle = TINTA_SUAVE;
    ctx.font = `400 32px ${FONTE}`;
    ctx.fillText(subtitulo, margem, 156);
  }
}

/** Imagem de um mês (1080 px de largura). */
export function desenharMes(dias: readonly DiaEscala[], subtitulo: string): HTMLCanvasElement {
  const { ano, mes } = partes(dias[0]!.data as never);
  const semanas = semanasDoMes(dias);
  const L = 1080;
  const margem = 60;
  const gap = 12;
  const celula = (L - 2 * margem - 6 * gap) / 7;
  const topoGrade = 250;
  const alturaGrade = semanas.length * (celula + gap);
  const A = topoGrade + alturaGrade + 200;
  const { canvas, ctx } = criarCanvas(L, A);

  cabecalho(ctx, `${MESES[mes - 1]} ${ano}`, subtitulo, margem);

  ctx.font = `600 28px ${FONTE}`;
  ctx.fillStyle = TINTA_SUAVE;
  ctx.textAlign = 'center';
  SEMANA.forEach((s, i) => ctx.fillText(s, margem + i * (celula + gap) + celula / 2, topoGrade - 30));

  semanas.forEach((semana, l) =>
    semana.forEach((d, c) => {
      if (!d) return;
      const x = margem + c * (celula + gap);
      const y = topoGrade + l * (celula + gap);
      ctx.fillStyle = fundo(d);
      arredondado(ctx, x, y, celula, celula, 18);
      ctx.fill();
      ctx.fillStyle = texto(d);
      ctx.font = `700 44px ${FONTE}`;
      ctx.textAlign = 'center';
      ctx.fillText(String(partes(d.data as never).dia), x + celula / 2, y + celula / 2 + 2);
      if (!d.foraDaEscala && d.marcos.length > 0) {
        // Troca de turma: marcador no canto.
        ctx.fillStyle = d.aBordo ? '#ffffff' : '#2563eb';
        ctx.beginPath();
        ctx.arc(x + celula - 18, y + 18, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }),
  );

  const yLegenda = legenda(ctx, dias, margem, topoGrade + alturaGrade + 40, L - 2 * margem);
  ctx.font = `400 26px ${FONTE}`;
  ctx.fillStyle = TINTA_SUAVE;
  ctx.textAlign = 'left';
  ctx.beginPath();
  ctx.fillStyle = '#2563eb';
  ctx.arc(margem + 14, yLegenda + 56, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = TINTA_SUAVE;
  ctx.fillText('Troca de turma (embarque/desembarque)', margem + 40, yLegenda + 56);
  rodape(ctx, L, A);
  return canvas;
}

/** Imagem do ano: 12 meses em 3 colunas (1080 px de largura). */
export function desenharAno(meses: readonly (readonly DiaEscala[])[], ano: number, subtitulo: string): HTMLCanvasElement {
  const L = 1080;
  const margem = 48;
  const colunas = 3;
  const gapMes = 36;
  const larguraMes = (L - 2 * margem - (colunas - 1) * gapMes) / colunas;
  const gap = 4;
  const celula = (larguraMes - 6 * gap) / 7;
  const alturaMes = 50 + 6 * (celula + gap);
  const topo = 210;
  const linhas = Math.ceil(meses.length / colunas);
  const A = topo + linhas * (alturaMes + 28) + 190;
  const { canvas, ctx } = criarCanvas(L, A);

  const aBordo = meses.flat().filter((d) => d.aBordo && !d.foraDaEscala).length;
  cabecalho(ctx, `Escala ${ano}`, subtitulo ? `${subtitulo} · ${aBordo} dias a bordo` : `${aBordo} dias a bordo`, margem);

  meses.forEach((dias, i) => {
    if (dias.length === 0) return;
    const x0 = margem + (i % colunas) * (larguraMes + gapMes);
    const y0 = topo + Math.floor(i / colunas) * (alturaMes + 28);
    ctx.textAlign = 'left';
    ctx.fillStyle = TINTA;
    ctx.font = `700 28px ${FONTE}`;
    ctx.fillText(MESES[i]!, x0, y0 + 16);
    semanasDoMes(dias).forEach((semana, l) =>
      semana.forEach((d, c) => {
        if (!d) return;
        const x = x0 + c * (celula + gap);
        const y = y0 + 44 + l * (celula + gap);
        ctx.fillStyle = fundo(d);
        arredondado(ctx, x, y, celula, celula, 5);
        ctx.fill();
        ctx.fillStyle = texto(d);
        ctx.font = `600 16px ${FONTE}`;
        ctx.textAlign = 'center';
        ctx.fillText(String(partes(d.data as never).dia), x + celula / 2, y + celula / 2 + 1);
      }),
    );
  });

  legenda(ctx, meses.flat(), margem, A - 140, L - 2 * margem);
  rodape(ctx, L, A);
  return canvas;
}

export function canvasParaPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((ok, falha) =>
    canvas.toBlob((b) => (b ? ok(b) : falha(new Error('Não foi possível gerar a imagem.'))), 'image/png'),
  );
}
