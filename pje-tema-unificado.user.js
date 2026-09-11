// ==UserScript==
// @name         PJe - Tema unificado (claro / sépia / escuro) + painel limpo
// @namespace    pje.tema.unificado
// @version      1.0.1
// @description  Script ÚNICO do PJe (TRF5): tema claro/sépia/escuro no dashboard, no painel lateral da lista de processos, na barra da tarefa, na tela da minuta e no editor (Badon Writer / ShadowRoot fechado), mais o "cartão de tarefa limpo". Botão discreto no canto inferior esquerdo cicla CLARO -> SÉPIA -> ESCURO sem recarregar a página.
// @author       Ricardo
// @updateURL    https://raw.githubusercontent.com/jusgador/PJE-ScriptsDiversos/main/pje-tema-unificado.user.js
// @downloadURL  https://raw.githubusercontent.com/jusgador/PJE-ScriptsDiversos/main/pje-tema-unificado.user.js
// @match        https://frontend-prd.trf5.jus.br/*
// @match        https://pje1g.trf5.jus.br/pje/*
// @match        https://pje2g.trf5.jus.br/pje/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// ==/UserScript==

/*
 * PJe - TEMA UNIFICADO (claro / sépia / escuro) + PAINEL LIMPO
 * ===========================================================
 *
 * Este arquivo ÚNICO substitui TRÊS userscripts antigos, agora em legacy/:
 *
 *     legacy/pje-painel-dashboard-assinaturas.user.js
 *     legacy/pje-painel-cartao-limpo.user.js
 *     legacy/pje-minuta-editor-escuro.user.js
 *
 * >>> DESATIVE OS TRÊS NO TAMPERMONKEY. <<<
 * Se ficarem ativos junto com este, as folhas antigas continuam sendo
 * injetadas em paralelo e o tema "briga" consigo mesmo.
 *
 * ---------------------------------------------------------------------------
 * O QUE ELE FAZ
 * ---------------------------------------------------------------------------
 * 1) TRÊS MODOS DE TEMA, com o mesmo CSS em todos os contextos:
 *
 *      CLARO  -> nenhuma folha de tema (é a aparência original do PJe);
 *                fica só a folha de LAYOUT, que mexe em espaço/tipografia e
 *                esconde o que CFG.mostrar manda esconder.
 *      SÉPIA  -> fundo creme, texto marrom, para leitura longa.
 *      ESCURO -> fundo #1c2128, texto claro.
 *
 *    Cada modo é um <style> próprio; a troca só alterna style.disabled, logo
 *    é instantânea — SEM recarregar a página e SEM perder a tela atual.
 *
 * 2) BOTÃO no canto inferior esquerdo (só no frame de TOPO, para existir um
 *    botão só, flutuando por cima dos iframes). O clique cicla
 *    CLARO -> SÉPIA -> ESCURO -> CLARO; o ícone (sol / livro / lua) e o
 *    title dizem o modo atual e o próximo.
 *
 * 3) O TEMA VALE EM TODAS AS CAMADAS DE FRAME, de uma vez:
 *
 *      a) PAINEL (Angular, host frontend-prd...) — cartões do dashboard,
 *         painel lateral da lista de processos e a barra da tarefa
 *         (#conteudoTarefa).
 *
 *      b) MINUTA (frame movimentar.seam) — RichFaces, faixa, folha e texto.
 *
 *      c) EDITOR (Badon Writer), que vive numa cadeia que o CSS de documento
 *         não atravessa (por isso a folha é injetada em três pontos):
 *
 *             movimentar.seam                       <- o script roda aqui
 *               └─ iframe#editorEstruturadoFrame    (about:blank, mesma origem)
 *                    └─ #badon-writer-app-container
 *                         └─ ShadowRoot FECHADO    (capturado via patch de attachShadow)
 *                              ├─ div#targetContent
 *                              └─ iframe#appEditorAreaIframe   <- O PAPEL mora aqui
 *
 *    Ou seja: folha no documento do iframe externo, folha dentro do
 *    ShadowRoot e folha no documento do iframe interno — cada camada recebe
 *    as TRÊS versões (claro/sépia/escuro) e só a do modo atual fica ligada.
 *
 * 4) PAINEL DA LISTA "LIMPO" e comprimido (checkbox, barra "marcar todos",
 *    abas, campo de pesquisa, ícones...) — configuração em CFG.mostrar e
 *    CFG.comprimir. É TUDO CSS: nada é removido do DOM, então voltar atrás é
 *    só virar a chave para true.
 *
 * 5) ESTADO em GM_setValue + localStorage. Os dois de propósito: o
 *    localStorage só enxerga a MESMA origem (os frames de pje1g), enquanto os
 *    hosts do painel (frontend-prd...) são outra origem e só compartilham
 *    pelo GM_setValue. Chave nova: 'pje-tema' = 'claro' | 'sepia' | 'escuro'.
 *    A chave antiga 'pje-tema-escuro' ('0'/'1') é LIDA (migração) e continua
 *    sendo escrita, para não desandar se algum script antigo ficar ativo.
 *
 * 6) @run-at document-start porque o patch de attachShadow precisa entrar
 *    ANTES de o Badon Writer criar o ShadowRoot. O que depende de DOM pronto
 *    (botão, cartões, observadores) espera o DOMContentLoaded.
 *
 * 7) Tipografia: a fonte e o tamanho do texto da minuta NÃO são alterados de
 *    propósito — o layout da peça (quebras de página) precisa ser preservado.
 *
 * 8) Para desligar tudo, desative este script no Tampermonkey. Para voltar a
 *    um item escondido do painel, ponha true em CFG.mostrar.<item>.
 */

(function () {
    'use strict';

    /* ============================================================
       CONFIGURAÇÃO
       ============================================================ */
    const CFG = {
        /* ---- painel Angular (dashboard) ---- */
        // Largura (em colunas de 12 do Bootstrap) dos cartões.
        colunasAssinaturas: 6,
        colunasTarefas: 6,

        // Fonte dos títulos dos cartões (px). O padrão do PJe é 14.
        tituloFonte: 16,

        // Fonte do título do cartão "Assinaturas" (px) — o destaque.
        assinaturasFonte: 20,

        // Oculta o cartão "Minhas tarefas".
        ocultarMinhasTarefas: true,

        // Visual flat: borda hairline + barra de acento, sem degradê/sombra.
        moderno: true,

        /* ---- o que o TEMA (sépia/escuro) pinta ---- */
        // Cartões do dashboard.
        cartoesTema: true,

        // Faixa do dashboard e fundo da página.
        fundoTema: true,

        // Painel lateral da lista de processos (um tom acima do fundo).
        painelListaTema: true,

        // Tela da minuta: barras, faixa em volta e a folha do documento.
        temaMinuta: true,

        /* ---- diagnóstico (dump no console). false = silêncio. ---- */
        // true = imprime o resumo do ShadowRoot e do documento interno do
        // editor (útil para redescobrir seletores se o PJe mudar).
        diagnostico: false,

        /* ---- painel da lista: true = MOSTRAR ----
           Nada é removido do DOM, então "voltar atrás" em um item só é
           trocar false por true aqui. */
        mostrar: {
            // Bloco esquerdo do cabeçalho: ícones de "tarefa bloqueada por",
            // nível de sigilo, liminar, processo prioritário, conferido e as
            // prioridades do processo (documento/cifrão/pessoa).
            iconesEsquerda: false,

            // Alfinete de lembretes (pje-lembretes), com o botão "Criar lembrete".
            lembretes: false,

            // Ícone "Abrir autos" (pje-link-autos-digitais).
            abrirAutos: false,

            // Caixa de seleção do processo (marcar vários e agir em lote).
            checkBox: false,

            // Numeração "1/30" exibida quando o processo faz parte de um lote.
            numeracao: true,

            // Campo de pesquisa do topo da lista (input + filtros + lupa).
            campoPesquisa: false,

            // Abas "PROCESSOS | ETIQUETAS" do topo da lista.
            abas: false,

            // Barra do checkbox "marcar todos" (+ ações em lote).
            barraSelecao: false,

            // As duas etiquetas de dias ficam SEMPRE visíveis — não há opção
            // aqui, pois são exatamente o que se quer manter.
        },

        /* ---- painel da lista: compressão de espaços vazios ---- */
        comprimir: {
            // Cabeçalho da lista (título + contador): o PJe aplica height:10%
            // e 10px de padding-bottom em #divActions, o que deixa uma faixa
            // vazia logo abaixo do título.
            cabecalhoLista: true,

            // Altura (px) do cabeçalho já comprimido. O título usa
            // .text-truncate (nunca quebra linha), então a altura é estável:
            // 5px + 5px de padding + ~21px da linha do título = 31px.
            alturaCabecalho: 31,
        },
    };

    /* ============================================================
       PALETAS
       Sépia e escuro usam as MESMAS chaves, porque as regras de CSS são
       geradas uma única vez e parameterizadas pela paleta do modo.
       As cores do sépia são um ponto de partida: para clarear/escurecer o
       papel, mexa só em cardBg/folhaBg/pageBg; para o texto, em texto*
       (as regras abaixo se ajustam sozinhas, em todas as camadas).
       ============================================================ */
    const PALETA = {
        sepia: {
            esquema:       'light',
            acento:        '#96601f',   // marrom de acento (texto/bordas)
            acentoClaro:   '#8a5a2b',   // fundo dos itens ativos
            cardBg:        '#fbf3e2',   // superfície (cartões, papel do editor)
            headerBg:      '#f2e7d0',   // cabeçalhos e barras
            pageBg:        '#ece0c6',   // fundo da página
            borda:         '#e0d3b8',
            bordaInput:    '#d2c0a0',
            hover:         '#f0e3c9',
            texto:         '#5b4636',
            textoForte:    '#3f2f22',
            textoSuave:    '#8a7a63',
            numero:        '#8a5a2b',
            alertaBg:      '#f7e2d6',
            alertaBorda:   '#e0b69c',
            alertaTexto:   '#8a3b1e',
            painelBg:      '#f5ecd8',   // painel lateral da lista
            painelCard:    '#fbf3e2',
            painelHover:   '#f1e4c8',
            painelBorda:   '#e0d3b8',
            folhaBg:       '#f7efdc',   // "barras" em volta do texto da minuta

            // Etiquetas de dias (verde/âmbar/vermelho) e numeração do lote. Os
            // FUNDOS são do PJe e não são tematizados — em compensação são os
            // mesmos nos dois temas —, então estas cores também são iguais nos
            // dois. Branco é o visual do PJe; o cinza escuro existe porque branco
            // sobre o cinza-claro da numeração daria 1,61:1 (ver a regra em
            // cssPainelTema()).
            etiquetaTexto:  '#ffffff',
            numeracaoTexto: '#444444',
        },
        escuro: {
            esquema:       'dark',
            acento:        '#4da3d4',   // azul do PJe, clareado para fundo escuro
            acentoClaro:   '#0077aa',   // azul original (tema claro)
            cardBg:        '#1c2128',
            headerBg:      '#22272e',
            pageBg:        '#161a20',
            borda:         '#2d333b',
            bordaInput:    '#3a434e',
            hover:         '#262c34',
            texto:         '#c9d1d9',
            textoForte:    '#e6edf3',
            textoSuave:    '#8b949e',
            numero:        '#6cb8e0',
            alertaBg:      '#3a2326',
            alertaBorda:   '#5a3438',
            alertaTexto:   '#f0b8b4',
            painelBg:      '#21262d',
            painelCard:    '#262c34',
            painelHover:   '#2d353f',
            painelBorda:   '#333b45',
            folhaBg:       '#23282f',

            // Idem sépia: os fundos das etiquetas e da numeração são do PJe, não
            // do tema, então as cores abaixo são as mesmas nos dois modos.
            etiquetaTexto:  '#ffffff',
            numeracaoTexto: '#444444',
        },
    };

    // Aparência do tema claro (o único que NÃO usa paleta: é o visual
    // original do PJe, com a folha de layout por cima).
    const CLARO = {
        esquema:     'light',
        cardBg:      '#ffffff',
        headerBg:    '#ffffff',
        pageBg:      '#ffffff',
        acento:      '#0077aa',
        borda:       '#e4e8ee',
        bordaSuave:  '#eef1f5',
        filtrosBg:   '#fafbfc',
        titulo:      '#1f2937',
    };

    /* ============================================================
       ESTADO DO TEMA
       Chave nova ('pje-tema') + migração da antiga ('pje-tema-escuro').
       Gravado nos DOIS storages de propósito (ver item 5 do cabeçalho).
       ============================================================ */
    const CHAVE = 'pje-tema';
    const CHAVE_LEGADA = 'pje-tema-escuro';
    const MODOS = ['claro', 'sepia', 'escuro'];
    const ROTULO = { claro: 'Claro', sepia: 'Sépia', escuro: 'Escuro' };
    const ICONE = { claro: '☀️', sepia: '📜', escuro: '🌙' };
    const LOG = '[pje-tema]';

    function log() {
        if (!CFG.diagnostico) return;
        try { console.log.apply(console, [LOG].concat([].slice.call(arguments))); } catch (e) { }
    }

    function modoValido(m) {
        return MODOS.indexOf(m) >= 0;
    }

    function lerTema() {
        // 1) chave nova
        try {
            if (typeof GM_getValue === 'function') {
                const v = GM_getValue(CHAVE, null);
                if (modoValido(v)) return v;
            }
        } catch (e) { }
        try {
            const v = localStorage.getItem(CHAVE);
            if (modoValido(v)) return v;
        } catch (e) { }

        // 2) migração da chave antiga ('0' = claro, '1'/ausente = escuro).
        try {
            if (typeof GM_getValue === 'function') {
                const antigo = GM_getValue(CHAVE_LEGADA, null);
                if (antigo !== null && antigo !== undefined) {
                    return antigo === false || antigo === '0' ? 'claro' : 'escuro';
                }
            }
        } catch (e) { }
        try {
            const antigo = localStorage.getItem(CHAVE_LEGADA);
            if (antigo !== null) return antigo === '0' ? 'claro' : 'escuro';
        } catch (e) { }

        // 3) padrão: escuro (é o modo que já era o padrão dos scripts antigos).
        return 'escuro';
    }

    function gravarTema(modo) {
        if (!modoValido(modo)) return;
        try {
            if (typeof GM_setValue === 'function') GM_setValue(CHAVE, modo);
        } catch (e) { }
        try { localStorage.setItem(CHAVE, modo); } catch (e) { }

        // Compatibilidade com os scripts de legacy/ (se algum ainda estiver
        // ativo, ele acompanha em vez de reverter o tema).
        const legado = modo !== 'claro';
        try {
            if (typeof GM_setValue === 'function') GM_setValue(CHAVE_LEGADA, legado);
        } catch (e) { }
        try { localStorage.setItem(CHAVE_LEGADA, legado ? '1' : '0'); } catch (e) { }
    }

    function proximoModo() {
        return MODOS[(MODOS.indexOf(temaAtual) + 1) % MODOS.length];
    }

    // Valor vivo: muda a quente, sem recarregar.
    let temaAtual = lerTema();

    /* ============================================================
       DETECÇÃO DE CONTEXTO
       ============================================================ */
    const NO_PAINEL = /frontend-/.test(location.hostname);

    // Indício de que ESTA página é a tela da minuta/editor.
    const PISTA_MINUTA = '#bd-pages-inner-container, .ProseMirror, .folha, .cke_editable, [id*=":minuta-"]';

    function temMinuta() {
        try { return !!document.querySelector(PISTA_MINUTA); } catch (e) { return false; }
    }

    // Só o frame de TOPO recebe o botão (um botão só, por cima dos iframes).
    function ehFrameDeTopo() {
        try {
            if (window === window.top) return true;
            // Mesma origem e mesmo documento => também é o topo.
            if (window.top && window.top.document === document) return true;
        } catch (e) { }
        return false;
    }

    /* ============================================================
       IDENTIFICAÇÃO DOS CARTÕES (painel)
       Os cartões do dashboard não têm id nem classe única: são
       identificados pelo texto do cabeçalho.
       ============================================================ */
    const ATRIBUTO = 'data-pje-dash';

    // texto do cabeçalho (minúsculo, espaços normalizados) -> marca
    const MARCAS = {
        'assinaturas': 'assinaturas',
        'minhas tarefas': 'minhas-tarefas',
        'tarefas': 'tarefas',
    };

    function marcarCartoes() {
        let alterados = 0;
        try {
            document.querySelectorAll('div.dashboard-item-header').forEach(function (header) {
                const cartao = header.parentElement;
                if (!cartao) return;

                const texto = header.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
                const marca = MARCAS[texto];

                if (marca && cartao.getAttribute(ATRIBUTO) !== marca) {
                    cartao.setAttribute(ATRIBUTO, marca);
                    alterados++;
                }
            });
        } catch (e) { }
        return alterados;
    }

    /* ============================================================
       CSS — PAINEL (Angular)
       cssPainelLayout()  -> aparência/layout, SEMPRE ativa
       cssPainelTema(p)   -> só as cores do modo (sépia ou escuro)
       ============================================================ */
    function cssPainelLayout() {
        const regras = [];
        const pct = n => (n / 12 * 100).toFixed(4);

        /* --- base flat do tema claro --- */
        if (CFG.moderno) {
            regras.push(`
/* Cartões: superfície branca, borda hairline e barra de acento no topo. */
[${ATRIBUTO}] {
    background: #fff !important;
    border: 1px solid ${CLARO.borda} !important;
    border-top: 3px solid ${CLARO.acento} !important;
    border-radius: 6px !important;
    box-shadow: none !important;
}
[${ATRIBUTO}] .dashboard-item-header {
    background: ${CLARO.headerBg} !important;
    color: ${CLARO.titulo} !important;
    border-bottom: 1px solid ${CLARO.bordaSuave} !important;
    border-radius: 0 !important;
    font-weight: 600 !important;
    letter-spacing: 0 !important;
    font-size: ${CFG.tituloFonte}px !important;
    padding: 14px 16px !important;
}
[${ATRIBUTO}] .dashboard-item-header i {
    color: ${CLARO.acento} !important;
}
[${ATRIBUTO}] .filtros {
    background: ${CLARO.filtrosBg} !important;
    border-top: 1px solid ${CLARO.bordaSuave} !important;
    border-radius: 0 0 5px 5px !important;
}`);
        }

        /* --- destaque do cartão "Assinaturas" (tipografia = layout) --- */
        regras.push(`
[${ATRIBUTO}="assinaturas"] .dashboard-item-header {
    font-size: ${CFG.assinaturasFonte}px !important;
    padding: 16px 18px !important;
}`);

        /* --- larguras e cartão oculto --- */
        if (CFG.ocultarMinhasTarefas) {
            // Só a partir de md (>=992px) o Bootstrap aplica col-md-*;
            // abaixo disso os cartões já ocupam a linha inteira.
            regras.push(`
@media (min-width: 992px) {
    [${ATRIBUTO}="assinaturas"] { width: ${pct(CFG.colunasAssinaturas)}% !important; }
    [${ATRIBUTO}="tarefas"]     { width: ${pct(CFG.colunasTarefas)}% !important; }
}
[${ATRIBUTO}="minhas-tarefas"] {
    display: none !important;
}`);
        }

        /* ============================================================
           PAINEL DA LISTA — itens escondidos (CFG.mostrar)
           Portado do antigo "cartão de tarefa limpo": só CSS, nada sai do DOM.
           ============================================================ */
        if (!CFG.mostrar.iconesEsquerda) {
            regras.push(`
/* 1) Bloco esquerdo do cabeçalho (ícones de bloqueio/sigilo/liminar/prioridade/
      conferido + componente pje-ico-prioridades). */
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

        if (!CFG.mostrar.lembretes) {
            regras.push(`
/* 2) Alfinete de lembretes. */
.datalist-content .row.icones pje-lembretes {
    display: none !important;
}`);
        }

        if (!CFG.mostrar.abrirAutos) {
            regras.push(`
/* 3) Ícone "Abrir autos". */
.datalist-content .row.icones pje-link-autos-digitais {
    display: none !important;
}`);
        }

        if (!CFG.mostrar.checkBox) {
            regras.push(`
/* 4) Caixa de seleção do processo.
      Atenção: o seletor é "> div.selecionarProcesso" (filho direto) de
      propósito — a classe .selecionarProcesso também está no <a> que abre o
      processo, e esse link deve continuar funcionando. */
.datalist-content > div.selecionarProcesso {
    display: none !important;
}`);
        }

        if (!CFG.mostrar.numeracao) {
            regras.push(`
/* 5) Numeração "1/30" do lote. */
.datalist-content .numeracao-do-processo-datalist-card {
    display: none !important;
}`);
        }

        if (!CFG.mostrar.campoPesquisa) {
            regras.push(`
/* 6) Campo de pesquisa do topo da lista: input "Pesquisar", botão de filtros
      (caret) e botão da lupa, todos dentro do .input-group do componente
      <filtro-tarefas>. O título da tarefa e o badge de quantidade NÃO saem,
      pois ficam fora do .input-group. */
filtro-tarefas .input-group {
    display: none !important;
}`);
        }

        if (!CFG.mostrar.abas) {
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

        if (!CFG.mostrar.barraSelecao) {
            regras.push(`
/* 8) Barra do checkbox "marcar todos" (e dos botões de ação em lote) logo
      acima dos cartões. Escopo em .lista-processos para não pegar a barra
      equivalente da aba ETIQUETAS, que tem outra classe. */
.lista-processos .barra-selecao-processos {
    display: none !important;
}`);
        }

        if (CFG.comprimir.cabecalhoLista) {
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
    height: calc(100% - ${CFG.comprimir.alturaCabecalho}px) !important;
}`);
        }

        return regras.join('\n');
    }

    function cssPainelTema(p) {
        const regras = [];

        /* --- cartões do dashboard --- */
        if (CFG.cartoesTema) {
            regras.push(`
/* Cartões: superfícies do tema, acento e bordas hairline. */
[${ATRIBUTO}] {
    background: ${p.cardBg} !important;
    border-color: ${p.borda} !important;
    border-top-color: ${p.acento} !important;
    color: ${p.texto} !important;
}
[${ATRIBUTO}] .dashboard-item-header {
    background: ${p.headerBg} !important;
    color: ${p.textoForte} !important;
    border-bottom-color: ${p.borda} !important;
    font-weight: 700 !important;
}
[${ATRIBUTO}] .dashboard-item-header i {
    color: ${p.acento} !important;
}
/* Barra "Filtros".
   ATENÇÃO: o PJe define ".filtros[_ngcontent-xxx] { background:#eee !important }"
   — a regra simples tem a mesma especificidade (0,2,0) e é injetada DEPOIS da
   nossa, então venceria pela ordem. Repetir o atributo sobe a especificidade
   para (0,3,0) e resolve, independente de quem é injetado primeiro. */
[${ATRIBUTO}][${ATRIBUTO}] .filtros,
[${ATRIBUTO}] .wrapper-filtro-assinaturas,
[${ATRIBUTO}] .wrapper-filtro-tarefas-pendentes {
    background: ${p.headerBg} !important;
    border-color: ${p.borda} !important;
    color: ${p.texto} !important;
}
[${ATRIBUTO}][${ATRIBUTO}] .filtros span {
    color: ${p.texto} !important;
}
[${ATRIBUTO}][${ATRIBUTO}] .filtros i {
    color: ${p.textoSuave} !important;
}
/* Linhas (.menuItem): separador hairline e realce no hover. */
[${ATRIBUTO}] .menuItem {
    background: transparent !important;
    border-bottom: 1px solid ${p.borda} !important;
}
[${ATRIBUTO}] .menuItem:hover {
    background: ${p.hover} !important;
}
[${ATRIBUTO}] .menuItem a {
    color: ${p.texto} !important;
    text-decoration: none !important;
}
/* Nome da linha e contagem: negrito, para não "apagar" no fundo do tema. */
[${ATRIBUTO}] .detalheTarefasQuantidade {
    color: ${p.texto} !important;
}
[${ATRIBUTO}] .detalheTarefasQuantidade .nome {
    color: ${p.textoForte} !important;
    font-size: 15px !important;
    font-weight: 500 !important;
}
[${ATRIBUTO}] .quantidadeTarefa {
    color: ${p.numero} !important;
    font-size: 16px !important;
    font-weight: 700 !important;
}
[${ATRIBUTO}] .menuItem i {
    color: ${p.textoSuave} !important;
}
[${ATRIBUTO}] .nenhum-resultado .nome {
    color: ${p.textoSuave} !important;
}
/* Alerta de erro (quando a API falha) e barra de progresso. */
[${ATRIBUTO}] .alert-danger {
    background: ${p.alertaBg} !important;
    border: 1px solid ${p.alertaBorda} !important;
    color: ${p.alertaTexto} !important;
}
[${ATRIBUTO}] .progressbar,
[${ATRIBUTO}] .ui-progressbar {
    background: ${p.borda} !important;
}
/* Painel de filtros (quando expandido): campos do tema. */
[${ATRIBUTO}] .filtro-tarefas-pendentes {
    background: ${p.headerBg} !important;
    color: ${p.texto} !important;
}
[${ATRIBUTO}] input,
[${ATRIBUTO}] select,
[${ATRIBUTO}] textarea {
    background: ${p.cardBg} !important;
    border: 1px solid ${p.bordaInput} !important;
    color: ${p.textoForte} !important;
}
[${ATRIBUTO}] label {
    color: ${p.texto} !important;
}
/* ---- Barra superior da tarefa (#conteudoTarefa) ---- */
#conteudoTarefa {
    background: ${p.pageBg} !important;
}
#conteudoTarefa .header-wrapper,
#conteudoTarefa .header-wrapper-sigiloso,
#conteudoTarefa .header-processo,
#conteudoTarefa .header-processo-sigiloso {
    background: ${p.headerBg} !important;
    color: ${p.textoForte} !important;
    border-color: ${p.borda} !important;
}
#conteudoTarefa .header-processo a,
#conteudoTarefa .header-processo-sigiloso a {
    color: ${p.numero} !important;
}
#conteudoTarefa .partes {
    color: ${p.textoSuave} !important;
}
/* Botão "Mais detalhes" (o quadradinho claro quase no centro da barra):
   .toggleDetalhes fica em .mais-detalhes / .mais-detalhes-sigiloso. */
#conteudoTarefa .toggleDetalhes,
#conteudoTarefa .mais-detalhes,
#conteudoTarefa .mais-detalhes-sigiloso {
    background: ${p.headerBg} !important;
    color: ${p.texto} !important;
    border-color: ${p.borda} !important;
}
#conteudoTarefa .toggleDetalhes i {
    color: ${p.texto} !important;
}
#conteudoTarefa .toggleDetalhes:hover {
    background: ${p.hover} !important;
}
/* Botões neutros (Bootstrap .btn-default) e dropdowns da barra da tarefa.
   Os botões de ação já são azuis no PJe; aqui só garantimos os neutros. */
#conteudoTarefa .toolbar-processo .btn-default,
#conteudoTarefa .toolbar-processo .dropdown-toggle {
    background: ${p.headerBg} !important;
    color: ${p.texto} !important;
    border-color: ${p.bordaInput} !important;
}
#conteudoTarefa .toolbar-processo .btn-default i,
#conteudoTarefa .toolbar-processo .dropdown-toggle i {
    color: ${p.texto} !important;
}
#conteudoTarefa .dropdown-menu {
    background: ${p.cardBg} !important;
    border-color: ${p.bordaInput} !important;
}
#conteudoTarefa .dropdown-menu > li > a {
    color: ${p.texto} !important;
}
#conteudoTarefa .dropdown-menu > li > a:hover,
#conteudoTarefa .dropdown-menu > li > a:focus {
    background: ${p.hover} !important;
    color: ${p.textoForte} !important;
}`);
        }

        /* --- fundo da faixa do dashboard e da página --- */
        if (CFG.fundoTema) {
            regras.push(`
html, body {
    background: ${p.pageBg} !important;
}
div.painel-usuario-interno-dashboard {
    background: ${p.pageBg} !important;
}`);
        }

        /* --- painel lateral da lista de processos --- */
        if (CFG.painelListaTema) {
            regras.push(`
/* Escopo em #divProcessosTarefa (id) de propósito: sobe a especificidade e
   vence os estilos encapsulados do Angular sem repetir seletores. */
#divProcessosTarefa {
    background: ${p.painelBg} !important;
    border-right: 1px solid ${p.painelBorda} !important;
}
/* Cabeçalho da lista: título da tarefa, contador e campo de busca. */
#divProcessosTarefa #divActions {
    background: ${p.headerBg} !important;
    border-bottom: 1px solid ${p.painelBorda} !important;
    color: ${p.textoForte} !important;
}
#divProcessosTarefa #divActions input,
#divProcessosTarefa #divActions .input-group-addon,
#divProcessosTarefa #divActions select,
#divProcessosTarefa #divActions .form-control {
    background: ${p.cardBg} !important;
    border-color: ${p.bordaInput} !important;
    color: ${p.textoForte} !important;
}
#divProcessosTarefa #divActions * {
    border-color: ${p.bordaInput} !important;
}
/* Abas PROCESSOS | ETIQUETAS */
#divProcessosTarefa ul#myTabs {
    background: ${p.painelBg} !important;
    border-bottom: 1px solid ${p.painelBorda} !important;
}
#divProcessosTarefa ul#myTabs > li > a {
    background: transparent !important;
    color: ${p.textoSuave} !important;
    border-color: transparent !important;
}
#divProcessosTarefa ul#myTabs > li.active > a,
#divProcessosTarefa ul#myTabs > li.active > a:hover,
#divProcessosTarefa ul#myTabs > li.active > a:focus {
    background: ${p.painelBg} !important;
    color: ${p.textoForte} !important;
    border-color: ${p.painelBorda} ${p.painelBorda} ${p.painelBg} !important;
}
/* Área rolável e barra de seleção em lote */
#divProcessosTarefa .lista-processos,
#divProcessosTarefa .lista-processos > .tab-content,
#divProcessosTarefa #processosTarefa,
#divProcessosTarefa #processosEtiqueta {
    background: ${p.painelBg} !important;
}
#divProcessosTarefa .barra-selecao-processos {
    background: ${p.headerBg} !important;
    border-bottom: 1px solid ${p.painelBorda} !important;
    color: ${p.texto} !important;
}
/* Cartões de processo */
#divProcessosTarefa .datalist-content {
    background: ${p.painelCard} !important;
    border: 1px solid ${p.painelBorda} !important;
    color: ${p.texto} !important;
}
#divProcessosTarefa .datalist-content:hover {
    background: ${p.painelHover} !important;
}
#divProcessosTarefa .datalist-content.selecionado {
    background: ${p.painelHover} !important;
    border-color: ${p.acento} !important;
}
#divProcessosTarefa .datalist-content a {
    color: ${p.numero} !important;
}
#divProcessosTarefa .datalist-content .row.icones,
#divProcessosTarefa .datalist-content .row.icones * {
    color: ${p.textoSuave} !important;
}
/* Etiquetas de dias (.date): o curinga acima pintava o texto delas com
   textoSuave, mas o FUNDO verde/âmbar/vermelho é do PJe e não é tematizado — o
   resultado era ilegível (1,10:1 no verde, 1,11:1 no vermelho, 1,95:1 no âmbar;
   AA pede 4,5:1). Devolvemos o branco do PJe: 4,59:1 no verde e 4,60:1 no
   vermelho. No âmbar o branco fica em 2,14:1 — é a cor original do PJe, mantida
   de propósito (decisão de 2026-09, priorizando o visual de "fonte branca").
   Especificidade (1,3,0) > (1,2,0) da regra acima: vence sem depender da ordem
   em que as folhas são injetadas, e sem tocar no curinga. */
#divProcessosTarefa .datalist-content .row.icones .date * {
    color: ${p.etiquetaTexto} !important;
    font-weight: 600 !important;
}
/* A numeração do lote ("2/293") tem FUNDO cinza-claro do PJe: branco daria
   1,61:1, então usa o cinza escuro (6,07:1).
   Cobre os dois arranjos possíveis do DOM — numeração DENTRO de .date (os dois
   primeiros seletores, especificidade 1,3,0, que vencem a regra acima por virem
   depois) ou como IRMÃ dela (os dois últimos, 1,2,0, que vencem o curinga pelo
   mesmo motivo: ordem). Só CSS padrão, sem hack de especificidade. */
#divProcessosTarefa .datalist-content .row.icones .date .numeracao-do-processo-datalist-card,
#divProcessosTarefa .datalist-content .row.icones .date .numeracao-do-processo-datalist-card *,
#divProcessosTarefa .datalist-content .row.icones .numeracao-do-processo-datalist-card,
#divProcessosTarefa .datalist-content .row.icones .numeracao-do-processo-datalist-card * {
    color: ${p.numeracaoTexto} !important;
    font-weight: 600 !important;
}
/* Paginação — é um <p-dataList [paginator]="true"> do PrimeNG (prefixo ui-*),
   por isso o container é .ui-paginator, e não .pagination. */
#divProcessosTarefa .ui-paginator {
    background: ${p.headerBg} !important;
    border-color: ${p.painelBorda} !important;
    color: ${p.texto} !important;
}
#divProcessosTarefa .ui-paginator .ui-paginator-first,
#divProcessosTarefa .ui-paginator .ui-paginator-prev,
#divProcessosTarefa .ui-paginator .ui-paginator-next,
#divProcessosTarefa .ui-paginator .ui-paginator-last,
#divProcessosTarefa .ui-paginator .ui-paginator-page {
    background: transparent !important;
    border-color: ${p.painelBorda} !important;
    color: ${p.texto} !important;
}
#divProcessosTarefa .ui-paginator .ui-paginator-page.ui-state-active {
    background: ${p.acentoClaro} !important;
    border-color: ${p.acentoClaro} !important;
    color: #fff !important;
}
/* Seletor de itens por página ("30") */
#divProcessosTarefa .ui-paginator .ui-dropdown,
#divProcessosTarefa .ui-dropdown {
    background: ${p.painelCard} !important;
    border-color: ${p.bordaInput} !important;
    color: ${p.textoForte} !important;
}
#divProcessosTarefa .ui-dropdown .ui-dropdown-label,
#divProcessosTarefa .ui-dropdown .ui-dropdown-trigger {
    background: transparent !important;
    color: ${p.textoForte} !important;
}
/* O painel do dropdown é anexado ao <body> (paginatorDropdownAppendTo="body"),
   então NÃO pode ficar escopado em #divProcessosTarefa. */
.ui-dropdown-panel {
    background: ${p.painelCard} !important;
    border: 1px solid ${p.bordaInput} !important;
}
.ui-dropdown-panel .ui-dropdown-item {
    color: ${p.texto} !important;
}
.ui-dropdown-panel .ui-dropdown-item:hover,
.ui-dropdown-panel .ui-dropdown-item.ui-state-highlight {
    background: ${p.painelHover} !important;
    color: ${p.textoForte} !important;
}
/* Área do datalist do PrimeNG */
#divProcessosTarefa .ui-datalist,
#divProcessosTarefa .ui-datalist-content,
#divProcessosTarefa .ui-datalist-data {
    background: ${p.painelBg} !important;
    color: ${p.texto} !important;
}
/* Paginação Bootstrap (a aba ETIQUETAS usa .pagination) */
#divProcessosTarefa .pagination > li > a,
#divProcessosTarefa .pagination > li > span {
    background: ${p.painelCard} !important;
    border-color: ${p.painelBorda} !important;
    color: ${p.texto} !important;
}
#divProcessosTarefa .pagination > .active > a,
#divProcessosTarefa .pagination > .active > span {
    background: ${p.acentoClaro} !important;
    border-color: ${p.acentoClaro} !important;
    color: #fff !important;
}`);
        }

        return regras.join('\n');
    }

    /* ============================================================
       CSS — MINUTA (frame movimentar.seam)
       Diferente das outras folhas, aqui o CSS JÁ É só de cores: no modo
       claro nenhuma folha é injetada (a minuta fica como o PJe a fez).
       ============================================================ */
    function cssMinutaTema(p) {
        return `
/* Estrutura real (dump do DOM):
     body > #pageBody.principal                       canvas do tema
       .rich-panel / .rich-panel-body                 painel do PJe
         .rich-stglpanel / .rich-table                resumo, barras
         .impresso                                    faixa em volta
           .folha                                     a "folha"
             #bdInnerContent
               #bd-pages-inner-container.ProseMirror  <- O TEXTO
   Os ids do JSF são dinâmicos (taskInstanceForm:minuta-<id>:...), por isso
   o CSS usa apenas classes/ids estáveis. */

html, body, #pageBody {
    background: ${p.pageBg} !important;
    color: ${p.texto} !important;
}
/* Painéis RichFaces (cabeçalho, resumo, barras de ação) */
.rich-panel, .rich-panel-body, .rich-panel-header,
.rich-stglpanel, .rich-stglpanel-body, .rich-stglpanel-header,
.rich-table, .rich-table td, .rich-table th,
.rich-table-header, .rich-table-subheadercell, .rich-table-subheader,
.modal-popup {
    background: ${p.cardBg} !important;
    color: ${p.texto} !important;
    border-color: ${p.borda} !important;
}
.rich-panel-header, .rich-stglpanel-header,
.rich-table-header, .rich-table-subheadercell, .rich-table-subheader {
    background: ${p.headerBg} !important;
    color: ${p.textoForte} !important;
}
/* Faixa em volta da folha (era #717171) */
.impresso {
    background: ${p.pageBg} !important;
}
/* A folha do documento — as "barras" em volta do texto, num tom ACIMA do
   papel (para diferenciar). O PJe pinta a folha com seletor mais específico
   (.impresso .folha), então a classe é duplicada/escopada para vencer. */
.folha.folha, .impresso .folha {
    background: ${p.folhaBg} !important;
    color: ${p.texto} !important;
    border-color: ${p.borda} !important;
}
/* A estrutura do editor é uma TABELA:
      tr > td > #bdInnerContent > div > #bd-pages-inner-container
   As células em volta do texto são as barras laterais. */
.folha table, .folha tbody, .folha thead, .folha tr, .folha td {
    background: ${p.folhaBg} !important;
    border-color: ${p.borda} !important;
}
td:has(#bdInnerContent), tr:has(#bdInnerContent),
tbody:has(#bdInnerContent), table:has(#bdInnerContent) {
    background: ${p.folhaBg} !important;
}
/* Miolo no tom das barras; o PAPEL (área do texto) fica um pouco diferente. */
#bdInnerContent, #bdInnerContent > div, #bd-pages-container {
    background: ${p.folhaBg} !important;
    color: ${p.textoForte} !important;
}
#bd-pages-inner-container, .ProseMirror {
    background: ${p.cardBg} !important;
    color: ${p.textoForte} !important;
}
/* O texto do documento — a fonte e o tamanho NÃO são alterados de propósito:
   o layout da peça (quebras de página) precisa ser preservado. */
#bd-pages-inner-container *,
#bd-pages-container * {
    color: ${p.textoForte} !important;
}
/* Links e imagens dentro da peça */
#bd-pages-inner-container a,
#bd-pages-container a {
    color: ${p.numero} !important;
}
/* ============================================================
   MODO EDIÇÃO (frame externo da tarefa) — superfícies que ficavam
   claras no dump do DOM real:
     fieldset 249,249,249 · .dropzone-previews-toolbar #fff
     .rich-table-row 249,249,249 · .modal-content #fff
     .select2-selection #fff (dropdowns "Despacho" / "Selecione o modelo")
     input.inputText #fff
   ============================================================ */
label, .label, legend, .control-label {
    color: ${p.texto} !important;
}
fieldset {
    background: ${p.cardBg} !important;
    border-color: ${p.borda} !important;
}
input, select, textarea, .inputText {
    background: ${p.cardBg} !important;
    border: 1px solid ${p.bordaInput} !important;
    color: ${p.textoForte} !important;
}
/* Faixa de ferramentas / barra de uploads e linhas de tabela RichFaces */
.dropzone-previews-toolbar,
.rich-table-row, .rich-table-firstrow, .rich-table-subheader {
    background: ${p.headerBg} !important;
    color: ${p.texto} !important;
    border-color: ${p.borda} !important;
}
/* Dropdowns select2 (Tipo do Documento, Modelo, etc.) */
.select2-selection,
.select2-selection__rendered,
.select2-selection__arrow,
.select2-selection--single,
.select2-selection--multiple {
    background: ${p.cardBg} !important;
    color: ${p.textoForte} !important;
    border-color: ${p.bordaInput} !important;
}
.select2-selection__placeholder {
    color: ${p.textoSuave} !important;
}
.select2-dropdown,
.select2-results,
.select2-results__options,
.select2-search,
.select2-search__field {
    background: ${p.cardBg} !important;
    color: ${p.texto} !important;
    border-color: ${p.bordaInput} !important;
}
.select2-results__option {
    background: ${p.cardBg} !important;
    color: ${p.texto} !important;
}
.select2-results__option--highlighted,
.select2-results__option[aria-selected="true"] {
    background: ${p.painelHover} !important;
    color: ${p.textoForte} !important;
}
/* Modais */
.modal-content, .modal-body, .modal-header, .modal-footer, .modal-title {
    background: ${p.cardBg} !important;
    color: ${p.texto} !important;
    border-color: ${p.borda} !important;
}
/* O iframe do editor: o editor é um app (Badon Writer) com ShadowRoot
   próprio — o CSS do documento não entra lá; o que dá para fazer daqui é
   pintar o quadro e avisar o navegador do esquema de cores. O miolo do
   editor é tratado pela cadeia de attachShadow (ver CSS_EDITOR). */
iframe#editorEstruturadoFrame {
    background: ${p.cardBg} !important;
    color-scheme: ${p.esquema};
}
`;
    }

    /* ============================================================
       CSS — EDITOR (Badon Writer / ShadowRoot fechado)
       Três camadas, três folhas por modo:
         doc    -> documento do iframe externo (DOM leve)
         root   -> dentro do ShadowRoot  (barra de ferramentas e casca)
         nested -> documento do iframe interno (o papel)
       ============================================================ */
    function cssEditor(modo) {
        if (modo === 'claro') {
            // Modo claro: apenas garante o fundo claro, sem sobrescrever as
            // cores que o próprio editor define.
            return {
                doc: `
html, body, #badon-writer-app-container {
    background: #fff !important;
    color: ${CLARO.titulo} !important;
    color-scheme: light;
}
`,
                root: `
:host {
    background: #fff !important;
    color: ${CLARO.titulo} !important;
    color-scheme: light;
}
`,
                nested: `
html, body {
    background: #fff !important;
    color: ${CLARO.titulo} !important;
    color-scheme: light;
}
`,
            };
        }

        const p = PALETA[modo];
        return {
            doc: `
html, body, #badon-writer-app-container {
    background: ${p.cardBg} !important;
    color: ${p.textoForte} !important;
    color-scheme: ${p.esquema};
}
`,
            root: `
:host {
    background: ${p.cardBg} !important;
    color: ${p.textoForte} !important;
    color-scheme: ${p.esquema};
}
:host * {
    color: ${p.textoForte} !important;
    background-color: transparent !important;
    border-color: ${p.borda} !important;
}
:host a, :host a * {
    color: ${p.numero} !important;
}
:host input, :host textarea, :host select {
    background-color: ${p.cardBg} !important;
    color: ${p.textoForte} !important;
    border-color: ${p.bordaInput} !important;
}
`,
            nested: `
html, body {
    background: ${p.cardBg} !important;
    color: ${p.textoForte} !important;
    color-scheme: ${p.esquema};
}
body * {
    color: ${p.textoForte} !important;
    background-color: transparent !important;
    border-color: ${p.borda} !important;
}
body a, body a * {
    color: ${p.numero} !important;
}
body input, body textarea, body select {
    background-color: ${p.cardBg} !important;
    color: ${p.textoForte} !important;
    border-color: ${p.bordaInput} !important;
}
`,
        };
    }

    /* ============================================================
       INJEÇÃO E REGISTRO DAS FOLHAS
       Cada folha é criada UMA vez e guardada em dois registros:
         - registro: raiz (Document ou ShadowRoot) -> Map(id -> <style>)
           É o que evita recriar a folha quando ela está fora da árvore.
         - folhas:   <style> -> modo ('claro' | 'sepia' | 'escuro' | 'sempre')
           É o que permite trocar o tema inteiro alternando só o estado.
       ============================================================ */
    const folhas = new Map();      // <style> -> modo
    const registro = new WeakMap(); // Document/ShadowRoot -> Map(id -> <style>)

    // Liga/desliga UMA folha conforme o modo atual.
    // Além de style.disabled, a folha inativa SAI da árvore: dentro de um
    // ShadowRoot fechado o disabled é ignorado por alguns motores, e o
    // removeChild cobre esse caso sem depender do motor. O alvo do reanexo
    // fica guardado no próprio elemento.
    function ajustarFolha(el, modo, alvo) {
        const ativa = (modo === 'sempre') || (modo === temaAtual);
        try { el.disabled = !ativa; } catch (e) { }
        try {
            const destino = alvo || el.__pjeAlvo || el.parentNode;
            if (destino) el.__pjeAlvo = destino;
            if (!destino) return;
            if (ativa) {
                // Reanexar sempre que ligar: os estilos do app entram depois;
                // ficando por último, a gente vence a cascata.
                if (el.parentNode !== destino) destino.appendChild(el);
            } else if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        } catch (e) { }
    }

    // Cria (ou reaproveita) a folha `id` dentro de `raiz` e aplica o modo.
    // raiz = Document (head || documentElement como alvo) ou ShadowRoot.
    function folha(raiz, id, css, modo) {
        if (!raiz || !css) return null;
        let mapa = registro.get(raiz);
        if (!mapa) { mapa = new Map(); registro.set(raiz, mapa); }

        let el = mapa.get(id);
        if (!el) {
            const doc = raiz.ownerDocument || raiz;
            try {
                el = doc.createElement('style');
                el.id = id;
                el.textContent = css;
            } catch (e) { return null; }
            mapa.set(id, el);
        }

        const alvo = (raiz.nodeType === 9) ? (raiz.head || raiz.documentElement) : raiz;
        if (!alvo) return null;

        folhas.set(el, modo);
        ajustarFolha(el, modo, alvo);
        return el;
    }

    function injetar(css) {
        if (!css) return;
        if (typeof GM_addStyle === 'function') {
            try { GM_addStyle(css); return; } catch (e) { }
        }
        const style = document.createElement('style');
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }

    // Liga/desliga TODAS as folhas registradas conforme o modo atual.
    function sincronizarFolhas() {
        folhas.forEach(function (modo, el) {
            ajustarFolha(el, modo);
        });
    }

    /* ============================================================
       CADEIA DO EDITOR (Badon Writer / ShadowRoot fechado)
       ============================================================ */
    const ID_FRAME = 'editorEstruturadoFrame';
    const ID_AREA_IFRAME = 'appEditorAreaIframe';
    const raizes = new Map();            // raiz -> Document dono (p/ criar style)
    const iframesAninhados = new WeakSet();

    /* ----- patch do attachShadow de um realm ----- */
    function patchRealm(win, doc) {
        let proto = null;
        try { proto = win && win.Element && win.Element.prototype; } catch (e) { return false; }
        if (!proto || !proto.attachShadow || proto.attachShadow.__pjeTema) return false;
        const original = proto.attachShadow;
        const novo = function (init) {
            const raiz = original.call(this, init);
            try {
                raizes.set(raiz, doc);
                log('ShadowRoot capturado no realm de', doc.location.href,
                    'mode=' + (init && init.mode),
                    'host=' + (this.id || this.className || this.tagName));
                setTimeout(aplicarEditor, 0);
            } catch (e) { }
            return raiz;
        };
        novo.__pjeTema = true;
        proto.attachShadow = novo;
        log('patch de attachShadow instalado em', doc.location.href);
        return true;
    }

    /* ----- injeta as TRÊS versões do tema em um documento da cadeia ----- */
    function prepararDocumento(win, doc, sufixo) {
        if (!win || !doc || !doc.documentElement) return false;
        patchRealm(win, doc);
        MODOS.forEach(function (modo) {
            folha(doc, 'pje-editor-' + modo + '-' + sufixo, cssEditor(modo)[sufixo], modo);
        });
        return true;
    }

    /* ----- injeta as TRÊS versões do tema dentro de um ShadowRoot ----- */
    function prepararRaiz(raiz) {
        MODOS.forEach(function (modo) {
            folha(raiz, 'pje-editor-' + modo + '-root', cssEditor(modo).root, modo);
        });
    }

    /* ----- aplica tudo, descendo a cadeia ----- */
    function aplicarEditor() {
        // 1) iframe externo do editor
        const f = document.getElementById(ID_FRAME);
        if (f) {
            try {
                const d = f.contentDocument;
                const w = f.contentWindow;
                const doc = d || (w && w.document);
                if (doc) prepararDocumento(w || (doc.defaultView), doc, 'doc');
            } catch (e) { }
        }

        // 2) ShadowRoots capturados + 3) iframe interno do papel
        raizes.forEach(function (doc, raiz) {
            prepararRaiz(raiz);
            try {
                const area = raiz.getElementById ? raiz.getElementById(ID_AREA_IFRAME) : null;
                if (!area) return;
                if (!iframesAninhados.has(area)) {
                    iframesAninhados.add(area);
                    area.addEventListener('load', aplicarEditor);
                }
                const d2 = area.contentDocument;
                const w2 = area.contentWindow;
                const doc2 = d2 || (w2 && w2.document);
                if (doc2) prepararDocumento(w2 || (doc2.defaultView), doc2, 'nested');
            } catch (e) { }
        });
    }

    /* ============================================================
       DIAGNÓSTICO (CFG.diagnostico) — dump das duas camadas
       Nunca liga sozinho: serve para redescobrir seletores se o PJe mudar.
       ============================================================ */
    let dumpFeito = false;

    function desc(e) {
        const cls = (typeof e.className === 'string' ? e.className : '').trim();
        return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') +
            (cls ? '.' + cls.split(/\s+/).slice(0, 3).join('.') : '');
    }

    function resumo(raizDoc) {
        try {
            const nos = [...raizDoc.querySelectorAll('*')];
            const grandes = nos.filter(function (e) {
                const r = e.getBoundingClientRect();
                return r.width > 120 && r.height > 40;
            }).slice(0, 30).map(function (e) {
                const cs = getComputedStyle(e);
                const r = e.getBoundingClientRect();
                return { el: desc(e), w: Math.round(r.width), h: Math.round(r.height), bg: cs.backgroundColor, cor: cs.color };
            });
            const classes = [...new Set(nos.map(function (e) {
                return (typeof e.className === 'string' ? e.className : '').split(/\s+/);
            }).reduce(function (a, b) { return a.concat(b); }, []))].filter(Boolean).slice(0, 60);
            return { elementos: nos.length, grandes: grandes, classes: classes };
        } catch (e) { return { erro: e.message }; }
    }

    function dumpRaizes() {
        if (!CFG.diagnostico || dumpFeito || raizes.size === 0) return;
        dumpFeito = true;
        raizes.forEach(function (doc, raiz) {
            console.log(LOG, 'DUMP DO EDITOR (shadow, copie):');
            console.log(JSON.stringify(resumo(raiz), null, 1));
            try {
                const area = raiz.getElementById ? raiz.getElementById(ID_AREA_IFRAME) : null;
                const d = area && area.contentDocument;
                if (d) {
                    console.log(LOG, 'DUMP DO PAPEL (iframe interno, copie):');
                    console.log(JSON.stringify(Object.assign({ url: d.location.href }, resumo(d)), null, 1));
                }
            } catch (e) { }
        });
    }

    /* ============================================================
       APLICAÇÃO — folhas do painel, da minuta e do editor
       ============================================================ */
    const ID_LAYOUT = 'pje-css-layout';
    const ID_SEPIA = 'pje-css-sepia';
    const ID_ESCURO = 'pje-css-escuro';
    const ID_MINUTA_SEPIA = 'pje-minuta-sepia';
    const ID_MINUTA_ESCURO = 'pje-minuta-escuro';

    function aplicarPainel() {
        if (!NO_PAINEL) return;
        marcarCartoes();
        // A folha de layout é SEMPRE ativa; sépia e escuro são overlays.
        folha(document, ID_LAYOUT, cssPainelLayout(), 'sempre');
        folha(document, ID_SEPIA, cssPainelTema(PALETA.sepia), 'sepia');
        folha(document, ID_ESCURO, cssPainelTema(PALETA.escuro), 'escuro');
    }

    let minutaAplicada = false;
    function aplicarMinuta() {
        if (minutaAplicada || !CFG.temaMinuta) return;
        if (!temMinuta()) return;
        minutaAplicada = true;
        folha(document, ID_MINUTA_SEPIA, cssMinutaTema(PALETA.sepia), 'sepia');
        folha(document, ID_MINUTA_ESCURO, cssMinutaTema(PALETA.escuro), 'escuro');
    }

    function aplicar() {
        aplicarPainel();
        aplicarMinuta();
        aplicarEditor();
        sincronizarFolhas();
        dumpRaizes();
    }

    // Troca de tema a quente: só alterna style.disabled. Sem recarregar.
    function aplicarTema(modo) {
        if (modoValido(modo)) temaAtual = modo;
        sincronizarFolhas();
        atualizarBotao();
    }

    /* ============================================================
       BOTÃO DO TEMA (canto inferior esquerdo, só no frame de topo)
       ============================================================ */
    const ID_BOTAO = 'pje-tema-btn';

    function atualizarBotao() {
        const b = document.getElementById(ID_BOTAO);
        if (!b) return;
        b.textContent = ICONE[temaAtual];
        b.title = 'Tema ' + ROTULO[temaAtual] + ' — clique para ' + ROTULO[proximoModo()];
    }

    function criarBotaoTema() {
        // Só no frame de TOPO: assim existe UM botão só, flutuando no canto
        // da janela, por cima dos iframes (o PJe usa vários níveis de frame).
        if (!ehFrameDeTopo()) return;
        if (document.getElementById(ID_BOTAO)) { atualizarBotao(); return; }

        injetar(`
/* Botão discreto: 24px, quase transparente; fica visível no hover. */
#${ID_BOTAO} {
    position: fixed;
    left: 6px;
    bottom: 6px;
    z-index: 2147483647;
    width: 24px;
    height: 24px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, .18);
    border-radius: 6px;
    background: rgba(28, 33, 40, .5);
    color: #c9d1d9;
    opacity: .3;
    transition: opacity .15s ease;
}
#${ID_BOTAO}:hover {
    opacity: 1;
}`);

        const b = document.createElement('button');
        b.id = ID_BOTAO;
        b.type = 'button';
        b.addEventListener('click', function () {
            const novo = proximoModo();
            gravarTema(novo);          // propaga para os outros frames
            aplicarTema(novo);         // aplica já neste frame (sem recarregar)
        });

        const alvo = document.body || document.documentElement;
        if (!alvo) return;
        alvo.appendChild(b);
        // Só depois de estar no DOM: atualizarBotao() procura via getElementById.
        atualizarBotao();
    }

    /* ============================================================
       BOOT
       ============================================================ */
    // Realm deste frame (nunca é demais): o patch precisa existir antes de o
    // editor criar o ShadowRoot.
    patchRealm(window, document);
    aplicarEditor();

    function quandoPronto(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () { fn(); }, { once: true });
        } else {
            fn();
        }
    }

    quandoPronto(function () {
        aplicarPainel();
        aplicarMinuta();
        aplicarEditor();
        sincronizarFolhas();
        criarBotaoTema();
    });

    // Repetição teimosa: a cadeia de frames monta tarde e em camadas.
    [0, 200, 500, 1000, 2000, 4000, 8000].forEach(function (ms) {
        setTimeout(aplicar, ms);
    });

    // SPA do painel + editor que monta tarde.
    let agendado = null;
    function observar() {
        if (!document.documentElement) { setTimeout(observar, 20); return; }
        new MutationObserver(function () {
            if (agendado) return;
            agendado = setTimeout(function () {
                agendado = null;
                aplicar();
            }, 150);
        }).observe(document.documentElement, { childList: true, subtree: true });
    }
    observar();

    // Sincronização do tema entre frames.
    window.addEventListener('storage', function (e) {
        if (!e || e.key === CHAVE || e.key === CHAVE_LEGADA || e.key === null) {
            aplicarTema(lerTema());
        }
    });

    try {
        if (typeof GM_addValueChangeListener === 'function') {
            GM_addValueChangeListener(CHAVE, function () {
                aplicarTema(lerTema());
            });
        }
    } catch (e) { }

    document.addEventListener('load', function (e) {
        const alvo = e.target;
        if (alvo && (alvo.id === ID_FRAME || alvo.id === ID_AREA_IFRAME)) aplicarEditor();
    }, true);
})();
