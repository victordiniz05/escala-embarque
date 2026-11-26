"""Leitura e gravação de config.yaml e produtos.yaml."""
from __future__ import annotations

from pathlib import Path

import yaml

from .modelos import Produto

RAIZ = Path(__file__).resolve().parent.parent

PADROES = {
    "alertas": {"queda_percentual": 15, "dias_media": 30, "min_dias_para_media": 7, "antispam_horas": 24},
    "busca": {"max_resultados": 30, "intervalo_horas": 6, "similaridade_titulo": 0.8},
    "historico": {"dias": 90},
    "black_friday": {"inicio": "", "fim": "", "intervalo_horas": 1},
    "resumo_semanal": {"dia": "domingo", "hora": 20},
    "saude": {"falhas_para_alertar": 3},
    "fuso": "America/Sao_Paulo",
    "banco": {"tipo": "sqlite", "caminho": "data/precos.db"},
    "padrao_novo_produto": {"reputacao_minima": "verde", "preco_maximo": 0, "palavras_proibidas": ["usado"]},
}

CABECALHO_PRODUTOS = """\
# Produtos monitorados. Este arquivo também é editado pelos comandos do Telegram.
# preco_alvo: 0 = sem alerta por preço-alvo (vale só a queda percentual)
# preco_maximo: 0 = sem teto
# reputacao_minima: verde | verde_claro | amarelo | laranja | vermelho
"""


def _mesclar(base: dict, extra: dict) -> dict:
    out = dict(base)
    for k, v in (extra or {}).items():
        out[k] = _mesclar(base[k], v) if isinstance(v, dict) and isinstance(base.get(k), dict) else v
    return out


def carregar_config(caminho: Path | None = None) -> dict:
    caminho = caminho or RAIZ / "config.yaml"
    dados = yaml.safe_load(caminho.read_text(encoding="utf-8")) if caminho.exists() else {}
    return _mesclar(PADROES, dados or {})


def carregar_produtos(caminho: Path | None = None) -> list[Produto]:
    caminho = caminho or RAIZ / "produtos.yaml"
    if not caminho.exists():
        return []
    dados = yaml.safe_load(caminho.read_text(encoding="utf-8")) or {}
    itens = dados.get("produtos", dados) if isinstance(dados, dict) else dados
    return [Produto.de_dict(d) for d in (itens or [])]


def salvar_produtos(produtos: list[Produto], caminho: Path | None = None) -> None:
    caminho = caminho or RAIZ / "produtos.yaml"
    corpo = yaml.safe_dump(
        {"produtos": [p.para_dict() for p in produtos]},
        allow_unicode=True, sort_keys=False, default_flow_style=None, width=200,
    )
    caminho.write_text(CABECALHO_PRODUTOS + corpo, encoding="utf-8")
