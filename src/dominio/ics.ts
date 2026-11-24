import { diferencaDias, partes, somarDias, type DiaISO } from './datas';
import type { Categoria, DiaEscala } from './tipos';

/** Sequência contínua de dias da mesma situação (um evento na agenda). */
export interface Bloco {
  categoria: 'embarcado' | 'folga' | 'curso' | 'ferias' | 'afastamento';
  inicio: DiaISO;
  fim: DiaISO;
  dias: number;
  /** Só para embarcado: data do desembarque (pode ser o dia seguinte ao último a bordo). */
  desembarque?: DiaISO;
}

const tipoDoBloco = (c: Categoria): Bloco['categoria'] => (c === 'viagem' ? 'folga' : c);

/**
 * Agrupa os dias em blocos. `dias` deve ser contínuo; blocos que tocam
 * [de, ate] são devolvidos inteiros.
 */
export function blocosDaEscala(dias: readonly DiaEscala[], de: DiaISO, ate: DiaISO): Bloco[] {
  const blocos: Bloco[] = [];
  let atual: Bloco | null = null;
  for (let i = 0; i < dias.length; i++) {
    const d = dias[i]!;
    const cat = d.aBordo ? 'embarcado' : tipoDoBloco(d.categoria);
    if (atual && atual.categoria === cat) {
      atual.fim = d.data;
      atual.dias++;
    } else {
      if (atual) blocos.push(atual);
      atual = { categoria: cat, inicio: d.data, fim: d.data, dias: 1 };
    }
    if (d.marcos.includes('desembarque')) {
      // O desembarque pertence ao bloco a bordo que acabou de terminar (ou ao atual).
      const alvo = d.aBordo ? atual : [...blocos].reverse().find((b) => b.categoria === 'embarcado');
      if (alvo && alvo.categoria === 'embarcado' && diferencaDias(alvo.fim, d.data) <= 1) alvo.desembarque = d.data;
    }
  }
  if (atual) blocos.push(atual);
  return blocos.filter((b) => b.fim >= de && b.inicio <= ate);
}

export interface OpcoesIcs {
  incluirFolgas: boolean;
  embarcacao?: string;
  /** Instante da geração (UTC), para o DTSTAMP. */
  agora: Date;
}

const ROTULO: Record<Bloco['categoria'], string> = {
  embarcado: 'A bordo',
  folga: 'Folga',
  curso: 'Curso',
  ferias: 'Férias',
  afastamento: 'Afastamento',
};

function dataIcs(d: DiaISO): string {
  return d.replaceAll('-', '');
}

function curta(d: DiaISO): string {
  const p = partes(d);
  return `${String(p.dia).padStart(2, '0')}/${String(p.mes).padStart(2, '0')}/${p.ano}`;
}

/** Escapa texto conforme RFC 5545. */
export function escaparTexto(t: string): string {
  return t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Quebra linhas com mais de 75 bytes (RFC 5545), sem partir caracteres. */
export function dobrarLinha(linha: string): string {
  const enc = new TextEncoder();
  if (enc.encode(linha).length <= 75) return linha;
  const partesLinha: string[] = [];
  let atual = '';
  let limite = 75;
  for (const ch of linha) {
    if (enc.encode(atual + ch).length > limite) {
      partesLinha.push(atual);
      atual = ch;
      limite = 74; // linhas seguintes começam com um espaço
    } else {
      atual += ch;
    }
  }
  partesLinha.push(atual);
  return partesLinha.join('\r\n ');
}

function carimbo(agora: Date): string {
  return agora.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function gerarIcs(blocos: readonly Bloco[], opcoes: OpcoesIcs): string {
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Escala Embarque//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Escala Embarque',
    'X-WR-TIMEZONE:America/Sao_Paulo',
  ];
  const dtstamp = carimbo(opcoes.agora);
  for (const b of blocos) {
    if (b.categoria === 'folga' && !opcoes.incluirFolgas) continue;
    let titulo = ROTULO[b.categoria];
    let descricao = `${b.dias} ${b.dias === 1 ? 'dia' : 'dias'}: ${curta(b.inicio)} a ${curta(b.fim)}.`;
    if (b.categoria === 'embarcado') {
      if (opcoes.embarcacao) titulo += ` – ${opcoes.embarcacao}`;
      descricao = `${b.dias} dias a bordo. Embarque ${curta(b.inicio)}, desembarque ${curta(b.desembarque ?? b.fim)}.`;
    }
    linhas.push(
      'BEGIN:VEVENT',
      `UID:${b.categoria}-${dataIcs(b.inicio)}@escala-embarque`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${dataIcs(b.inicio)}`,
      // DTEND de dia inteiro é exclusivo: o dia seguinte ao último.
      `DTEND;VALUE=DATE:${dataIcs(somarDias(b.fim, 1))}`,
      `SUMMARY:${escaparTexto(titulo)}`,
      `DESCRIPTION:${escaparTexto(descricao)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  linhas.push('END:VCALENDAR');
  return linhas.map(dobrarLinha).join('\r\n') + '\r\n';
}

export function nomeArquivoIcs(hoje: DiaISO): string {
  return `escala-embarque-${hoje}.ics`;
}
