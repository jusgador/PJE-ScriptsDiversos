// ==UserScript==
// @name         PJe - Painel: cartão de tarefa limpo (só as etiquetas de dias)
// @namespace    pje.painel.cartao-limpo
// @version      1.3.0
// @description  Esconde os ícones/botões/caixas que aparecem acima do número do processo no Painel do usuário do PJe (mantendo as duas etiquetas de dias corridos), o campo de pesquisa e as abas PROCESSOS/ETIQUETAS do topo da lista, a barra do checkbox "marcar todos", comprime a folga vertical abaixo do título e devolve a altura liberada para a lista (sem faixa branca no rodapé).
// @author       Ricardo
// @match        https://frontend-prd.trf5.jus.br/*
// @run-at       document-idle
// @grant        GM_addStyle
// ==/UserScript==

/*
 * OBSERVAÇÕES
 * 1) O painel do PJe roda dentro de um <iframe> cujo host é
 *    https://frontend-prd.trf5.jus.br/ — por isso o @match é nesse domínio
 *    (e NÃO no pje1g.trf5.jus.br, que é apenas a página "moldura").
 *    Se o seu tribunal usar outro host de frontend, acrescente uma linha
 *    @match equivalente (ex.: https://frontend.trf1.jus.br/*).
 *
 * 2) Tudo é feito por CSS. Nenhum elemento é removido do DOM, então nada
 *    quebra funcionalidade de forma irreversível: basta mudar a constante
 *    MOSTRAR abaixo (ou desativar o script no Tampermonkey).
 *
 * 3) Para "voltar atrás" em um item só, troque false por true em MOSTRAR.
 */

(function () {
    'use strict';

    /* ============================================================
       CONFIGURAÇÃO — coloque true no que você QUER QUE APAREÇA
       ============================================================ */
    const MOSTRAR = {
        // Bloco esquerdo do cabeçalho: ícones de "tarefa bloqueada por",
        // nível de sigilo, liminar, processo prioritário, conferido e as
        // prioridades do processo (ícones de documento/cifrão/pessoa).
        iconesEsquerda: false,

        // Alfinete de lembretes (pje-lembretes) — inclui o botão "Criar lembrete".
        lembretes: false,

        // Ícone "Abrir autos" (documento azul / pje-link-autos-digitais).
        abrirAutos: false,

        // Caixa de seleção do processo (usada para marcar vários e fazer ações em lote).
        checkBox: false,

        // Numeração "1/30" exibida quando o processo faz parte de um lote.
        numeracao: true,

        // Campo de pesquisa do topo da lista (input "Pesquisar" + botão de filtros + lupa).
        campoPesquisa: false,

        // Abas "PROCESSOS | ETIQUETAS" do topo da lista.
        abas: false,

        // Barra do checkbox "marcar todos" (+ botões de ação em lote) que fica
        // logo acima dos cartões, na aba PROCESSOS.
        barraSelecao: false,

        // As duas etiquetas de dias ficam SEMPRE visíveis — não há opção aqui,
        // pois são exatamente o que você quer manter.
    };

    /* ============================================================
       COMPRESSÃO — true = encolher o espaço vazio
       ============================================================ */
    const COMPRIMIR = {
        // Cabeçalho da lista (título "DESPACHO" + contador): o PJe aplica
        // height:10% e 10px de padding-bottom em #divActions, o que deixa
        // ~31px de faixa vazia logo abaixo do título.
        cabecalhoLista: true,

        // Altura (px) do cabeçalho já comprimido. Como o título usa
        // .text-truncate (nunca quebra linha), essa altura é estável:
        // 5px + 5px de padding + ~21px da linha do título = 31px.
        // Se algum dia o PJe mudar o cabeçalho, ajuste só este número.
        alturaCabecalho: 31,
    };

    /* ============================================================
       CSS
       ============================================================ */
    const regras = [];

    if (!MOSTRAR.iconesEsquerda) {
        regras.push(`
/* 1) Bloco esquerdo do cabeçalho (ícones de bloqueio/sigilo/liminar/prioridade/conferido
      + componente pje-ico-prioridades). */
.datalist-content .row.icones > div:not(.date) {
    display: none !important;
}
/* O bloco da direita passa a ocupar a linha inteira, para que as etiquetas
   continuem alinhadas à direita (senão elas "escorregariam" para a esquerda,
   porque o Bootstrap faria a coluna de 50% flutuar no canto esquerdo). */
.datalist-content .row.icones > .date {
    float: none !important;
    width: 100% !important;
}
/* Um respiro no topo, já que a linha perdeu a altura dos ícones. */
.datalist-content .row.icones {
    padding-top: 6px;
}`);
    }

    if (!MOSTRAR.lembretes) {
        regras.push(`
/* 2) Alfinete de lembretes. */
.datalist-content .row.icones pje-lembretes {
    display: none !important;
}`);
    }

    if (!MOSTRAR.abrirAutos) {
        regras.push(`
/* 3) Ícone "Abrir autos". */
.datalist-content .row.icones pje-link-autos-digitais {
    display: none !important;
}`);
    }

    if (!MOSTRAR.checkBox) {
        regras.push(`
/* 4) Caixa de seleção do processo.
      Atenção: o seletor é "> div.selecionarProcesso" (filho direto) de propósito —
      a classe .selecionarProcesso também está no <a> que abre o processo,
      e esse link deve continuar funcionando. */
.datalist-content > div.selecionarProcesso {
    display: none !important;
}`);
    }

    if (!MOSTRAR.numeracao) {
        regras.push(`
/* 5) Numeração "1/30" do lote. */
.datalist-content .numeracao-do-processo-datalist-card {
    display: none !important;
}`);
    }

    if (!MOSTRAR.campoPesquisa) {
        regras.push(`
/* 6) Campo de pesquisa do topo da lista: input "Pesquisar", botão de filtros
      (caret) e botão da lupa, todos dentro do .input-group do componente
      <filtro-tarefas>. O título da tarefa e o badge de quantidade NÃO saem,
      pois ficam fora do .input-group. */
filtro-tarefas .input-group {
    display: none !important;
}`);
    }

    if (!MOSTRAR.abas) {
        regras.push(`
/* 7) Abas "PROCESSOS | ETIQUETAS". Só a barra de abas sai; o conteúdo
      (.tab-content, com os cartões) continua sendo exibido. */
ul#myTabs {
    display: none !important;
}
/* No CSS do PJe o .tab-content é 95% de altura porque reserva espaço para a
   barra de abas. Sem as abas, o conteúdo passa a ocupar 100%. */
.lista-processos > .tab-content {
    height: 100% !important;
}`);
    }

    if (!MOSTRAR.barraSelecao) {
        regras.push(`
/* 8) Barra do checkbox "marcar todos" (e dos botões de ação em lote) logo
      acima dos cartões. Escopo em .lista-processos para não pegar a barra
      equivalente da aba ETIQUETAS, que tem outra classe. */
.lista-processos .barra-selecao-processos {
    display: none !important;
}`);
    }

    if (COMPRIMIR.cabecalhoLista) {
        regras.push(`
/* 9) Comprime o cabeçalho da lista (título + contador). O componente aplica
      height:10% e 10px de padding-bottom em #divActions; com o campo de
      pesquisa oculto sobra uma faixa vazia abaixo do título. */
#divActions {
    height: auto !important;
    padding-bottom: 0 !important;
}
/* O painel #divProcessosTarefa tem altura fixa e o PJe dividia 10% (cabeçalho)
   + 90% (lista). Como o cabeçalho encolheu, devolvemos a diferença para a
   lista — senão sobra uma faixa branca embaixo, abaixo da paginação. */
.lista-processos {
    height: calc(100% - ${COMPRIMIR.alturaCabecalho}px) !important;
}`);
    }

    /* ============================================================
       INJEÇÃO
       ============================================================ */
    const css = regras.join('\n');

    if (!css) return; // nada configurado para esconder

    if (typeof GM_addStyle === 'function') {
        GM_addStyle(css);
    } else {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }
})();
