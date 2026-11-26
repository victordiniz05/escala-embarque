"""Implementação SQLite da camada de dados (data/precos.db, commitado pelo workflow).

Não grava nenhum dado pessoal: nada de CEP, chat_id ou tokens.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

from ..modelos import Oferta
from .base import Atual, Registro, Repositorio

ESQUEMA = """
CREATE TABLE IF NOT EXISTS precos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto TEXT NOT NULL,
    loja TEXT NOT NULL,
    id_anuncio TEXT NOT NULL,
    titulo TEXT NOT NULL,
    preco REAL,
    frete REAL,
    preco_final REAL,
    link TEXT NOT NULL,
    data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_precos_anuncio ON precos(produto, loja, id_anuncio, data);
CREATE INDEX IF NOT EXISTS idx_precos_data ON precos(data);

CREATE TABLE IF NOT EXISTS atuais (
    produto TEXT NOT NULL,
    loja TEXT NOT NULL,
    id_anuncio TEXT NOT NULL,
    titulo TEXT NOT NULL,
    preco REAL NOT NULL,
    frete REAL,
    preco_final REAL NOT NULL,
    link TEXT NOT NULL,
    desde TEXT NOT NULL,
    visto_em TEXT NOT NULL,
    PRIMARY KEY (produto, loja, id_anuncio)
);

CREATE TABLE IF NOT EXISTS alertas (
    loja TEXT NOT NULL,
    id_anuncio TEXT NOT NULL,
    preco_final REAL NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (loja, id_anuncio)
);

CREATE TABLE IF NOT EXISTS saude (
    loja TEXT PRIMARY KEY,
    falhas_seguidas INTEGER NOT NULL DEFAULT 0,
    alertado INTEGER NOT NULL DEFAULT 0,
    ultimo_erro TEXT,
    data TEXT
);

CREATE TABLE IF NOT EXISTS estado (
    chave TEXT PRIMARY KEY,
    valor TEXT
);
"""


def _igual(a: float | None, b: float | None) -> bool:
    if a is None or b is None:
        return a is b
    return abs(a - b) < 0.005


class RepositorioSQLite(Repositorio):
    def __init__(self, caminho: Path | str):
        if str(caminho) != ":memory:":
            Path(caminho).parent.mkdir(parents=True, exist_ok=True)
        self.con = sqlite3.connect(str(caminho))
        self.con.row_factory = sqlite3.Row
        self.con.executescript(ESQUEMA)
        self.con.commit()

    # --- histórico -----------------------------------------------------------
    def _ultimo(self, produto: str, loja: str, id_anuncio: str):
        return self.con.execute(
            "SELECT * FROM precos WHERE produto=? AND loja=? AND id_anuncio=? ORDER BY data DESC, id DESC LIMIT 1",
            (produto, loja, id_anuncio),
        ).fetchone()

    def registrar_preco(self, produto: str, oferta: Oferta, quando: str) -> bool:
        ult = self._ultimo(produto, oferta.loja, oferta.id_anuncio)
        if ult is not None and _igual(ult["preco"], oferta.preco) and _igual(ult["frete"], oferta.frete) \
                and _igual(ult["preco_final"], oferta.preco_final):
            return False
        self.con.execute(
            "INSERT INTO precos (produto, loja, id_anuncio, titulo, preco, frete, preco_final, link, data)"
            " VALUES (?,?,?,?,?,?,?,?,?)",
            (produto, oferta.loja, oferta.id_anuncio, oferta.titulo, oferta.preco, oferta.frete,
             oferta.preco_final, oferta.link, quando),
        )
        self.con.commit()
        return True

    def atualizar_atuais(self, produto: str, loja: str, ofertas: list[Oferta], quando: str) -> None:
        antigos = {
            r["id_anuncio"]: r for r in self.con.execute(
                "SELECT * FROM atuais WHERE produto=? AND loja=?", (produto, loja))
        }
        novos = {o.id_anuncio: o for o in ofertas}
        for id_anuncio, r in antigos.items():
            if id_anuncio not in novos:
                self.con.execute(
                    "INSERT INTO precos (produto, loja, id_anuncio, titulo, preco, frete, preco_final, link, data)"
                    " VALUES (?,?,?,?,NULL,NULL,NULL,?,?)",
                    (produto, loja, id_anuncio, r["titulo"], r["link"], quando),
                )
        self.con.execute("DELETE FROM atuais WHERE produto=? AND loja=?", (produto, loja))
        for o in novos.values():
            ant = antigos.get(o.id_anuncio)
            mudou = ant is None or not _igual(ant["preco_final"], o.preco_final) or not _igual(ant["frete"], o.frete)
            desde = quando if mudou else ant["desde"]
            self.con.execute(
                "INSERT INTO atuais VALUES (?,?,?,?,?,?,?,?,?,?)",
                (produto, loja, o.id_anuncio, o.titulo, o.preco, o.frete, o.preco_final, o.link, desde, quando),
            )
        self.con.commit()

    def atuais(self, produto: str | None = None) -> list[Atual]:
        sql, args = "SELECT * FROM atuais", ()
        if produto is not None:
            sql, args = sql + " WHERE produto=?", (produto,)
        return [Atual(**dict(r)) for r in self.con.execute(sql + " ORDER BY produto, loja, preco_final, link", args)]

    def _registros(self, sql: str, args: tuple) -> list[Registro]:
        return [Registro(**{k: r[k] for k in Registro.__dataclass_fields__}) for r in self.con.execute(sql, args)]

    def historico(self, produto: str, desde: str | None = None) -> list[Registro]:
        if desde:
            return self._registros(
                "SELECT * FROM precos WHERE produto=? AND data>=? ORDER BY data, id", (produto, desde))
        return self._registros("SELECT * FROM precos WHERE produto=? ORDER BY data, id", (produto,))

    def historico_anuncio(self, produto: str, loja: str, id_anuncio: str) -> list[Registro]:
        return self._registros(
            "SELECT * FROM precos WHERE produto=? AND loja=? AND id_anuncio=? ORDER BY data, id",
            (produto, loja, id_anuncio))

    def menor_preco(self, produto: str) -> float | None:
        r = self.con.execute(
            "SELECT MIN(preco_final) FROM precos WHERE produto=? AND preco_final IS NOT NULL", (produto,)
        ).fetchone()
        return r[0]

    def limpar_antigos(self, antes_de: str) -> int:
        cur = self.con.execute(
            # Mantém o último registro de cada anúncio ainda presente, para não perder o preço vigente.
            """DELETE FROM precos WHERE data < ? AND id NOT IN (
                   SELECT MAX(p.id) FROM precos p
                   JOIN atuais a ON a.produto=p.produto AND a.loja=p.loja AND a.id_anuncio=p.id_anuncio
                   GROUP BY p.produto, p.loja, p.id_anuncio)""",
            (antes_de,),
        )
        self.con.execute("DELETE FROM alertas WHERE data < ?", (antes_de,))
        self.con.commit()
        return cur.rowcount

    def remover_produto(self, produto: str) -> None:
        self.con.execute("DELETE FROM precos WHERE produto=?", (produto,))
        self.con.execute("DELETE FROM atuais WHERE produto=?", (produto,))
        self.con.commit()

    # --- anti-spam -----------------------------------------------------------
    def ultimo_alerta(self, loja: str, id_anuncio: str):
        r = self.con.execute(
            "SELECT preco_final, data FROM alertas WHERE loja=? AND id_anuncio=?", (loja, id_anuncio)
        ).fetchone()
        return (r[0], r[1]) if r else None

    def registrar_alerta(self, loja: str, id_anuncio: str, preco_final: float, quando: str) -> None:
        self.con.execute("INSERT OR REPLACE INTO alertas VALUES (?,?,?,?)", (loja, id_anuncio, preco_final, quando))
        self.con.commit()

    # --- saúde ---------------------------------------------------------------
    def saude(self, loja: str) -> tuple[int, bool]:
        r = self.con.execute("SELECT falhas_seguidas, alertado FROM saude WHERE loja=?", (loja,)).fetchone()
        return (r[0], bool(r[1])) if r else (0, False)

    def salvar_saude(self, loja: str, falhas: int, alertado: bool, erro: str, quando: str) -> None:
        self.con.execute(
            "INSERT OR REPLACE INTO saude VALUES (?,?,?,?,?)", (loja, falhas, int(alertado), erro or None, quando))
        self.con.commit()

    # --- estado --------------------------------------------------------------
    def estado(self, chave: str, padrao: str | None = None) -> str | None:
        r = self.con.execute("SELECT valor FROM estado WHERE chave=?", (chave,)).fetchone()
        return r[0] if r and r[0] is not None else padrao

    def salvar_estado(self, chave: str, valor: str | None) -> None:
        if valor is None:
            self.con.execute("DELETE FROM estado WHERE chave=?", (chave,))
        else:
            self.con.execute("INSERT OR REPLACE INTO estado VALUES (?,?)", (chave, valor))
        self.con.commit()

    def fechar(self) -> None:
        self.con.execute("VACUUM")
        self.con.close()
