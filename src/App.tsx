import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { BarraAbas } from './componentes/BarraAbas';
import { pedirArmazenamentoPersistente, type Tema } from './dados/db';
import { useDadosEscala } from './dados/hooks';
import { Calendario } from './telas/Calendario';
import { ConfigurarEscala } from './telas/ConfigurarEscala';
import { Configuracoes } from './telas/Configuracoes';
import { Estatisticas } from './telas/Estatisticas';
import { Inicio } from './telas/Inicio';

function useTema(tema: Tema) {
  useEffect(() => {
    const midia = window.matchMedia('(prefers-color-scheme: dark)');
    const aplicar = () => {
      const escuro = tema === 'escuro' || (tema === 'sistema' && midia.matches);
      document.documentElement.classList.toggle('dark', escuro);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#020617' : '#f8fafc');
    };
    aplicar();
    midia.addEventListener('change', aplicar);
    return () => midia.removeEventListener('change', aplicar);
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

export default function App() {
  const dados = useDadosEscala();
  useTema(!dados.carregando && dados.configuracao ? dados.configuracao.tema : 'sistema');
  useEffect(() => {
    void pedirArmazenamentoPersistente();
  }, []);

  if (dados.carregando) return null;

  if (!dados.configuracao) {
    return (
      <main className="pt-seguro pb-seguro mx-auto max-w-lg px-4">
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

  const { entrada, configuracao, ancoras } = dados;
  return (
    <HashRouter>
      <RolarParaTopo />
      <main className="pt-seguro mx-auto max-w-lg px-4 pb-28">
        <Routes>
          <Route path="/" element={<Inicio entrada={entrada} configuracao={configuracao} />} />
          <Route path="/calendario" element={<Calendario entrada={entrada} />} />
          <Route path="/estatisticas" element={<Estatisticas />} />
          <Route path="/configuracoes" element={<Configuracoes configuracao={configuracao} ancoras={ancoras} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BarraAbas />
    </HashRouter>
  );
}
