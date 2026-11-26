"""Orquestração de uma execução (modo --once)."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from html import escape
from pathlib import Path

from . import agenda, segredos
from .agrupamento import agrupar
from .analise import Avaliacao, avaliar, iso, media_ponderada, passa_antispam
from .comandos import Contexto, processar
from .config import RAIZ, carregar_config, carregar_produtos, salvar_produtos
from .db import abrir_repositorio
from .db.base import Repositorio
from .exportar import exportar_csv
from .filtros import motivo_rejeicao_final, motivo_rejeicao_inicial
from .graficos import grafico_produto
from .mensagens import brl, mensagem_alerta, mensagem_saude, mensagem_saude_ok
from .modelos import Oferta, Produto
from .painel import gerar_painel
from .telegram import Telegram

log = logging.getLogger("caca")


@dataclass
class Opcoes:
    forcar: bool = False
    raiz: Path = RAIZ
    site: Path | None = None              # onde gerar o painel (None = raiz/site)
    arquivo_refresh_ml: Path | None = None


def _deduplicar(ofertas: list[Oferta]) -> list[Oferta]:
    melhor: dict[tuple[str, str], Oferta] = {}
    for o in ofertas:
        k = (o.loja, o.id_anuncio)
        if k not in melhor or o.preco_final < melhor[k].preco_final:
            melhor[k] = o
    return list(melhor.values())


def buscar_produto(loja, produto: Produto, cfg: dict, cep: str) -> list[Oferta]:
    brutas = loja.buscar(produto, int(cfg["busca"]["max_resultados"]), cep)
    candidatas = [o for o in _deduplicar(brutas) if motivo_rejeicao_inicial(produto, o) is None]
    loja.completar(candidatas, cep)
    finais = [o for o in candidatas if motivo_rejeicao_final(produto, o) is None]
    log.info("  %s: %d encontrados, %d após filtros", loja.nome, len(brutas), len(finais))
    return finais


def _atualizar_saude(repo: Repositorio, tg: Telegram, cfg: dict, loja, erro: str | None, quando: str) -> None:
    falhas, alertado = repo.saude(loja.nome)
    limite = int(cfg["saude"]["falhas_para_alertar"])
    if erro is None:
        if alertado:
            try:
                tg.enviar(mensagem_saude_ok(loja.rotulo))
            except Exception as e:  # noqa: BLE001
                log.warning("Não deu para avisar recuperação: %s", segredos.sanitizar(e))
        repo.salvar_saude(loja.nome, 0, False, "", quando)
        return
    falhas += 1
    if falhas >= limite and not alertado:
        try:
            alertado = tg.enviar(mensagem_saude(loja.rotulo, falhas, erro)) or not tg.ativo
        except Exception as e:  # noqa: BLE001
            log.warning("Não deu para mandar alerta de saúde: %s", segredos.sanitizar(e))
    repo.salvar_saude(loja.nome, falhas, alertado, erro, quando)


def executar_busca(repo: Repositorio, tg: Telegram, cfg: dict, produtos: list[Produto], lojas: dict,
                   agora: datetime) -> None:
    quando = iso(agora)
    cep = "".join(ch for ch in segredos.obter("CEP_DESTINO") if ch.isdigit())
    nomes = {n: l.rotulo for n, l in lojas.items()}
    ativas = {n: l for n, l in lojas.items() if l.disponivel()}
    for n in sorted(set(lojas) - set(ativas)):
        log.info("Loja %s desligada (sem credencial/feed)", n)

    erros: dict[str, str] = {}
    sem_preparo: set[str] = set()
    for n, loja in ativas.items():
        try:
            loja.preparar()
        except Exception as e:  # noqa: BLE001
            erros[n] = segredos.sanitizar(f"{type(e).__name__}: {e}")
            sem_preparo.add(n)
            log.error("Loja %s não preparou: %s", n, erros[n])

    alertas_cfg = cfg["alertas"]
    for produto in [p for p in produtos if p.ativo]:
        log.info("Produto: %s", produto.nome)
        ofertas: list[Oferta] = []
        medias: dict[tuple[str, str], tuple[float | None, float]] = {}
        for nome_loja in produto.lojas:
            loja = ativas.get(nome_loja)
            if loja is None or nome_loja in sem_preparo:
                continue
            try:
                achadas = buscar_produto(loja, produto, cfg, cep)
            except Exception as e:  # noqa: BLE001
                msg = segredos.sanitizar(f"{type(e).__name__}: {e}")
                erros.setdefault(nome_loja, msg)
                log.error("  %s falhou: %s", nome_loja, msg)
                continue
            # Média calculada ANTES de gravar o preço novo.
            for o in achadas:
                medias[(o.loja, o.id_anuncio)] = media_ponderada(
                    repo.historico_anuncio(produto.nome, o.loja, o.id_anuncio), agora, int(alertas_cfg["dias_media"]))
            for o in achadas:
                repo.registrar_preco(produto.nome, o, quando)
            repo.atualizar_atuais(produto.nome, nome_loja, achadas, quando)
            ofertas.extend(achadas)

        if not ofertas:
            continue
        menor = repo.menor_preco(produto.nome)
        for grupo in agrupar(ofertas, float(cfg["busca"]["similaridade_titulo"])):
            avals: list[Avaliacao] = [avaliar(o, produto, *medias[(o.loja, o.id_anuncio)], cfg)
                                    for o in grupo]
            novas = [a for a in avals if a.dispara and passa_antispam(repo, a.oferta, agora,
                                                                      float(alertas_cfg["antispam_horas"]))]
            if not novas:
                continue
            # A mensagem traz o grupo todo (melhor preço primeiro), com destaque para quem disparou.
            texto = mensagem_alerta(produto, avals, nomes, menor)
            try:
                enviado = tg.enviar(texto)
            except Exception as e:  # noqa: BLE001
                log.error("Falha ao enviar alerta: %s", segredos.sanitizar(e))
                continue
            if enviado:
                for a in novas:
                    repo.registrar_alerta(a.oferta.loja, a.oferta.id_anuncio, a.oferta.preco_final, quando)

    for n, loja in ativas.items():
        _atualizar_saude(repo, tg, cfg, loja, erros.get(n), quando)

    antes = iso(agora - timedelta(days=int(cfg["historico"]["dias"])))
    apagados = repo.limpar_antigos(antes)
    if apagados:
        log.info("Histórico: %d registros antigos apagados", apagados)


def enviar_resumo(repo: Repositorio, tg: Telegram, cfg: dict, produtos: list[Produto], nomes: dict,
                  agora: datetime) -> None:
    desde = iso(agora - timedelta(days=int(cfg["historico"]["dias"])))
    tg.enviar("📊 <b>Resumo semanal do caca-promocao</b>")
    for p in produtos:
        png = grafico_produto(p.nome, repo.historico(p.nome, desde), nomes, p.preco_alvo, cfg["fuso"], agora)
        atuais = repo.atuais(p.nome)
        melhor = min((a.preco_final for a in atuais), default=None)
        legenda = (f"<b>{escape(p.nome)}</b>{'' if p.ativo else ' (pausado)'}\n"
                   f"Melhor agora: {brl(melhor) if melhor is not None else '—'} · "
                   f"menor registrado: {brl(repo.menor_preco(p.nome))}")
        if png:
            tg.enviar_foto(png, legenda)
        else:
            tg.enviar(legenda + "\nSem histórico ainda.")


def executar(op: Opcoes) -> int:
    cfg = carregar_config(op.raiz / "config.yaml")
    caminho_produtos = op.raiz / "produtos.yaml"
    produtos = carregar_produtos(caminho_produtos)
    repo = abrir_repositorio(cfg, op.raiz)
    tg = Telegram()
    from lojas import carregar_lojas

    lojas = carregar_lojas()
    nomes = {n: l.rotulo for n, l in lojas.items()}
    for p in produtos:
        for n in p.lojas:
            if n not in lojas:
                log.warning("Produto %s cita loja desconhecida: %s", p.nome, n)
    agora = datetime.now(timezone.utc)
    if not tg.ativo:
        log.info("Telegram sem TELEGRAM_TOKEN/TELEGRAM_CHAT_ID: modo seco (mensagens só no log)")

    try:
        # 1. Comandos do Telegram
        ctx = Contexto(produtos=produtos, repo=repo, telegram=tg, lojas=nomes, cfg=cfg)
        try:
            processar(ctx)
        except Exception as e:  # noqa: BLE001
            log.error("Falha ao ler comandos do Telegram: %s", segredos.sanitizar(e))
        if ctx.produtos_alterados:
            salvar_produtos(produtos, caminho_produtos)
        if ctx.forcar_busca:
            repo.salvar_estado("forcar_busca", "1")

        # 2. Busca, se for a hora (ou se pedida)
        pedida = op.forcar or repo.estado("forcar_busca") == "1"
        if pedida or agenda.busca_devida(repo, cfg, agora):
            log.info("Buscando (intervalo atual: %.0f h%s)", agenda.intervalo_horas(cfg, agora),
                     ", forçada" if pedida else "")
            executar_busca(repo, tg, cfg, produtos, lojas, agora)
            agenda.marcar_busca(repo, agora)
            repo.salvar_estado("forcar_busca", None)
            ml = lojas.get("mercadolivre")
            novo = ml.novo_refresh_token() if ml else None
            if novo and op.arquivo_refresh_ml:
                op.arquivo_refresh_ml.write_text(novo, encoding="utf-8")
                op.arquivo_refresh_ml.chmod(0o600)
        else:
            log.info("Ainda não é hora de buscar (próxima conforme intervalo de %.0f h)",
                     agenda.intervalo_horas(cfg, agora))

        # 3. Resumo semanal
        if agenda.resumo_devido(repo, cfg, agora):
            try:
                enviar_resumo(repo, tg, cfg, produtos, nomes, agora)
                agenda.marcar_resumo(repo, cfg, agora)
            except Exception as e:  # noqa: BLE001
                log.error("Falha no resumo semanal: %s", segredos.sanitizar(e))

        # 4. Arquivos públicos
        exportar_csv(repo, op.raiz / "data" / "precos_atuais.csv")
        try:
            gerar_painel(repo, produtos, nomes, cfg, op.site or op.raiz / "site", agora)
        except Exception as e:  # noqa: BLE001
            log.error("Falha ao gerar o painel: %s", segredos.sanitizar(e))
    finally:
        repo.fechar()
    return 0
