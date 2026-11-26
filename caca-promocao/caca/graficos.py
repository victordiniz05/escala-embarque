"""Gráficos de histórico (matplotlib) em PNG, para o Telegram e o painel."""
from __future__ import annotations

import io
import math
from datetime import datetime
from zoneinfo import ZoneInfo

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.ticker import FuncFormatter  # noqa: E402

from .analise import de_iso  # noqa: E402
from .db.base import Registro  # noqa: E402

# Cor fixa por loja (segue a loja, não a posição). Ordem categórica validada.
CORES = ["#257de0", "#f47230", "#00b894", "#f2a600", "#ee7fac", "#008a17", "#6a4ce2", "#ec4647"]
ORDEM_LOJAS = ["mercadolivre", "amazon", "kabum"]
TEXTO, TEXTO_2, GRADE, FUNDO = "#191919", "#666666", "#e6e6e6", "#ffffff"


def cor_loja(loja: str) -> str:
    if loja in ORDEM_LOJAS:
        return CORES[ORDEM_LOJAS.index(loja)]
    return CORES[(len(ORDEM_LOJAS) + sum(map(ord, loja))) % len(CORES)]


def series_por_loja(registros: list[Registro]) -> dict[str, list[tuple[datetime, float]]]:
    """Menor preço final vigente em cada loja ao longo do tempo (degraus)."""
    vigentes: dict[str, dict[str, float]] = {}
    series: dict[str, list[tuple[datetime, float]]] = {}
    for r in sorted(registros, key=lambda r: r.data):
        loja = vigentes.setdefault(r.loja, {})
        if r.preco_final is None:
            loja.pop(r.id_anuncio, None)
        else:
            loja[r.id_anuncio] = r.preco_final
        series.setdefault(r.loja, []).append((de_iso(r.data), min(loja.values()) if loja else math.nan))
    return series


def _brl(v, _pos=None) -> str:
    return "R$ " + f"{v:,.0f}".replace(",", ".")


def _rotular_fim(ax, rotulos: list[tuple[float, datetime, str, str]]) -> None:
    """Rótulos diretos no fim de cada linha, afastados para não se sobreporem."""
    if not rotulos:
        return
    ymin, ymax = ax.get_ylim()
    folga = (ymax - ymin) * 0.06
    rotulos.sort(key=lambda r: r[0])
    posicoes: list[float] = []
    for y, *_ in rotulos:
        posicoes.append(max(y, posicoes[-1] + folga) if posicoes else y)
    xmin, xmax = ax.get_xlim()
    for (_y, x, texto, _cor), py in zip(rotulos, posicoes):
        ax.text(mdates.date2num(x) + (xmax - xmin) * 0.012, py, texto, va="center", fontsize=9, color=TEXTO,
                clip_on=False)


def grafico_produto(nome: str, registros: list[Registro], nomes_lojas: dict[str, str],
                    preco_alvo: float = 0, fuso: str = "America/Sao_Paulo",
                    agora: datetime | None = None) -> bytes | None:
    series = series_por_loja(registros)
    if not series:
        return None
    tz = ZoneInfo(fuso)
    agora = agora or datetime.now(tz)
    plt.rcParams.update({"font.size": 10, "font.family": "DejaVu Sans"})
    fig, ax = plt.subplots(figsize=(8, 4.5), dpi=150)
    fig.patch.set_facecolor(FUNDO)
    ax.set_facecolor(FUNDO)

    lojas = sorted(series, key=lambda l: (ORDEM_LOJAS.index(l) if l in ORDEM_LOJAS else 99, l))
    rotulos: list[tuple[float, datetime, str, str]] = []
    for loja in lojas:
        pts = series[loja] + [(agora, series[loja][-1][1])]
        xs = [p[0].astimezone(tz) for p in pts]
        ys = [p[1] for p in pts]
        rotulo = nomes_lojas.get(loja, loja)
        ax.plot(xs, ys, drawstyle="steps-post", color=cor_loja(loja), linewidth=2, label=rotulo,
                solid_capstyle="round")
        if not math.isnan(ys[-1]):
            ax.plot([xs[-1]], [ys[-1]], "o", color=cor_loja(loja), markersize=6,
                    markeredgecolor=FUNDO, markeredgewidth=2)
            rotulos.append((ys[-1], xs[-1], f"{rotulo} {_brl(ys[-1])}", cor_loja(loja)))

    if preco_alvo > 0:
        ax.axhline(preco_alvo, color=TEXTO_2, linewidth=1, linestyle=(0, (4, 3)))
        ax.annotate(f"alvo {_brl(preco_alvo)}", (0, preco_alvo), xycoords=("axes fraction", "data"),
                    xytext=(2, 4), textcoords="offset points", fontsize=8, color=TEXTO_2)

    ax.set_title(nome, loc="left", fontsize=13, color=TEXTO, fontweight="bold", pad=18)
    ax.text(0, 1.02, "Menor preço final por loja (preço + frete conhecido)", transform=ax.transAxes,
            fontsize=9, color=TEXTO_2)
    ax.yaxis.set_major_formatter(FuncFormatter(_brl))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d/%m", tz=tz))
    ax.xaxis.set_major_locator(mdates.AutoDateLocator(minticks=3, maxticks=8, tz=tz))
    for lado in ("top", "right", "left"):
        ax.spines[lado].set_visible(False)
    ax.spines["bottom"].set_color(GRADE)
    ax.tick_params(colors=TEXTO_2, length=0)
    ax.grid(axis="y", color=GRADE, linewidth=0.8)
    ax.set_axisbelow(True)
    if len(lojas) >= 2:
        ax.legend(loc="upper left", bbox_to_anchor=(0, -0.08), ncol=len(lojas), frameon=False,
                  labelcolor=TEXTO, fontsize=9)
    ax.margins(x=0.02, y=0.15)
    _rotular_fim(ax, rotulos)
    fig.subplots_adjust(right=0.80)
    fig.tight_layout()
    fig.subplots_adjust(right=0.80)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", facecolor=FUNDO)
    plt.close(fig)
    return buf.getvalue()
