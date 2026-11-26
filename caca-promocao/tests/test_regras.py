from datetime import datetime, timedelta, timezone

from caca.agrupamento import agrupar
from caca.analise import avaliar, iso, media_ponderada, passa_antispam
from caca.config import PADROES
from caca.db.base import Registro
from caca.db.sqlite import RepositorioSQLite
from caca.filtros import motivo_rejeicao_final, motivo_rejeicao_inicial
from caca.mensagens import brl
from caca.modelos import Oferta, Produto
from caca.texto import contem_termo

AGORA = datetime(2026, 11, 26, 12, tzinfo=timezone.utc)


def oferta(**kw):
    base = dict(loja="ml", id_anuncio="1", titulo="Purificador de Água Elétrico", preco=500.0, link="https://x")
    base.update(kw)
    return Oferta(**base)


def test_termo_palavra_inteira_e_plural():
    assert contem_termo("Capa protetora", "capa")
    assert contem_termo("Kit 2 capas", "capa")
    assert not contem_termo("Purificador capacidade 1L", "capa")
    assert contem_termo("Peças de reposição", "peça")
    assert contem_termo("ELEMENTO  FILTRANTE p/ purificador", "elemento filtrante")


def test_filtro_palavras_e_condicao():
    p = Produto(nome="P", busca="purificador", palavras_obrigatorias=["purificador"],
                palavras_proibidas=["refil", "capa"], preco_maximo=600)
    assert motivo_rejeicao_inicial(p, oferta()) is None
    assert motivo_rejeicao_inicial(p, oferta(titulo="Refil para purificador")) is not None
    assert motivo_rejeicao_inicial(p, oferta(titulo="Filtro de água")) is not None
    assert motivo_rejeicao_inicial(p, oferta(condicao="usado")) is not None
    assert motivo_rejeicao_inicial(p, oferta(titulo="Purificador seminovo")) is not None
    assert motivo_rejeicao_inicial(p, oferta(preco=700)) is not None


def test_reputacao_desconhecida_nao_descarta():
    p = Produto(nome="P", busca="x", reputacao_minima="verde")
    assert motivo_rejeicao_final(p, oferta(reputacao=None)) is None
    assert motivo_rejeicao_final(p, oferta(reputacao="propria")) is None
    assert motivo_rejeicao_final(p, oferta(reputacao="amarelo")) is not None
    assert motivo_rejeicao_final(p, oferta(reputacao="verde")) is None


def test_preco_final_pix_e_frete():
    assert oferta(preco=100, preco_pix=90, frete=15).preco_final == 105
    o = oferta(preco=100, frete=None)
    assert o.preco_final == 100 and not o.frete_confirmado
    assert brl(1234.5) == "R$ 1.234,50"
    assert brl(None) == "a confirmar"


def test_agrupamento_por_ean_e_titulo():
    a = oferta(loja="ml", id_anuncio="a", titulo="Aspirador Vertical X100 Sem Fio", preco=500, ean="789")
    b = oferta(loja="amazon", id_anuncio="b", titulo="Outro nome qualquer", preco=450, ean="789")
    c = oferta(loja="kabum", id_anuncio="c", titulo="Aspirador Sem Fio Vertical X100", preco=480)
    d = oferta(loja="kabum", id_anuncio="d", titulo="Purificador Colormaq", preco=300)
    grupos = agrupar([a, b, c, d])
    assert [o.id_anuncio for o in grupos[0]] == ["d"]
    assert {o.id_anuncio for o in grupos[1]} == {"a", "b", "c"}
    assert grupos[1][0].id_anuncio == "b"   # melhor preço primeiro


def reg(preco, dias_atras):
    return Registro("P", "ml", "1", "t", preco, 0, preco, "l", iso(AGORA - timedelta(days=dias_atras)))


def test_media_ponderada_pelo_tempo():
    # 1000 por 20 dias, depois 800 por 10 dias -> (1000*20 + 800*10)/30
    media, dias = media_ponderada([reg(1000, 40), reg(800, 10)], AGORA, 30)
    assert round(media, 2) == round((1000 * 20 + 800 * 10) / 30, 2)
    assert round(dias) == 30
    # período em que o anúncio sumiu não conta
    media, dias = media_ponderada([reg(1000, 10), reg(None, 5)], AGORA, 30)
    assert media == 1000 and round(dias) == 5


def test_gatilhos():
    cfg = PADROES
    p = Produto(nome="P", busca="x", preco_alvo=0)
    assert avaliar(oferta(preco=840), p, 1000, 30, cfg).queda          # 16% abaixo
    assert not avaliar(oferta(preco=860), p, 1000, 30, cfg).queda      # 14%
    assert not avaliar(oferta(preco=500), p, 1000, 2, cfg).queda       # histórico curto
    p.preco_alvo = 500
    assert avaliar(oferta(preco=500), p, None, 0, cfg).abaixo_alvo


def test_antispam():
    repo = RepositorioSQLite(":memory:")
    o = oferta(preco=500)
    assert passa_antispam(repo, o, AGORA, 24)
    repo.registrar_alerta("ml", "1", 500, iso(AGORA - timedelta(hours=2)))
    assert not passa_antispam(repo, o, AGORA, 24)
    assert passa_antispam(repo, oferta(preco=490), AGORA, 24)           # caiu mais
    assert passa_antispam(repo, o, AGORA + timedelta(hours=23), 24)     # 25h depois


def test_historico_enxuto_e_limpeza():
    repo = RepositorioSQLite(":memory:")
    t = lambda d: iso(AGORA - timedelta(days=d))  # noqa: E731
    assert repo.registrar_preco("P", oferta(preco=500), t(100))
    assert not repo.registrar_preco("P", oferta(preco=500), t(99))      # sem mudança
    assert repo.registrar_preco("P", oferta(preco=480), t(95))
    repo.atualizar_atuais("P", "ml", [oferta(preco=480)], t(95))
    apagados = repo.limpar_antigos(t(90))
    assert apagados == 1                                                # o último (vigente) fica
    assert [r.preco for r in repo.historico("P")] == [480]
    # anúncio que sumiu ganha um registro "saiu"
    repo.atualizar_atuais("P", "ml", [], t(1))
    assert repo.historico("P")[-1].preco_final is None
    assert repo.atuais("P") == []
