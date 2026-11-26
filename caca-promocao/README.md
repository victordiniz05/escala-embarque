# caca-promocao

Monitor de preços que procura promoções em lojas online brasileiras e avisa no Telegram.

- Você cadastra produtos (termo de busca, preço-alvo, lojas) no `produtos.yaml` ou pelo Telegram.
- O GitHub Actions roda o programa de hora em hora (`python main.py --once`). Ele busca a cada
  6 horas (a cada 1 hora nas datas da Black Friday), guarda o histórico e avisa quando:
  1. o **preço final** fica igual ou abaixo do preço-alvo; ou
  2. o preço final cai **15% ou mais** (configurável) em relação à **média dos últimos 30 dias**,
     o que ajuda a pegar a “promoção falsa” (preço inflado antes do desconto).
- Só usa fontes oficiais ou autorizadas: API oficial do Mercado Livre, API oficial de afiliados
  da Amazon (Creators API) e um feed JSON autorizado da Kabum. Nada de raspar site.

## Como funciona cada execução

1. Lê os comandos novos do Telegram (`getUpdates`), só do seu `TELEGRAM_CHAT_ID`.
2. Se for hora (ou se você pediu `/buscar` ou rodou o workflow manualmente), busca em cada loja
   ativa. Uma loja que falha é registrada e as outras seguem; nada derruba a execução inteira.
3. Filtra os anúncios: só produto novo, palavras obrigatórias/proibidas no título (sem diferenciar
   maiúsculas, minúsculas e acentos, palavra inteira: “capa” não barra “capacidade”), preço máximo,
   EAN e reputação mínima do vendedor.
4. Calcula o **preço final** = preço (com desconto no PIX, quando informado) + frete para o `CEP_DESTINO`.
5. Agrupa o mesmo produto entre lojas (pelo EAN; sem EAN, por semelhança de título) e manda **uma
   mensagem por grupo**, com o melhor preço primeiro.
6. Anti-spam: o mesmo anúncio só alerta de novo depois de 24 h, a não ser que o preço caia mais.
7. Grava o histórico só quando o preço muda e apaga registros com mais de 90 dias.
8. Aos domingos (20 h), manda o resumo semanal com um gráfico por produto.
9. Gera `data/precos_atuais.csv` e o painel do GitHub Pages, e o workflow commita os dados.

### Dados honestos

Quando a loja não informa frete, reputação ou estoque, o alerta mostra **“a confirmar”**.
Nunca é usado zero nem valor inventado. Frete zero só aparece quando a própria API diz que é grátis.
Com frete a confirmar, o preço final soma só o que se sabe e o alerta avisa isso.

## Exemplo de alerta

```
🔥 Aspirador de pó — queda forte em relação à média

🥇 Mercado Livre  🏷 Oficial · ⚡ Full
Aspirador Vertical Sem Fio X100 …
Preço atual: R$ 799,00
Frete: grátis
Preço final: R$ 799,00
Preço-alvo: sem alvo
Menor preço já registrado: R$ 812,90
Abaixo da média de 30 dias: 18.4%
Vendedor: reputação verde
Estoque: 12
🔗 Ver oferta

Outras lojas (do mais barato para o mais caro):
• Amazon 🏷 Oficial: R$ 829,90 (frete a confirmar) — link
```

## Instalação

1. **Repositório.** Crie um repositório chamado `caca-promocao` com o conteúdo desta pasta na raiz
   (o workflow precisa ficar em `.github/workflows/`).
2. **Bot do Telegram.** No Telegram, fale com o @BotFather, use `/newbot` e guarde o token.
   Mande qualquer mensagem para o seu bot e abra
   `https://api.telegram.org/bot<TOKEN>/getUpdates` no navegador: o número em `"chat":{"id": ...}`
   é o seu chat_id. O bot não pode ter webhook configurado (o programa usa `getUpdates`).
3. **Secrets** (Settings → Secrets and variables → Actions → New repository secret):

   | Secret | Obrigatório | Para quê |
   |---|---|---|
   | `TELEGRAM_TOKEN` | sim | token do bot |
   | `TELEGRAM_CHAT_ID` | sim | seu chat; o bot ignora todos os outros |
   | `CEP_DESTINO` | sim | cálculo do frete |
   | `MERCADOLIVRE_ACCESS_TOKEN` | opcional* | token de acesso do Mercado Livre |
   | `MERCADOLIVRE_CLIENT_ID`, `MERCADOLIVRE_CLIENT_SECRET`, `MERCADOLIVRE_REFRESH_TOKEN` | opcional* | renovação automática do token |
   | `SECRETS_PAT` | com renovação | grava o refresh token novo de volta no Secret |
   | `AMAZON_CREDENTIAL_ID`, `AMAZON_CREDENTIAL_SECRET`, `AMAZON_PARTNER_TAG` | opcional | Amazon (Creators API) |
   | `AMAZON_TOKEN_URL`, `AMAZON_API_URL` | opcional | só se a Amazon mudar os endpoints |
   | `KABUM_FEED_URL` | opcional | feed JSON autorizado da Kabum |

   \* O Mercado Livre exige token (veja abaixo). Sem credencial, a loja fica desligada em silêncio.
4. **GitHub Pages.** Settings → Pages → Source: **GitHub Actions**. (Em repositório privado, o Pages
   exige plano pago.)
5. **Primeira execução.** Actions → caca-promocao → Run workflow. Depois disso ele roda sozinho.

### Mercado Livre

Teste feito em 26/11/2026, direto em `api.mercadolibre.com`:

| Chamada | Sem token |
|---|---|
| `GET /sites/MLB/search?q=purificador de agua` | **403** `forbidden` |
| `GET /products/search?site_id=MLB&q=...` (catálogo) | **403** `PA_UNAUTHORIZED_RESULT_FROM_POLICIES` |
| `GET /sites/MLB` (dados públicos do site) | 200 |

Ou seja, a busca **exige token**. Como obter:

1. Crie um aplicativo em <https://developers.mercadolivre.com.br/devcenter> (escopos de leitura e
   `offline_access`, para ganhar refresh token). Defina uma URL de redirecionamento qualquer que
   você controle (ex.: `https://SEU_USUARIO.github.io/caca-promocao/`).
2. Abra no navegador, logado na sua conta:
   `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=CLIENT_ID&redirect_uri=URL`
   e copie o `code` da URL para onde você foi redirecionado.
3. Troque o code pelos tokens (no seu computador):
   ```
   curl -X POST https://api.mercadolibre.com/oauth/token \
     -d grant_type=authorization_code -d client_id=CLIENT_ID -d client_secret=CLIENT_SECRET \
     -d code=CODE -d redirect_uri=URL
   ```
4. Cadastre `MERCADOLIVRE_CLIENT_ID`, `MERCADOLIVRE_CLIENT_SECRET` e o `refresh_token` como
   `MERCADOLIVRE_REFRESH_TOKEN`.

O token de acesso dura cerca de 6 horas e o refresh token é de **uso único**: cada renovação gera um
novo. Por isso o workflow grava o novo de volta no Secret, e para isso precisa de um
**fine-grained personal access token** só deste repositório com permissão **Secrets: Read and write**,
salvo como `SECRETS_PAT`. Sem ele, a renovação funciona uma vez e depois o refresh token fica velho.
Alternativa mais simples (e mais trabalhosa no dia a dia): usar só `MERCADOLIVRE_ACCESS_TOKEN` e
atualizá-lo à mão.

Se a busca de anúncios continuar negada mesmo com token (o Mercado Livre restringiu esse endpoint
para alguns aplicativos), o programa passa sozinho para a busca de catálogo
(`/products/search` + `/products/{id}/items`), que também é oficial.

Selos: **Oficial** = loja oficial (`official_store_id`); **Full** = envio pelo Mercado Livre
(`logistic_type = fulfillment`). Reputação vem de `seller_reputation.level_id`.
O desconto no PIX não vem na busca do Mercado Livre, então lá o preço usado é o anunciado.

### Amazon

A PA-API 5 foi descontinuada em 2026 e substituída pela **Creators API** (OAuth 2.0 com
Credential ID/Secret, no lugar da assinatura AWS). As chaves antigas da PA-API **não funcionam**:
gere credenciais novas na área da Creators API no Associates Central. A Amazon exige que a conta de
afiliado esteja elegível (vendas qualificadas recentes); sem isso a API responde 403.
Sem as três credenciais, a loja fica desligada. A Creators API não informa frete para um CEP nem
reputação de vendedor terceiro: esses campos aparecem “a confirmar”. Vendido pela própria Amazon
aparece como **Oficial**. Não deu para testar sem credencial; se a Amazon mudar o endereço do token
ou da busca, ajuste pelos Secrets `AMAZON_TOKEN_URL` e `AMAZON_API_URL` sem mexer no código.

### Kabum

Só por feed JSON **autorizado** (por exemplo, o feed de um programa de afiliados), no Secret
`KABUM_FEED_URL`. Os campos aceitos estão descritos em `lojas/kabum.py`. Itens sem estoque são
ignorados; se o feed trouxer `preco_pix`, ele entra no preço final.

## Comandos do Telegram

| Comando | O que faz |
|---|---|
| `/add nome \| busca \| preço-alvo \| lojas` | cadastra (preço 0 = só queda; lojas por vírgula ou `todas`) |
| `/lista` | produtos, preço atual e alvo |
| `/pausar nome` / `/ativar nome` | para / volta a monitorar |
| `/remover nome` | apaga o produto e o histórico dele |
| `/historico nome` | manda o gráfico |
| `/buscar` | busca nesta execução, fora do intervalo |
| `/ajuda` | lista os comandos |

Exemplo: `/add Air fryer | air fryer 5 litros | 349,90 | mercadolivre, amazon`

Os comandos são lidos no início de cada execução (de hora em hora), então a resposta pode
demorar até ~1 hora. Para resposta imediata, rode o workflow manualmente.
Produtos criados pelo `/add` recebem a primeira palavra da busca como obrigatória e as palavras
proibidas padrão do `config.yaml`; ajuste o resto no `produtos.yaml`.

## Configuração

- `produtos.yaml`: seus produtos (também editado pelos comandos).
- `config.yaml`: % de queda, janela da média, máximo de resultados por busca (30), dias de histórico
  (90), datas e intervalo da Black Friday, dia e hora do resumo semanal, limite de falhas para o
  alerta de saúde.

> Atenção: no aspirador, `filtro hepa` está nas palavras proibidas. Muitos aspiradores trazem
> “filtro HEPA” no título e vão ser descartados. Se não for essa a intenção, tire do `produtos.yaml`.

## Dados e histórico

- `data/precos.db` (SQLite): histórico enxuto (grava só mudanças), estado do anti-spam, saúde das
  lojas e o offset do Telegram. Commitado pelo workflow.
- `data/precos_atuais.csv`: `produto,loja,preco,frete,preco_final,data,link`, ordenado e com formato
  estável. A coluna `data` é quando aquele preço começou a valer, então o arquivo só muda quando um
  preço muda e o histórico de commits vira histórico de preços (funciona com o
  [Flat Viewer](https://flatgithub.com) e o [git-history](https://githistory.xyz)). Frete vazio = a
  confirmar.
- A camada de dados está isolada em `caca/db/`. Para trocar por Supabase, implemente a interface de
  `caca/db/base.py` em `caca/db/supabase.py` e mude `banco.tipo` no `config.yaml`.

## Segurança e privacidade

- Tokens, CEP e chat_id ficam só nos Secrets. Nenhum deles vai para o código, o banco, o CSV ou o
  painel; mensagens de erro e logs passam por um filtro que troca qualquer valor de Secret por `***`
  (as URLs da API do Telegram e do frete contêm token e CEP).
- O texto das suas mensagens no Telegram não é gravado; só o número da última mensagem lida.
- O bot responde só ao `TELEGRAM_CHAT_ID` e ignora qualquer outra pessoa em silêncio.
- Repositório público: o banco e o CSV ficam visíveis (só produtos, preços e links). Os logs do
  Actions também ficam públicos, mas o GitHub mascara os Secrets e o programa nunca imprime CEP,
  chat_id ou token. O painel tem `noindex`.
- As actions do workflow são fixadas por SHA.

## Adicionar uma loja

Crie `lojas/minhaloja.py` com uma subclasse de `Loja` (veja `lojas/base.py`):

```python
from caca import segredos
from caca.modelos import Oferta
from lojas.base import Loja

class MinhaLoja(Loja):
    nome = "minhaloja"            # nome usado no produtos.yaml
    nome_exibicao = "Minha Loja"

    def disponivel(self):         # False = desligada em silêncio
        return bool(segredos.obter("MINHALOJA_TOKEN"))

    def buscar(self, produto, max_resultados, cep):
        ...                       # devolve list[Oferta]; o que a API não informar fica None
```

Pronto: ela é descoberta automaticamente. Só use APIs oficiais ou feeds autorizados.

## Rodar localmente

```
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest
python main.py --once --forcar   # sem TELEGRAM_TOKEN, as mensagens só aparecem no log
```

Variáveis locais podem ficar num `.env` (já está no `.gitignore`); carregue com
`set -a; . ./.env; set +a`.
