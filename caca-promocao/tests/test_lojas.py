"""Conversão das respostas das APIs/feeds em Oferta (sem rede)."""
import lojas
from caca.modelos import Produto
from lojas.amazon import Amazon
from lojas.kabum import Kabum
from lojas.mercadolivre import MercadoLivre


class Resp:
    def __init__(self, status, dados):
        self.status_code, self._d = status, dados

    def json(self):
        return self._d


class Sessao:
    def __init__(self, rotas):
        self.rotas, self.chamadas = rotas, []

    def _r(self, url, **kw):
        self.chamadas.append((url, kw))
        for chave, resp in self.rotas.items():
            if chave in url:
                return resp(kw) if callable(resp) else resp
        return Resp(404, {})

    get = post = _r


PRODUTO = Produto(nome="Aspirador", busca="aspirador vertical sem fio")


def test_descoberta_automatica_e_desligadas_em_silencio():
    todas = lojas.carregar_lojas()
    assert {"mercadolivre", "amazon", "kabum"} <= set(todas)
    assert not any(l.disponivel() for l in todas.values())     # sem credenciais no ambiente de teste


def test_mercadolivre_busca_frete_e_reputacao(monkeypatch):
    monkeypatch.setenv("MERCADOLIVRE_ACCESS_TOKEN", "tok")
    ml = MercadoLivre()
    ml.sessao = Sessao({
        "/sites/MLB/search": Resp(200, {"results": [
            {"id": "MLB1", "title": "Aspirador Vertical", "price": 500, "permalink": "https://ml/1",
             "condition": "new", "official_store_id": 9, "available_quantity": 3,
             "shipping": {"free_shipping": False, "logistic_type": "fulfillment"}, "seller": {"id": 77},
             "attributes": [{"id": "GTIN", "value_name": "7891"}]},
            {"id": "MLB2", "title": "Aspirador 2", "price": 450, "condition": "new",
             "shipping": {"free_shipping": True}, "seller": {"id": 78}},
        ]}),
        "/users/77": Resp(200, {"seller_reputation": {"level_id": "5_green"}}),
        "/users/78": Resp(200, {"seller_reputation": {"level_id": None}}),
        "/items/MLB1/shipping_options": Resp(200, {"options": [{"cost": 25.9}, {"cost": 19.9}]}),
        "/items/MLB2/shipping_options": Resp(500, {}),
    })
    ml.preparar()
    of = ml.buscar(PRODUTO, 30, "01310100")
    ml.completar(of, "01310100")
    a, b = of
    assert (a.oficial, a.full, a.ean, a.frete, a.reputacao, a.condicao) == (True, True, "7891", 19.9, "verde", "novo")
    assert a.preco_final == 519.9
    assert b.frete == 0.0 and b.reputacao is None                # grátis declarado; reputação a confirmar
    assert b.link.startswith("https://produto.mercadolivre.com.br/MLB-2")


def test_mercadolivre_cai_para_catalogo_no_403(monkeypatch):
    monkeypatch.setenv("MERCADOLIVRE_ACCESS_TOKEN", "tok")
    ml = MercadoLivre()
    ml.sessao = Sessao({
        "/sites/MLB/search": Resp(403, {"message": "forbidden"}),
        "/products/search": Resp(200, {"results": [{"id": "MLBP1", "name": "Aspirador X"}]}),
        "/products/MLBP1/items": Resp(200, {"results": [
            {"item_id": "MLB9", "price": 300, "condition": "new", "seller_id": 5, "shipping": {}}]}),
    })
    ml.preparar()
    of = ml.buscar(PRODUTO, 30, "")
    ml.completar(of, "")
    assert of[0].titulo == "Aspirador X" and of[0].frete is None and "item_id:MLB9" in of[0].link


def test_mercadolivre_renova_token(monkeypatch):
    for n, v in {"MERCADOLIVRE_CLIENT_ID": "c", "MERCADOLIVRE_CLIENT_SECRET": "s",
                 "MERCADOLIVRE_REFRESH_TOKEN": "r-velho"}.items():
        monkeypatch.setenv(n, v)
    ml = MercadoLivre()
    ml.sessao = Sessao({"/oauth/token": Resp(200, {"access_token": "novo-acesso", "refresh_token": "r-novo"})})
    assert ml.disponivel()
    ml.preparar()
    assert ml.token == "novo-acesso" and ml.novo_refresh_token() == "r-novo"


def test_amazon(monkeypatch):
    for n in ("AMAZON_CREDENTIAL_ID", "AMAZON_CREDENTIAL_SECRET", "AMAZON_PARTNER_TAG"):
        monkeypatch.setenv(n, "x" + n)
    amz = Amazon()
    amz.sessao = Sessao({
        "auth/o2/token": Resp(200, {"access_token": "t", "expires_in": 3600}),
        "searchItems": Resp(200, {"searchResult": {"items": [{
            "asin": "B0X", "detailPageURL": "https://amazon.com.br/dp/B0X",
            "itemInfo": {"title": {"displayValue": "Aspirador Vertical Sem Fio"},
                         "externalIds": {"eans": {"displayValues": ["789"]}}},
            "offersV2": {"listings": [{"isBuyBoxWinner": True, "price": {"money": {"amount": 799.9}},
                                       "condition": {"value": "New"}, "merchantInfo": {"name": "Amazon.com.br"}}]},
        }]}}),
    })
    o, = amz.buscar(PRODUTO, 30, "")
    assert (o.preco, o.ean, o.condicao, o.oficial, o.reputacao, o.frete) == (799.9, "789", "novo", True, "propria", None)
    corpo = amz.sessao.chamadas[-1][1]["json"]
    assert corpo["marketplace"] == "www.amazon.com.br" and corpo["condition"] == "New"


def test_kabum_feed(monkeypatch):
    monkeypatch.setenv("KABUM_FEED_URL", "https://feed")
    k = Kabum()
    k.sessao = Sessao({"https://feed": Resp(200, {"produtos": [
        {"codigo": 1, "nome": "Aspirador Vertical Sem Fio WAP", "preco": "1.099,90", "preco_pix": 989.91,
         "link": "https://kabum/1", "estoque": 4},
        {"codigo": 2, "nome": "Aspirador Vertical Sem Fio Esgotado", "preco": 500, "estoque": 0},
        {"codigo": 3, "nome": "Purificador", "preco": 300},
    ]})})
    o, = k.buscar(PRODUTO, 30, "")
    assert (o.preco, o.preco_pix, o.preco_final, o.frete, o.reputacao) == (1099.9, 989.91, 989.91, None, "propria")
