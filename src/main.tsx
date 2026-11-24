import Dexie from 'dexie';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

/** Testa se o IndexedDB funciona (no Safari em aba privada ou em pré-visualizações ele pode falhar). */
function indexedDBFunciona(): Promise<boolean> {
  return new Promise((resolver) => {
    try {
      if (!window.indexedDB) return resolver(false);
      const pedido = window.indexedDB.open('__teste-escala');
      pedido.onsuccess = () => {
        pedido.result.close();
        resolver(true);
      };
      pedido.onerror = () => resolver(false);
      pedido.onblocked = () => resolver(false);
      window.setTimeout(() => resolver(false), 3000);
    } catch {
      resolver(false);
    }
  });
}

async function iniciar() {
  let modoTemporario = false;
  if (!(await indexedDBFunciona())) {
    // Sem armazenamento: o app funciona, mas os dados somem ao fechar.
    const falso = await import('fake-indexeddb');
    Dexie.dependencies.indexedDB = falso.indexedDB;
    Dexie.dependencies.IDBKeyRange = falso.IDBKeyRange;
    modoTemporario = true;
  }
  // O banco só é criado depois de escolher o armazenamento.
  const { default: App } = await import('./App');
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App modoTemporario={modoTemporario} />
    </StrictMode>,
  );
}

void iniciar();
