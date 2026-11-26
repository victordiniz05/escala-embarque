"""Classe base das lojas.

Regras para toda loja:
- Use só fontes oficiais ou autorizadas (API oficial, feed autorizado). Nada de raspar site.
- `disponivel()` retorna False quando falta credencial: a loja fica desligada em silêncio.
- Em `buscar`, campos que a API não informa ficam None (frete, reputação, estoque...).
  Nunca use zero nem invente valor.
- Erros podem ser lançados à vontade: o orquestrador registra e segue com as outras lojas.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from caca.modelos import Oferta, Produto


class Loja(ABC):
    nome: str = ""          # identificador usado em produtos.yaml (ex.: "mercadolivre")
    nome_exibicao: str = ""

    @abstractmethod
    def disponivel(self) -> bool:
        """True se houver credencial/configuração para consultar a loja."""

    def preparar(self) -> None:
        """Chamado uma vez por execução antes das buscas (ex.: renovar token)."""

    @abstractmethod
    def buscar(self, produto: Produto, max_resultados: int, cep: str) -> list[Oferta]:
        """Retorna os anúncios encontrados para o produto (sem filtrar por palavras)."""

    def novo_refresh_token(self) -> str | None:
        """Se a loja renovou um token que precisa ser salvo de volta nos Secrets."""
        return None

    def completar(self, ofertas: list[Oferta], cep: str) -> None:
        """Preenche dados caros (frete para o CEP, reputação) só nas ofertas que passaram
        nos filtros de título/preço. Padrão: nada a fazer."""

    @property
    def rotulo(self) -> str:
        return self.nome_exibicao or self.nome
