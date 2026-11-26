"""Regras de alerta: preço-alvo, queda sobre a média e anti-spam."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from .db.base import Registro, Repositorio
from .modelos import Oferta, Produto


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def de_iso(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def media_ponderada(registros: list[Registro], agora: datetime, dias: int) -> tuple[float | None, float]:
    """Média do preço final ponderada pelo tempo em que cada preço valeu.

    Como o histórico só grava mudanças, uma média simples dos registros seria
    enviesada. Períodos em que o anúncio sumiu da busca não contam.
    Retorna (média, dias cobertos).
    """
    inicio = agora - timedelta(days=dias)
    soma = duracao = 0.0
    for i, r in enumerate(registros):
        t0 = de_iso(r.data)
        t1 = de_iso(registros[i + 1].data) if i + 1 < len(registros) else agora
        t0, t1 = max(t0, inicio), min(t1, agora)
        if r.preco_final is None or t1 <= t0:
            continue
        seg = (t1 - t0).total_seconds()
        soma += r.preco_final * seg
        duracao += seg
    if duracao <= 0:
        return None, 0.0
    return soma / duracao, duracao / 86400


@dataclass
class Avaliacao:
    oferta: Oferta
    media: float | None
    pct_abaixo_media: float | None
    abaixo_alvo: bool
    queda: bool

    @property
    def dispara(self) -> bool:
        return self.abaixo_alvo or self.queda


def avaliar(o: Oferta, produto: Produto, media: float | None, dias_cobertos: float, cfg: dict) -> Avaliacao:
    alertas = cfg["alertas"]
    pct = None
    if media:
        pct = (media - o.preco_final) / media * 100
    queda = (pct is not None and dias_cobertos >= float(alertas["min_dias_para_media"])
             and pct >= float(alertas["queda_percentual"]))
    alvo = produto.preco_alvo > 0 and o.preco_final <= produto.preco_alvo
    return Avaliacao(o, media, pct, alvo, queda)


def passa_antispam(repo: Repositorio, o: Oferta, agora: datetime, horas: float) -> bool:
    ult = repo.ultimo_alerta(o.loja, o.id_anuncio)
    if ult is None:
        return True
    preco_ant, quando = ult
    if o.preco_final < preco_ant - 0.005:
        return True  # caiu mais desde o último alerta
    return agora - de_iso(quando) >= timedelta(hours=horas)
