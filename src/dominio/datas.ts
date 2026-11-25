/**
 * Datas "puras" (dia do calendário, sem hora e sem fuso).
 *
 * Todo dia do app é uma string `yyyy-MM-dd` (DiaISO). As contas são feitas com
 * um inteiro "dias desde 1970-01-01" calculado com Date.UTC, que não depende
 * do fuso do aparelho nem de horário de verão.
 *
 * Regra do projeto: nunca usar `new Date('2026-01-01')` (isso é meia-noite UTC
 * e vira o dia anterior no Brasil). Use as funções daqui.
 */

export type DiaISO = string & { readonly __marca: 'DiaISO' };

export const FUSO_PADRAO = 'America/Sao_Paulo';

const MS_DIA = 86_400_000;
const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

function dois(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function quatro(n: number): string {
  return String(n).padStart(4, '0');
}

/** Monta um DiaISO a partir de ano, mês (1–12) e dia, validando a data. */
export function criarDia(ano: number, mes: number, dia: number): DiaISO {
  const n = Math.round(Date.UTC(ano, mes - 1, dia) / MS_DIA);
  const resultado = deNumero(n);
  const p = partes(resultado);
  if (p.ano !== ano || p.mes !== mes || p.dia !== dia) {
    throw new RangeError(`Data inválida: ${ano}-${mes}-${dia}`);
  }
  return resultado;
}

/** Valida e converte uma string `yyyy-MM-dd` em DiaISO. */
export function diaISO(texto: string): DiaISO {
  const m = FORMATO.exec(texto);
  if (!m) throw new RangeError(`Formato de data inválido: "${texto}"`);
  return criarDia(Number(m[1]), Number(m[2]), Number(m[3]));
}

export function ehDiaISO(texto: string): texto is DiaISO {
  try {
    diaISO(texto);
    return true;
  } catch {
    return false;
  }
}

export function partes(d: DiaISO): { ano: number; mes: number; dia: number } {
  return {
    ano: Number(d.slice(0, 4)),
    mes: Number(d.slice(5, 7)),
    dia: Number(d.slice(8, 10)),
  };
}

/** Dias desde 1970-01-01 (pode ser negativo). */
export function paraNumero(d: DiaISO): number {
  const { ano, mes, dia } = partes(d);
  return Math.round(Date.UTC(ano, mes - 1, dia) / MS_DIA);
}

export function deNumero(n: number): DiaISO {
  const u = new Date(n * MS_DIA);
  return `${quatro(u.getUTCFullYear())}-${dois(u.getUTCMonth() + 1)}-${dois(u.getUTCDate())}` as DiaISO;
}

export function somarDias(d: DiaISO, dias: number): DiaISO {
  return deNumero(paraNumero(d) + dias);
}

/** Quantos dias de `de` até `ate` (positivo se `ate` for depois). */
export function diferencaDias(de: DiaISO, ate: DiaISO): number {
  return paraNumero(ate) - paraNumero(de);
}

/** Como o formato é fixo, comparar strings já ordena corretamente. */
export function compararDias(a: DiaISO, b: DiaISO): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function menorDia(a: DiaISO, b: DiaISO): DiaISO {
  return a <= b ? a : b;
}

export function maiorDia(a: DiaISO, b: DiaISO): DiaISO {
  return a >= b ? a : b;
}

/** Resto sempre positivo: modPositivo(-1, 56) = 55. */
export function modPositivo(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** 0 = domingo … 6 = sábado. 1970-01-01 foi uma quinta-feira (4). */
export function diaDaSemana(d: DiaISO): number {
  return modPositivo(paraNumero(d) + 4, 7);
}

export function diasNoMes(ano: number, mes: number): number {
  return Math.round((Date.UTC(ano, mes, 1) - Date.UTC(ano, mes - 1, 1)) / MS_DIA);
}

export function ehBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

export function primeiroDiaDoMes(ano: number, mes: number): DiaISO {
  return criarDia(ano, mes, 1);
}

export function ultimoDiaDoMes(ano: number, mes: number): DiaISO {
  return criarDia(ano, mes, diasNoMes(ano, mes));
}

/** Soma meses a um par (ano, mês), tratando a virada de ano. */
export function somarMeses(ano: number, mes: number, meses: number): { ano: number; mes: number } {
  const total = ano * 12 + (mes - 1) + meses;
  return { ano: Math.floor(total / 12), mes: modPositivo(total, 12) + 1 };
}

/** Lista de dias de `inicio` a `fim`, inclusive. */
export function intervaloDeDias(inicio: DiaISO, fim: DiaISO): DiaISO[] {
  const a = paraNumero(inicio);
  const b = paraNumero(fim);
  const dias: DiaISO[] = [];
  for (let n = a; n <= b; n++) dias.push(deNumero(n));
  return dias;
}

/**
 * O dia de hoje no fuso indicado (padrão: America/Sao_Paulo),
 * independente do fuso configurado no iPhone.
 */
export function hoje(fuso: string = FUSO_PADRAO, agora: Date = new Date()): DiaISO {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const p = Object.fromEntries(fmt.formatToParts(agora).map((x) => [x.type, x.value]));
  return criarDia(Number(p.year), Number(p.month), Number(p.day));
}

/** Dia (no fuso indicado) de um instante ISO completo, ex.: '2026-11-24T15:00:00.000Z'. */
export function diaDoInstante(iso: string, fuso: string = FUSO_PADRAO): DiaISO {
  return hoje(fuso, new Date(iso));
}

/**
 * Converte para Date à meia-noite LOCAL, apenas para formatar com date-fns.
 * Não use o resultado para fazer contas.
 */
export function paraDateLocal(d: DiaISO): Date {
  const { ano, mes, dia } = partes(d);
  return new Date(ano, mes - 1, dia);
}
