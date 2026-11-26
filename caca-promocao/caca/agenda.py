"""Quando buscar e quando mandar o resumo semanal.

O workflow roda a cada hora; o programa decide se é hora de buscar:
a cada `busca.intervalo_horas` normalmente, e a cada `black_friday.intervalo_horas`
nas datas da Black Friday. Execuções sem busca só leem os comandos do Telegram.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from .analise import de_iso, iso
from .db.base import Repositorio

DIAS = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"]
TOLERANCIA = timedelta(minutes=15)   # o cron do GitHub costuma atrasar alguns minutos


def _data(s: str) -> date | None:
    try:
        return date.fromisoformat(str(s)) if s else None
    except ValueError:
        return None


def em_black_friday(cfg: dict, hoje: date) -> bool:
    bf = cfg.get("black_friday") or {}
    ini, fim = _data(bf.get("inicio")), _data(bf.get("fim"))
    return bool(ini and fim and ini <= hoje <= fim)


def intervalo_horas(cfg: dict, agora: datetime) -> float:
    hoje = agora.astimezone(ZoneInfo(cfg["fuso"])).date()
    if em_black_friday(cfg, hoje):
        return float(cfg["black_friday"]["intervalo_horas"])
    return float(cfg["busca"]["intervalo_horas"])


def busca_devida(repo: Repositorio, cfg: dict, agora: datetime) -> bool:
    ultima = repo.estado("ultima_busca")
    if not ultima:
        return True
    return agora - de_iso(ultima) >= timedelta(hours=intervalo_horas(cfg, agora)) - TOLERANCIA


def marcar_busca(repo: Repositorio, agora: datetime) -> None:
    repo.salvar_estado("ultima_busca", iso(agora))


def resumo_devido(repo: Repositorio, cfg: dict, agora: datetime) -> bool:
    local = agora.astimezone(ZoneInfo(cfg["fuso"]))
    rs = cfg["resumo_semanal"]
    dia = str(rs.get("dia", "domingo")).lower().replace("ç", "c").replace("á", "a")
    if dia not in DIAS or local.weekday() != DIAS.index(dia) or local.hour < int(rs.get("hora", 20)):
        return False
    return repo.estado("ultimo_resumo") != local.date().isoformat()


def marcar_resumo(repo: Repositorio, cfg: dict, agora: datetime) -> None:
    repo.salvar_estado("ultimo_resumo", agora.astimezone(ZoneInfo(cfg["fuso"])).date().isoformat())
