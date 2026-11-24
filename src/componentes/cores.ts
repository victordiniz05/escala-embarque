import type { Categoria } from '../dominio/tipos';

/** Classes de cor por categoria (célula do calendário). */
export const COR_CELULA: Record<Categoria, string> = {
  embarcado: 'bg-embarcado text-white',
  folga: 'bg-folga-suave text-emerald-900 dark:bg-emerald-900/45 dark:text-emerald-100',
  viagem: 'bg-viagem-suave text-amber-900 dark:bg-amber-800/50 dark:text-amber-100',
  curso: 'bg-ajuste-suave text-violet-900 dark:bg-violet-900/50 dark:text-violet-100',
  ferias: 'bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100',
  afastamento: 'bg-rose-100 text-rose-900 dark:bg-rose-900/45 dark:text-rose-100',
};

/** Bolinha da legenda. */
export const COR_LEGENDA: Record<Categoria, string> = {
  embarcado: 'bg-embarcado',
  folga: 'bg-folga-suave border border-emerald-300 dark:bg-emerald-900/60 dark:border-emerald-700',
  viagem: 'bg-viagem-suave border border-amber-300 dark:bg-amber-800/60 dark:border-amber-600',
  curso: 'bg-ajuste-suave border border-violet-300 dark:bg-violet-900/60 dark:border-violet-600',
  ferias: 'bg-sky-100 border border-sky-300 dark:bg-sky-900/60 dark:border-sky-600',
  afastamento: 'bg-rose-100 border border-rose-300 dark:bg-rose-900/60 dark:border-rose-600',
};
