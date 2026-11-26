"""Amazon Brasil pela API oficial de afiliados: Creators API.

A PA-API 5 foi descontinuada em 2026 e substituída pela Creators API, que usa
OAuth 2.0 (client credentials) em vez de assinatura AWS. As chaves antigas da
PA-API não funcionam: é preciso gerar credenciais novas no Associates Central
(e a conta precisa cumprir os requisitos de elegibilidade, como vendas recentes).

Secrets (a loja fica desligada em silêncio se faltar algum dos três primeiros):
- AMAZON_CREDENTIAL_ID, AMAZON_CREDENTIAL_SECRET, AMAZON_PARTNER_TAG (ex.: seutag-20)
- opcionais: AMAZON_TOKEN_URL, AMAZON_API_URL, AMAZON_MARKETPLACE

Os endpoints padrão abaixo seguem a documentação pública da Creators API em
novembro de 2026. Como não deu para testar sem credencial, eles podem ser
ajustados pelos Secrets opcionais sem mexer no código.

A API não informa reputação de vendedor terceiro nem frete para um CEP:
esses campos ficam "a confirmar" no alerta.
"""
from __future__ import annotations

import time

from caca import segredos
from caca.http import TIMEOUT, nova_sessao
from caca.modelos import Oferta, Produto
from caca.util import pegar, para_float
from lojas.base import Loja

TOKEN_URL = "https://api.amazon.com/auth/o2/token"
API_URL = "https://creatorsapi.amazon/catalog/v1/searchItems"
MARKETPLACE = "www.amazon.com.br"
RECURSOS = [
    "itemInfo.title",
    "itemInfo.externalIds",
    "offersV2.listings.price",
    "offersV2.listings.condition",
    "offersV2.listings.merchantInfo",
    "offersV2.listings.availability",
    "offersV2.listings.isBuyBoxWinner",
]


class Amazon(Loja):
    nome = "amazon"
    nome_exibicao = "Amazon"

    def __init__(self) -> None:
        self.sessao = nova_sessao()
        self._token = ""
        self._expira = 0.0

    def _cred(self) -> tuple[str, str, str]:
        return (segredos.obter("AMAZON_CREDENTIAL_ID"), segredos.obter("AMAZON_CREDENTIAL_SECRET"),
                segredos.obter("AMAZON_PARTNER_TAG"))

    def disponivel(self) -> bool:
        return all(self._cred())

    def _obter_token(self) -> str:
        if self._token and time.time() < self._expira - 60:
            return self._token
        cid, secret, _ = self._cred()
        r = self.sessao.post(segredos.obter("AMAZON_TOKEN_URL") or TOKEN_URL, timeout=TIMEOUT, data={
            "grant_type": "client_credentials", "client_id": cid, "client_secret": secret,
            "scope": "creatorsapi::default"})
        if r.status_code != 200:
            raise RuntimeError(f"token da Creators API respondeu HTTP {r.status_code}")
        dados = r.json()
        self._token = dados["access_token"]
        segredos.registrar_valor_sensivel(self._token)
        self._expira = time.time() + float(dados.get("expires_in") or 3600)
        return self._token

    def buscar(self, produto: Produto, max_resultados: int, cep: str) -> list[Oferta]:
        _, _, tag = self._cred()
        marketplace = segredos.obter("AMAZON_MARKETPLACE") or MARKETPLACE
        ofertas: list[Oferta] = []
        paginas = max(1, min(3, -(-max_resultados // 10)))   # a API devolve até 10 itens por página
        for pagina in range(1, paginas + 1):
            corpo = {
                "keywords": produto.busca, "marketplace": marketplace, "partnerTag": tag,
                "partnerType": "Associates", "searchIndex": "All", "condition": "New",
                "itemCount": 10, "itemPage": pagina, "resources": RECURSOS,
            }
            r = self.sessao.post(segredos.obter("AMAZON_API_URL") or API_URL, json=corpo, timeout=TIMEOUT, headers={
                "Authorization": f"Bearer {self._obter_token()}", "x-marketplace": marketplace,
                "Content-Type": "application/json"})
            if r.status_code != 200:
                raise RuntimeError(f"searchItems respondeu HTTP {r.status_code}")
            itens = pegar(r.json(), "searchResult.items", []) or []
            ofertas.extend(o for o in (self._converter(i) for i in itens) if o)
            if len(itens) < 10:
                break
        return ofertas[:max_resultados]

    def _converter(self, item: dict) -> Oferta | None:
        listagens = pegar(item, "offersV2.listings", []) or []
        if not listagens:
            return None
        lst = next((x for x in listagens if x.get("isBuyBoxWinner")), listagens[0])
        preco = para_float(pegar(lst, "price.money.amount"))
        if preco is None:
            return None
        vendedor = pegar(lst, "merchantInfo.name")
        da_amazon = bool(vendedor) and vendedor.lower().startswith("amazon")
        eans = pegar(item, "itemInfo.externalIds.eans.displayValues", []) or []
        cond = (pegar(lst, "condition.value") or "").lower()
        return Oferta(
            loja=self.nome, id_anuncio=str(item.get("asin")), titulo=pegar(item, "itemInfo.title.displayValue", ""),
            preco=preco, link=item.get("detailPageURL") or f"https://www.amazon.com.br/dp/{item.get('asin')}",
            ean=eans[0] if eans else None,
            condicao={"new": "novo", "used": "usado", "refurbished": "recondicionado"}.get(cond, cond or None),
            reputacao="propria" if da_amazon else None,   # vendido e entregue pela Amazon
            oficial=da_amazon, vendedor=vendedor,
        )
