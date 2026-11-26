"""Contrato da camada de dados.

Para trocar SQLite por Supabase (ou outro), crie uma classe que implemente estes
métodos e registre-a em `caca/db/__init__.py`. Datas são strings ISO-8601 em UTC
("2026-11-26T21:00:00Z").
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from ..modelos import Oferta


@dataclass
class Registro:
    """Um ponto do histórico. preco_final None = anúncio saiu da busca."""

    produto: str
    loja: str
    id_anuncio: str
    titulo: str
    preco: float | None
    frete: float | None
    preco_final: float | None
    link: str
    data: str


@dataclass
class Atual:
    produto: str
    loja: str
    id_anuncio: str
    titulo: str
    preco: float
    frete: float | None
    preco_final: float
    link: str
    desde: str          # quando este preço passou a valer
    visto_em: str


class Repositorio(ABC):
    # --- histórico de preços -------------------------------------------------
    @abstractmethod
    def registrar_preco(self, produto: str, oferta: Oferta, quando: str) -> bool:
        """Grava só se o preço/frete mudou desde o último registro. Retorna True se gravou."""

    @abstractmethod
    def atualizar_atuais(self, produto: str, loja: str, ofertas: list[Oferta], quando: str) -> None:
        """Substitui os anúncios atuais de (produto, loja) e marca no histórico os que sumiram."""

    @abstractmethod
    def atuais(self, produto: str | None = None) -> list[Atual]: ...

    @abstractmethod
    def historico(self, produto: str, desde: str | None = None) -> list[Registro]: ...

    @abstractmethod
    def historico_anuncio(self, produto: str, loja: str, id_anuncio: str) -> list[Registro]: ...

    @abstractmethod
    def menor_preco(self, produto: str) -> float | None: ...

    @abstractmethod
    def limpar_antigos(self, antes_de: str) -> int:
        """Apaga registros anteriores a `antes_de`, preservando o último de cada anúncio."""

    @abstractmethod
    def remover_produto(self, produto: str) -> None: ...

    # --- anti-spam -----------------------------------------------------------
    @abstractmethod
    def ultimo_alerta(self, loja: str, id_anuncio: str) -> tuple[float, str] | None: ...

    @abstractmethod
    def registrar_alerta(self, loja: str, id_anuncio: str, preco_final: float, quando: str) -> None: ...

    # --- saúde das lojas -----------------------------------------------------
    @abstractmethod
    def saude(self, loja: str) -> tuple[int, bool]:
        """(falhas_seguidas, ja_alertado)."""

    @abstractmethod
    def salvar_saude(self, loja: str, falhas: int, alertado: bool, erro: str, quando: str) -> None: ...

    # --- estado chave/valor (offset do Telegram, última busca etc.) ----------
    @abstractmethod
    def estado(self, chave: str, padrao: str | None = None) -> str | None: ...

    @abstractmethod
    def salvar_estado(self, chave: str, valor: str | None) -> None: ...

    @abstractmethod
    def fechar(self) -> None: ...
