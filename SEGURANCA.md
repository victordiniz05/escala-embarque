# Segurança – Escala Embarque

Revisão feita em 25/11/2026 (Fase 1: app só no aparelho, sem servidor, sem login).

## Como o app funciona (e por que a superfície de ataque é pequena)

- É um site estático no GitHub Pages (HTTPS). Não há servidor, banco na nuvem, login ou senha.
- Os dados (escala, ajustes, eventos, histórico) ficam **só no aparelho**, no IndexedDB do navegador.
- O app não envia dados para lugar nenhum: a política de segurança (CSP) proíbe conexões com outros endereços.

## O que foi verificado

| Item | Resultado |
| --- | --- |
| Dependências (`npm audit`) | 0 vulnerabilidades (havia 4 moderadas em ferramentas de build; corrigidas forçando `glob` 14.0.6 em `overrides`) |
| Código que injeta HTML (`innerHTML`, `dangerouslySetInnerHTML`, `eval`, `new Function`) | Nenhum. Todo texto passa pelo React, que escapa HTML |
| Texto malicioso (ex.: `<img src=x onerror=alert(1)>` como nome de evento) | Aparece como texto; nada é executado (testado) |
| Segredos no repositório (chaves, tokens, `.env`) | Nenhum |
| Links externos | Nenhum |
| Exportação `.ics` | Texto escapado conforme RFC 5545 (vírgula, ponto e vírgula, quebra de linha) |

## Proteções adicionadas

- **Content Security Policy** (no app publicado): scripts, estilos, imagens e conexões só do próprio endereço; `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`. Também `referrer: no-referrer`.
- **Não roda dentro de outro site** (proteção contra *clickjacking*): se o app for aberto num `iframe`, mostra só um aviso.
- **Importação de backup blindada**: arquivo de no máximo 10 MB, limite de itens por lista, tamanho máximo dos textos, datas e tipos validados, e **só os campos conhecidos são copiados** (campos extras ou `__proto__` são descartados). Antes de substituir, o app mostra um resumo e pede confirmação.
- **Limite de tamanho** nos campos de texto (nomes 120, observações 500 caracteres).
- **Datas**: `npm run lint:datas` barra usos arriscados de `Date` (evita erros de fuso).
- **GitHub Actions**: ações fixadas por *commit* (SHA) — uma ação adulterada no GitHub não entra no build sem que a gente troque o SHA; permissão padrão só de leitura e escrita no Pages só na etapa de publicação; `persist-credentials: false` no checkout; `npm ci` com *lockfile*.

## O que não dá para resolver sem servidor (riscos aceitos)

- **Celular desbloqueado nas mãos de outra pessoa**: ela vê a escala. O app não tem senha própria; a proteção é o bloqueio do iPhone (Face ID / código).
- **Backup é um arquivo aberto (JSON)**: quem tiver o arquivo lê a escala. Guarde-o em lugar seu (iCloud Drive, conversa com você mesmo). Não há dados bancários ou senhas nele.
- **Cabeçalhos HTTP**: o GitHub Pages não permite configurar (`X-Frame-Options`, `frame-ancestors`); por isso a CSP vai como `<meta>` e a proteção contra *iframe* é feita no próprio app.

## Para a Fase 2 (Supabase, login, link para a família)

- Ativar **RLS (Row Level Security)** em todas as tabelas: cada usuário só lê/escreve as próprias linhas.
- Nunca colocar a chave `service_role` no app; só a chave pública (`anon`).
- Link da família: token longo e aleatório, **somente leitura**, com opção de revogar; a página da família não mostra observações pessoais.
- Login por código no e-mail (sem senha), com limite de tentativas.
- Revisar a CSP para liberar apenas o endereço do Supabase em `connect-src`.
