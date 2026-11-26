"""Kabum por um feed JSON autorizado (KABUM_FEED_URL), por exemplo o feed de
produtos de um programa de afiliados. Sem feed, a loja fica desligada em silêncio.

Formato aceito: uma lista de objetos, ou um objeto com a lista em "produtos",
"products", "items" ou "data". Campos reconhecidos (o primeiro que existir):
- id:       id, codigo, sku, product_id
- título:   nome, titulo, title, name
- preço:    preco, price, preco_prazo, sale_price
- PIX:      preco_pix, preco_desconto, price_pix
- link:     link, url, product_url
- EAN:      ean, gtin
- frete:    frete, shipping  (ausente = "a confirmar")
- estoque:  estoque, quantidade, stock, disponivel (booleano)
- condição: condicao, condition  (ausente = novo, a Kabum vende produtos novos)
- vendedor: vendedor, seller (ausente = venda direta da Kabum)
"""
from __future__ import annotations

from caca import segredos
from caca.http import TIMEOUT, nova_sessao
from caca.modelos import Oferta, Produto
from caca.texto import contem_termo, normalizar
from caca.util import para_float
from lojas.base import Loja

PALAVRAS_VAZIAS = {"de", "da", "do", "das", "dos", "para", "com", "e", "a", "o"}


def _campo(d: dict, *nomes):
    for n in nomes:
        if d.get(n) not in (None, ""):
            return d[n]
    return None


class Kabum(Loja):
    nome = "kabum"
    nome_exibicao = "KaBuM!"

    def __init__(self) -> None:
        self.sessao = nova_sessao()
        self._feed: list[dict] | None = None

    def disponivel(self) -> bool:
        return bool(segredos.obter("KABUM_FEED_URL"))

    def _itens(self) -> list[dict]:
        if self._feed is None:
            r = self.sessao.get(segredos.obter("KABUM_FEED_URL"), timeout=60)
            if r.status_code != 200:
                raise RuntimeError(f"feed respondeu HTTP {r.status_code}")
            dados = r.json()
            if isinstance(dados, dict):
                dados = next((dados[k] for k in ("produtos", "products", "items", "data") if k in dados), [])
            self._feed = [d for d in dados if isinstance(d, dict)]
        return self._feed

    def buscar(self, produto: Produto, max_resultados: int, cep: str) -> list[Oferta]:
        termos = [t for t in normalizar(produto.busca).split() if t not in PALAVRAS_VAZIAS]
        ofertas: list[Oferta] = []
        for d in self._itens():
            titulo = str(_campo(d, "nome", "titulo", "title", "name") or "")
            ean = str(_campo(d, "ean", "gtin") or "") or None
            casou_ean = bool(produto.ean) and ean == produto.ean
            if not casou_ean and not all(contem_termo(titulo, t) for t in termos):
                continue
            preco = para_float(_campo(d, "preco", "price", "preco_prazo", "sale_price"))
            if preco is None:
                continue
            disp = _campo(d, "estoque", "quantidade", "stock")
            if disp is None and isinstance(d.get("disponivel"), bool):
                disp = 1 if d["disponivel"] else 0
            if disp is not None and int(para_float(disp) or 0) <= 0:
                continue  # sem estoque
            vendedor = _campo(d, "vendedor", "seller")
            direto = vendedor is None or "kabum" in normalizar(str(vendedor))
            cond = _campo(d, "condicao", "condition")
            ofertas.append(Oferta(
                loja=self.nome, id_anuncio=str(_campo(d, "id", "codigo", "sku", "product_id") or titulo),
                titulo=titulo, preco=preco, link=str(_campo(d, "link", "url", "product_url") or ""),
                preco_pix=para_float(_campo(d, "preco_pix", "preco_desconto", "price_pix")),
                frete=para_float(_campo(d, "frete", "shipping")), ean=ean,
                condicao=normalizar(str(cond)) if cond else "novo",
                reputacao="propria" if direto else None, oficial=direto,
                estoque=int(para_float(disp)) if disp is not None else None,
                vendedor=str(vendedor) if vendedor else "KaBuM!",
            ))
            if len(ofertas) >= max_resultados:
                break
        return ofertas
