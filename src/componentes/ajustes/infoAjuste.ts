import {
  ArrowLeftToLine,
  ArrowRightLeft,
  ArrowRightToLine,
  GraduationCap,
  HeartPulse,
  Repeat2,
  TreePalm,
} from 'lucide-react';
import type { TipoAjuste } from '../../dominio/ajustes';

export const INFO_AJUSTE: Record<
  TipoAjuste,
  { rotulo: string; descricao: string; ajudaDatas: string; Icone: typeof Repeat2 }
> = {
  dobra: {
    rotulo: 'Dobra',
    descricao: 'Ficou mais dias a bordo além do previsto.',
    ajudaDatas: 'Do 1º ao último dia extra a bordo.',
    Icone: Repeat2,
  },
  antecipacao: {
    rotulo: 'Antecipação',
    descricao: 'Embarcou antes da data prevista.',
    ajudaDatas: 'Do novo dia de embarque até a véspera do embarque previsto.',
    Icone: ArrowLeftToLine,
  },
  atraso: {
    rotulo: 'Atraso',
    descricao: 'Embarcou depois da data prevista.',
    ajudaDatas: 'Dias em que deveria estar a bordo mas ficou em terra.',
    Icone: ArrowRightToLine,
  },
  troca: {
    rotulo: 'Troca',
    descricao: 'Trocou dias com um colega.',
    ajudaDatas: 'Período trocado.',
    Icone: ArrowRightLeft,
  },
  curso: {
    rotulo: 'Curso',
    descricao: 'Curso ou treinamento.',
    ajudaDatas: 'Período do curso.',
    Icone: GraduationCap,
  },
  afastamento: {
    rotulo: 'Afastamento',
    descricao: 'Licença médica ou outro afastamento.',
    ajudaDatas: 'Período afastado.',
    Icone: HeartPulse,
  },
  ferias: {
    rotulo: 'Férias',
    descricao: 'Férias fora da escala normal.',
    ajudaDatas: 'Período de férias.',
    Icone: TreePalm,
  },
};
