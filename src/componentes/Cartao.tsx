import type { ReactNode } from 'react';

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 ${className}`}>
      {children}
    </section>
  );
}

export function TituloTela({ children, detalhe }: { children: ReactNode; detalhe?: ReactNode }) {
  return (
    <header className="mb-4">
      <h1 className="text-3xl font-bold tracking-tight">{children}</h1>
      {detalhe && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{detalhe}</p>}
    </header>
  );
}
