"""Execução completa com loja e Telegram falsos."""
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

import caca.monitor as monitor
from caca import segredos
from caca.analise import iso
from caca.comandos import Contexto, processar
from caca.config import carregar_config, carregar_produtos
from caca.db.sqlite import RepositorioSQLite
from caca.modelos import Oferta, Produto
from lojas.base import Loja

RAIZ = Path(__file__).resolve().parent.parent


class TelegramFalso:
    def __init__(self, updates=None, chat_id="42"):
        self.chat_id = chat_id
        self.ativo = True
        self.enviadas: list[str] = []
        self.fotos: list[str] = []
        self.updates = updates or []

    def enviar(self, texto):
        self.enviadas.append(texto)
        return True

    def enviar_foto(self, png, legenda=""):
        assert png.startswith(b"\x89PNG")
        self.fotos.append(legenda)
        return True

    def atualizacoes(self, offset):
        return [u for u in self.updates if offset is None or u["update_id"] >= offset]


class LojaFalsa(Loja):
    nome = "falsa"
    nome_exibicao = "Loja Falsa"
    precos: dict = {}
    falhar = False

    def disponivel(self):
        return True

    def buscar(self, produto, max_resultados, cep):
        if self.falhar:
            raise RuntimeError(f"caiu (cep {cep})")
        return [Oferta(loja="falsa", id_anuncio=k, titulo=t, preco=p, link=f"https://loja/{k}")
                for k, (t, p) in self.precos.items()]

    def completar(self, ofertas, cep):
        for o in ofertas:
            o.frete = 10.0 if o.id_anuncio == "a" else None
            o.reputacao = "verde"


class LojaSemCredencial(Loja):
    nome = "semcred"

    def disponivel(self):
        return False

    def buscar(self, *a):
        raise AssertionError("não deveria ser chamada")


@pytest.fixture
def projeto(tmp_path, monkeypatch):
    shutil.copy(RAIZ / "config.yaml", tmp_path / "config.yaml")
    (tmp_path / "produtos.yaml").write_text("""produtos:
  - nome: "Aspirador"
    busca: "aspirador"
    preco_alvo: 0
    lojas: [falsa, semcred]
    palavras_obrigatorias: [aspirador]
    palavras_proibidas: [saco]
    reputacao_minima: verde
""", encoding="utf-8")
    loja = LojaFalsa()
    LojaFalsa.falhar = False
    LojaFalsa.precos = {"a": ("Aspirador Vertical X", 1000.0), "b": ("Saco para aspirador", 20.0)}
    monkeypatch.setattr("lojas.carregar_lojas", lambda: {"falsa": loja, "semcred": LojaSemCredencial()})
    tg = TelegramFalso()
    monkeypatch.setattr(monitor, "Telegram", lambda: tg)
    monkeypatch.setenv("CEP_DESTINO", "01310-100")
    return tmp_path, tg


def rodar(raiz, quando, forcar=True, monkeypatch=None):
    class DT(datetime):
        @classmethod
        def now(cls, tz=None):
            return quando

    monitor.datetime = DT
    try:
        return monitor.executar(monitor.Opcoes(forcar=forcar, raiz=raiz, site=raiz / "site"))
    finally:
        monitor.datetime = datetime


def test_fluxo_completo(projeto):
    raiz, tg = projeto
    t0 = datetime(2026, 10, 1, 12, tzinfo=timezone.utc)
    assert rodar(raiz, t0) == 0
    assert tg.enviadas == []                                   # sem histórico, sem alerta
    csv = (raiz / "data" / "precos_atuais.csv").read_text()
    assert csv.splitlines() == ["produto,loja,preco,frete,preco_final,data,link",
                                "Aspirador,falsa,1000.00,10.00,1010.00,2026-10-01T12:00:00Z,https://loja/a"]
    assert "01310" not in csv

    # 20 dias depois, mesmo preço: CSV idêntico (formato estável)
    rodar(raiz, t0 + timedelta(days=20))
    assert (raiz / "data" / "precos_atuais.csv").read_text() == csv

    # queda de 20%: alerta
    LojaFalsa.precos = {"a": ("Aspirador Vertical X", 800.0)}
    rodar(raiz, t0 + timedelta(days=21))
    assert len(tg.enviadas) == 1
    msg = tg.enviadas[0]
    assert "Aspirador" in msg and "R$ 810,00" in msg and "Loja Falsa" in msg and "%" in msg

    # mesma queda 2h depois: anti-spam segura
    rodar(raiz, t0 + timedelta(days=21, hours=2))
    assert len(tg.enviadas) == 1

    # a loja falha 3 vezes seguidas -> um alerta de saúde, sem derrubar a execução
    LojaFalsa.falhar = True
    for h in (3, 4, 5, 6):
        assert rodar(raiz, t0 + timedelta(days=21, hours=h)) == 0
    saude = [m for m in tg.enviadas if "falhou" in m]
    assert len(saude) == 1 and "01310" not in saude[0] and "***" in saude[0]
    LojaFalsa.falhar = False
    rodar(raiz, t0 + timedelta(days=21, hours=7))
    assert "voltou" in tg.enviadas[-1]

    repo = RepositorioSQLite(raiz / "data" / "precos.db")
    assert [r.preco for r in repo.historico("Aspirador")] == [1000.0, 800.0]   # só mudanças
    assert (raiz / "site" / "index.html").exists() and (raiz / "site" / "graficos" / "aspirador.png").exists()
    dump = "\n".join(repo.con.iterdump())
    assert "01310" not in dump and "42" not in dump.replace("2026-", "")


def test_intervalo_e_black_friday(projeto):
    raiz, tg = projeto
    t = datetime(2026, 11, 20, 12, tzinfo=timezone.utc)
    rodar(raiz, t, forcar=False)
    LojaFalsa.precos = {"a": ("Aspirador Vertical X", 999.0)}
    rodar(raiz, t + timedelta(hours=1), forcar=False)            # fora da BF: não busca
    repo = RepositorioSQLite(raiz / "data" / "precos.db")
    assert len(repo.historico("Aspirador")) == 1
    repo.fechar()
    bf = datetime(2026, 11, 27, 12, tzinfo=timezone.utc)
    rodar(raiz, bf, forcar=False)
    LojaFalsa.precos = {"a": ("Aspirador Vertical X", 950.0)}
    rodar(raiz, bf + timedelta(hours=1), forcar=False)           # na BF: busca de hora em hora
    repo = RepositorioSQLite(raiz / "data" / "precos.db")
    assert [r.preco for r in repo.historico("Aspirador")] == [1000.0, 999.0, 950.0]


def test_resumo_semanal(projeto):
    raiz, tg = projeto
    domingo = datetime(2026, 11, 29, 23, 30, tzinfo=timezone.utc)   # 20h30 em Brasília
    rodar(raiz, domingo)
    assert any("Resumo semanal" in m for m in tg.enviadas) and len(tg.fotos) == 1
    rodar(raiz, domingo + timedelta(hours=1))
    assert len(tg.fotos) == 1                                        # uma vez por semana


def _upd(i, texto, chat=42):
    return {"update_id": i, "message": {"chat": {"id": chat}, "text": texto}}


def test_comandos(tmp_path):
    repo = RepositorioSQLite(":memory:")
    produtos = [Produto(nome="Purificador de água", busca="purificador", lojas=["mercadolivre"])]
    tg = TelegramFalso([
        _upd(1, "/lista", chat=999),                                  # outro usuário: ignorado
        _upd(2, "/add Air fryer | air fryer 5 litros | 349,90 | mercadolivre, amazon"),
        _upd(3, "/pausar purificador"),
        _upd(4, "/add X | y | 10 | lojaquenaoexiste"),
        _upd(5, "/buscar@MeuBot"),
        _upd(6, "/historico air fryer"),
        _upd(7, "/remover Air fryer"),
        _upd(8, "/lista"),
    ])
    ctx = Contexto(produtos=produtos, repo=repo, telegram=tg, cfg=carregar_config(RAIZ / "config.yaml"),
                   lojas={"mercadolivre": "Mercado Livre", "amazon": "Amazon", "kabum": "KaBuM!"})
    processar(ctx)
    assert len(tg.enviadas) == 7                                      # nada para o chat 999
    assert "Cadastrado" in tg.enviadas[0] and "R$ 349,90" in tg.enviadas[0]
    assert "Pausado" in tg.enviadas[1] and not produtos[0].ativo
    assert "desconhecida" in tg.enviadas[2]
    assert ctx.forcar_busca
    assert "Ainda não há histórico" in tg.enviadas[4]
    assert [p.nome for p in produtos] == ["Purificador de água"]
    assert repo.estado("telegram_offset") == "9"


def test_produtos_yaml_do_usuario():
    ps = carregar_produtos(RAIZ / "produtos.yaml")
    assert [p.nome for p in ps] == ["Purificador de água", "Aspirador de pó"]
    assert ps[1].preco_maximo == 1000 and "filtro hepa" in ps[1].palavras_proibidas


def test_sanitizar(monkeypatch):
    monkeypatch.setenv("TELEGRAM_TOKEN", "123456:ABCDEF")
    monkeypatch.setenv("CEP_DESTINO", "01310-100")
    s = segredos.sanitizar("https://api.telegram.org/bot123456:ABCDEF/x?zip=01310100 e 01310-100")
    assert "ABCDEF" not in s and "01310" not in s
