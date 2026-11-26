"""Estruturas de dados compartilhadas."""
from __future__ import annotations

from dataclasses import dataclass, field

# Escala de reputação (padrão do Mercado Livre). Maior = melhor.
NIVEIS_REPUTACAO = {
    "vermelho": 1,
    "laranja": 2,
    "amarelo": 3,
    "verde_claro": 4,
    "verde": 5,
}
ROTULO_REPUTACAO = {
    "vermelho": "vermelha",
    "laranja": "laranja",
    "amarelo": "amarela",
    "verde_claro": "verde-clara",
    "verde": "verde",
    "propria": "venda direta da loja",
}


@dataclass
class Produto:
    nome: str
    busca: str
    ean: str = ""
    preco_alvo: float = 0.0
    preco_maximo: float = 0.0
    lojas: list[str] = field(default_factory=list)
    palavras_obrigatorias: list[str] = field(default_factory=list)
    palavras_proibidas: list[str] = field(default_factory=list)
    reputacao_minima: str = "verde"
    ativo: bool = True

    @classmethod
    def de_dict(cls, d: dict) -> "Produto":
        return cls(
            nome=str(d["nome"]).strip(),
            busca=str(d.get("busca") or d["nome"]).strip(),
            ean=str(d.get("ean") or "").strip(),
            preco_alvo=float(d.get("preco_alvo") or 0),
            preco_maximo=float(d.get("preco_maximo") or 0),
            lojas=[str(x).strip().lower() for x in (d.get("lojas") or [])],
            palavras_obrigatorias=[str(x) for x in (d.get("palavras_obrigatorias") or [])],
            palavras_proibidas=[str(x) for x in (d.get("palavras_proibidas") or [])],
            reputacao_minima=str(d.get("reputacao_minima") or "").strip().lower(),
            ativo=bool(d.get("ativo", True)),
        )

    def para_dict(self) -> dict:
        return {
            "nome": self.nome,
            "busca": self.busca,
            "ean": self.ean,
            "preco_alvo": _num(self.preco_alvo),
            "preco_maximo": _num(self.preco_maximo),
            "lojas": list(self.lojas),
            "palavras_obrigatorias": list(self.palavras_obrigatorias),
            "palavras_proibidas": list(self.palavras_proibidas),
            "reputacao_minima": self.reputacao_minima,
            "ativo": self.ativo,
        }


def _num(v: float):
    return int(v) if float(v).is_integer() else round(v, 2)


@dataclass
class Oferta:
    """Um anúncio encontrado numa loja.

    Campos opcionais ficam como None quando a API não informa:
    nunca preencha com zero ou valor inventado.
    """

    loja: str
    id_anuncio: str
    titulo: str
    preco: float
    link: str
    frete: float | None = None          # None = a confirmar; 0.0 só se a API disser grátis
    preco_pix: float | None = None      # preço com desconto no PIX, se informado
    ean: str | None = None
    condicao: str | None = None         # "novo", "usado", ... ou None se não informado
    reputacao: str | None = None        # chave de NIVEIS_REPUTACAO, "propria" ou None
    oficial: bool = False
    full: bool = False
    estoque: int | None = None
    vendedor: str | None = None
    frete_gratis: bool = False          # a própria API declarou frete grátis

    @property
    def preco_base(self) -> float:
        if self.preco_pix is not None and 0 < self.preco_pix < self.preco:
            return self.preco_pix
        return self.preco

    @property
    def preco_final(self) -> float:
        """Preço (PIX quando houver) + frete. Sem frete conhecido, soma só o que se sabe."""
        return round(self.preco_base + (self.frete or 0.0), 2)

    @property
    def frete_confirmado(self) -> bool:
        return self.frete is not None
