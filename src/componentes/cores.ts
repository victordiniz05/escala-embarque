import type { Categoria } from '../dominio/tipos';

/** Classes de cor por categoria (célula do calendário). */
export const COR_CELULA: Record<Categoria, string> = {
  embarcado: 'bg-embarcado text-white',
  folga: 'bg-folga-suave text-emerald-900 dark:bg-emerald-900/45 dark:text-emerald-100',
  viagem: 'bg-viagem-suave text-amber-900 dark:bg-amber-800/50 dark:text-amber-100',
};

/** Bolinha da legenda. */
export const COR_LEGENDA: Record<Categoria, string> = {
  embarcado: 'bg-embarcado',
  folga: 'bg-folga-suave border border-emerald-300 dark:bg-emerald-900/60 dark:border-emerald-700',
  viagem: 'bg-viagem-suave border border-amber-300 dark:bg-amber-800/60 dark:border-amber-600',
};
