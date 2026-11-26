"""Mercado Livre pela API oficial (api.mercadolibre.com).

Teste feito em 26/11/2026: sem token, a busca (/sites/MLB/search) e a busca de
catálogo (/products/search) respondem 403 "forbidden". Por isso a loja só liga com
credencial:

- MERCADOLIVRE_ACCESS_TOKEN: token de acesso (expira em ~6 h), ou
- MERCADOLIVRE_CLIENT_ID + MERCADOLIVRE_CLIENT_SECRET + MERCADOLIVRE_REFRESH_TOKEN:
  o token é renovado a cada execução. O Mercado Livre troca o refresh token a cada
  renovação (uso único); o novo é devolvido por `novo_refresh_token()` e o workflow
  o grava de volta no Secret (precisa do secret SECRETS_PAT, veja o README).

Se a busca de anúncios continuar negada mesmo com token, usamos a busca de
catálogo (/products/search + /products/{id}/items), que também é oficial.
"""
from __future__ import annotations

import logging

import requests

from caca import segredos
from caca.http import TIMEOUT, nova_sessao
from caca.modelos import Oferta, Produto
from caca.util import pegar, para_float
from lojas.base import Loja

API = "https://api.mercadolibre.com"
log = logging.getLogger(__name__)

REPUTACAO = {
    "5_green": "verde",
    "4_light_green": "verde_claro",
    "3_yellow": "amarelo",
    "2_orange": "laranja",
    "1_red": "vermelho",
}


class MercadoLivre(Loja):
    nome = "mercadolivre"
    nome_exibicao = "Mercado Livre"

    def __init__(self) -> None:
        self.sessao = nova_sessao()
        self.token = ""
        self._novo_refresh: str | None = None
        self._reputacoes: dict[str, str | None] = {}
        self._usar_catalogo = False

    # --- credenciais ---------------------------------------------------------
    def _trio_refresh(self) -> tuple[str, str, str]:
        return (segredos.obter("MERCADOLIVRE_CLIENT_ID"), segredos.obter("MERCADOLIVRE_CLIENT_SECRET"),
                segredos.obter("MERCADOLIVRE_REFRESH_TOKEN"))

    def disponivel(self) -> bool:
        return bool(segredos.obter("MERCADOLIVRE_ACCESS_TOKEN") or all(self._trio_refresh()))

    def preparar(self) -> None:
        self.token = segredos.obter("MERCADOLIVRE_ACCESS_TOKEN")
        cid, secret, refresh = self._trio_refresh()
        if cid and secret and refresh:
            try:
                self._renovar(cid, secret, refresh)
            except Exception as e:  # noqa: BLE001
                if not self.token:
                    raise
                log.warning("Mercado Livre: renovação do token falhou (%s); usando MERCADOLIVRE_ACCESS_TOKEN",
                            segredos.sanitizar(e))

    def _renovar(self, cid: str, secret: str, refresh: str) -> None:
        r = self.sessao.post(f"{API}/oauth/token", timeout=TIMEOUT, headers={"Accept": "application/json"}, data={
            "grant_type": "refresh_token", "client_id": cid, "client_secret": secret, "refresh_token": refresh})
        if r.status_code != 200:
            raise RuntimeError(f"renovação do token respondeu HTTP {r.status_code}")
        dados = r.json()
        self.token = dados["access_token"]
        segredos.registrar_valor_sensivel(self.token)
        novo = dados.get("refresh_token")
        if novo and novo != refresh:
            segredos.registrar_valor_sensivel(novo)
            self._novo_refresh = novo

    def novo_refresh_token(self) -> str | None:
        return self._novo_refresh

    def _get(self, caminho: str, **params) -> requests.Response:
        return self.sessao.get(f"{API}{caminho}", params=params, timeout=TIMEOUT,
                               headers={"Authorization": f"Bearer {self.token}"})

    # --- busca ---------------------------------------------------------------
    def buscar(self, produto: Produto, max_resultados: int, cep: str) -> list[Oferta]:
        if not self._usar_catalogo:
            r = self._get("/sites/MLB/search", q=produto.busca, limit=min(max_resultados, 50), condition="new")
            if r.status_code == 200:
                return [o for o in (self._de_busca(i) for i in r.json().get("results", [])) if o]
            if r.status_code != 403:
                raise RuntimeError(f"busca respondeu HTTP {r.status_code}")
            log.info("Mercado Livre: busca de anúncios negada (403); usando busca de catálogo")
            self._usar_catalogo = True
        return self._buscar_catalogo(produto, max_resultados)

    def _de_busca(self, item: dict) -> Oferta | None:
        preco = para_float(item.get("price"))
        if preco is None:
            return None
        ean = next((a.get("value_name") for a in item.get("attributes") or []
                    if a.get("id") == "GTIN" and a.get("value_name")), None)
        oferta = Oferta(
            loja=self.nome, id_anuncio=str(item["id"]), titulo=item.get("title", ""), preco=preco,
            link=item.get("permalink") or _link_item(str(item["id"])),
            ean=ean, condicao=_condicao(item.get("condition")),
            oficial=bool(item.get("official_store_id")),
            full=pegar(item, "shipping.logistic_type") == "fulfillment",
            estoque=item.get("available_quantity"),
            vendedor=str(pegar(item, "seller.id") or "") or None,
            frete_gratis=bool(pegar(item, "shipping.free_shipping")),
        )
        return oferta

    def _buscar_catalogo(self, produto: Produto, max_resultados: int) -> list[Oferta]:
        r = self._get("/products/search", status="active", site_id="MLB", q=produto.busca, limit=10)
        if r.status_code != 200:
            raise RuntimeError(f"busca de catálogo respondeu HTTP {r.status_code}")
        ofertas: list[Oferta] = []
        for prod in r.json().get("results", []):
            if len(ofertas) >= max_resultados:
                break
            ri = self._get(f"/products/{prod['id']}/items", condition="new", limit=5)
            if ri.status_code != 200:
                continue
            ean = next((a.get("value_name") for a in prod.get("attributes") or []
                        if a.get("id") == "GTIN" and a.get("value_name")), None)
            for it in ri.json().get("results", []):
                preco = para_float(it.get("price"))
                if preco is None:
                    continue
                o = Oferta(
                    loja=self.nome, id_anuncio=str(it["item_id"]), titulo=prod.get("name", ""), preco=preco,
                    link=f"https://www.mercadolivre.com.br/p/{prod['id']}?pdp_filters=item_id:{it['item_id']}",
                    ean=ean, condicao=_condicao(it.get("condition")),
                    oficial=bool(it.get("official_store_id")),
                    full=pegar(it, "shipping.logistic_type") == "fulfillment",
                    vendedor=str(it.get("seller_id") or "") or None,
                    frete_gratis=bool(pegar(it, "shipping.free_shipping")),
                )
                ofertas.append(o)
        return ofertas[:max_resultados]

    # --- frete e reputação (só nas ofertas que passaram nos filtros) ---------
    def completar(self, ofertas: list[Oferta], cep: str) -> None:
        for o in ofertas:
            o.reputacao = self._reputacao(o.vendedor)
            o.frete = self._frete(o, cep)

    def _reputacao(self, vendedor: str | None) -> str | None:
        if not vendedor:
            return None
        if vendedor not in self._reputacoes:
            nivel = None
            try:
                r = self._get(f"/users/{vendedor}")
                if r.status_code == 200:
                    nivel = REPUTACAO.get(pegar(r.json(), "seller_reputation.level_id") or "")
            except requests.RequestException as e:
                log.info("Mercado Livre: reputação indisponível (%s)", segredos.sanitizar(e))
            self._reputacoes[vendedor] = nivel
        return self._reputacoes[vendedor]

    def _frete(self, o: Oferta, cep: str) -> float | None:
        gratis = o.frete_gratis
        if cep:
            try:
                r = self._get(f"/items/{o.id_anuncio}/shipping_options", zip_code=cep)
                if r.status_code == 200:
                    custos = [para_float(op.get("cost")) for op in r.json().get("options", [])]
                    custos = [c for c in custos if c is not None]
                    if custos:
                        return min(custos)
            except requests.RequestException as e:
                log.info("Mercado Livre: frete indisponível (%s)", segredos.sanitizar(e))
        # Sem cálculo para o CEP: só afirmamos frete grátis se a própria API disser.
        return 0.0 if gratis else None


def _condicao(c: str | None) -> str | None:
    return {"new": "novo", "used": "usado", "refurbished": "recondicionado"}.get(c or "", c)


def _link_item(item_id: str) -> str:
    return f"https://produto.mercadolivre.com.br/{item_id[:3]}-{item_id[3:]}"
