import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { paraDateLocal, type DiaISO } from './dominio/datas';
import type { Categoria } from './dominio/tipos';

export function formatarDia(d: DiaISO, padrao: string): string {
  return format(paraDateLocal(d), padrao, { locale: ptBR });
}

/** Só a primeira letra maiúscula ("Terça-feira, 24 de novembro"). */
export function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "Terça-feira, 24 de novembro" */
export const porExtenso = (d: DiaISO) => capitalizar(formatarDia(d, "EEEE, d 'de' MMMM"));
/** "24/11/2026" */
export const curta = (d: DiaISO) => formatarDia(d, 'dd/MM/yyyy');
/** "Ter, 24 nov" */
export const compacta = (d: DiaISO) => capitalizar(formatarDia(d, 'EEE, d MMM'));
/** "24 nov" */
export const diaMes = (d: DiaISO) => formatarDia(d, 'd MMM');

export const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const ROTULO_CATEGORIA: Record<Categoria, string> = {
  embarcado: 'Embarcado',
  folga: 'Folga',
  viagem: 'Viagem',
};

export function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}
