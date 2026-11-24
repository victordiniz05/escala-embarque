import type { AlertaEvento, Disponibilidade, ResultadoEvento } from '../../dominio/eventos';
import { compacta, plural } from '../../formatacao';

export const ROTULO_DISPONIBILIDADE: Record<Disponibilidade, string> = {
  livre: 'De folga',
  atencao: 'De folga, com atenção',
  parcial: 'Parcialmente embarcado',
  embarcado: 'Embarcado',
};

export const COR_DISPONIBILIDADE: Record<Disponibilidade, { cartao: string; selo: string }> = {
  livre: {
    cartao: 'bg-emerald-50 ring-emerald-200 text-emerald-950 dark:bg-emerald-950/40 dark:ring-emerald-900 dark:text-emerald-50',
    selo: 'bg-folga text-white',
  },
  atencao: {
    cartao: 'bg-amber-50 ring-amber-200 text-amber-950 dark:bg-amber-950/40 dark:ring-amber-900 dark:text-amber-50',
    selo: 'bg-viagem text-white',
  },
  parcial: {
    cartao: 'bg-blue-50 ring-blue-200 text-blue-950 dark:bg-blue-950/40 dark:ring-blue-900 dark:text-blue-50',
    selo: 'bg-blue-400 text-white dark:bg-blue-500',
  },
  embarcado: {
    cartao: 'bg-blue-50 ring-blue-200 text-blue-950 dark:bg-blue-950/40 dark:ring-blue-900 dark:text-blue-50',
    selo: 'bg-embarcado text-white',
  },
};

const TEXTO_ALERTA: Record<AlertaEvento, string> = {
  dia_de_viagem: 'Cai num dia de viagem.',
  dia_do_embarque: 'Inclui o dia do embarque.',
  dia_do_desembarque: 'É o dia do desembarque: depende do horário em que você chega.',
  embarca_no_dia_seguinte: 'Você embarca no dia seguinte.',
  em_curso: 'Você estará em curso/treinamento.',
  afastado: 'Você estará afastado.',
};

/** Frase principal e linhas de detalhe para mostrar ao usuário. */
export function descreverResultado(r: ResultadoEvento): { frase: string; linhas: string[] } {
  const { periodo } = r.primeiroDia;
  const varios = r.totalDias > 1;
  const linhas: string[] = [];
  let frase: string;

  switch (r.disponibilidade) {
    case 'livre':
    case 'atencao':
      frase = varios
        ? `Você estará de folga nos ${r.totalDias} dias.`
        : `Você estará de folga (dia ${periodo.dia} de ${periodo.total} da folga).`;
      break;
    case 'embarcado':
      frase = varios
        ? `Você estará embarcado nos ${r.totalDias} dias.`
        : `Você estará embarcado (dia ${periodo.dia} de ${periodo.total} a bordo).`;
      break;
    case 'parcial':
      frase = `Você estará embarcado em ${r.diasABordo} de ${r.totalDias} dias.`;
      break;
  }

  for (const a of r.alertas) linhas.push(TEXTO_ALERTA[a]);
  if (r.desembarque && !r.alertas.includes('dia_do_desembarque')) {
    linhas.push(`Desembarque: ${compacta(r.desembarque)}.`);
  }
  if (!r.primeiroDia.aBordo && r.proximoEmbarque) linhas.push(`Próximo embarque: ${compacta(r.proximoEmbarque)}.`);
  if (r.disponibilidade === 'embarcado' || r.disponibilidade === 'parcial') {
    linhas.push('Para ir, só com troca de escala ou outro ajuste.');
  }
  return { frase, linhas };
}

export function contagem(diasAte: number): string {
  if (diasAte < 0) return 'já passou';
  if (diasAte === 0) return 'hoje';
  if (diasAte === 1) return 'amanhã';
  return `em ${plural(diasAte, 'dia', 'dias')}`;
}
