import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { HashRouter, MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { BarraAbas } from './componentes/BarraAbas';
import { pedirArmazenamentoPersistente, type Tema } from './dados/db';
import { consolidarHistorico } from './dados/historico';
import { useDadosEscala, useHoje } from './dados/hooks';
import { Calendario } from './telas/Calendario';
import { ConfigurarEscala } from './telas/ConfigurarEscala';
import { Configuracoes } from './telas/Configuracoes';
import { Estatisticas } from './telas/Estatisticas';
import { Inicio } from './telas/Inicio';

function useTema(tema: Tema) {
  useEffect(() => {
    const midia = window.matchMedia('(prefers-color-scheme: dark)');
    const aplicar = () => {
      // Quando o app roda dentro de outra página (ex.: pré-visualização no Claude),
      // o tema dela vem em data-theme no <html>.
      const temaHospedeiro = document.documentElement.dataset.theme;
      const sistemaEscuro = temaHospedeiro ? temaHospedeiro === 'dark' : midia.matches;
      const escuro = tema === 'escuro' || (tema === 'sistema' && sistemaEscuro);
      document.documentElement.classList.toggle('dark', escuro);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#020617' : '#f8fafc');
    };
    aplicar();
    midia.addEventListener('change', aplicar);
    const observador = new MutationObserver(aplicar);
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      midia.removeEventListener('change', aplicar);
      observador.disconnect();
    };
  }, [tema]);
}

/** Cada tela abre do topo (o iOS mantém a rolagem da tela anterior). */
function RolarParaTopo() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Na pré-visualização o endereço não pode mudar, então as abas ficam em memória. */
function Roteador({ children }: { children: ReactNode }) {
  return import.meta.env.VITE_PREVIA === '1' ? <MemoryRouter>{children}</MemoryRouter> : <HashRouter>{children}</HashRouter>;
}

function AvisoTemporario() {
  return (
    <p className="mb-3 rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
      Modo temporário: este navegador não permite salvar dados, então a escala some ao fechar.
    </p>
  );
}

export default function App({ modoTemporario = false }: { modoTemporario?: boolean }) {
  const dados = useDadosEscala();
  useTema(!dados.carregando && dados.configuracao ? dados.configuracao.tema : 'sistema');
  useEffect(() => {
    void pedirArmazenamentoPersistente();
  }, []);

  // Grava no histórico os dias que já passaram (ao abrir e quando vira o dia).
  const hojeSP = useHoje();
  const entradaAtual = !dados.carregando && dados.configuracao ? dados.entrada : null;
  useEffect(() => {
    if (entradaAtual) void consolidarHistorico(entradaAtual, hojeSP);
  }, [entradaAtual, hojeSP]);

  if (dados.carregando) return null;

  if (!dados.configuracao) {
    return (
      <main className="pt-seguro pb-seguro mx-auto max-w-lg px-4">
        {modoTemporario && <div className="mt-3"><AvisoTemporario /></div>}
        <header className="mt-4 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Bem-vindo a bordo</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Configure sua escala uma vez e o app projeta seus embarques pelos próximos anos.
          </p>
        </header>
        <ConfigurarEscala />
        <div className="h-8" />
      </main>
    );
  }

  const { entrada, configuracao, ancoras, ajustes, realizados } = dados;
  return (
    <Roteador>
      <RolarParaTopo />
      <main className="pt-seguro mx-auto max-w-lg px-4 pb-28">
        {modoTemporario && <AvisoTemporario />}
        <Routes>
          <Route path="/" element={<Inicio entrada={entrada} configuracao={configuracao} />} />
          <Route path="/calendario" element={<Calendario entrada={entrada} ajustes={ajustes} realizados={realizados} />} />
          <Route path="/estatisticas" element={<Estatisticas />} />
          <Route path="/configuracoes" element={<Configuracoes configuracao={configuracao} ancoras={ancoras} ajustes={ajustes} entrada={entrada} realizados={realizados} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BarraAbas />
    </Roteador>
  );
}
