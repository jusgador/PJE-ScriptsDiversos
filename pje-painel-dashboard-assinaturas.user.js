// ==UserScript==
// @name         PJe - Painel: dashboard sóbrio + minuta escura
// @namespace    pje.painel.dashboard
// @version      1.6.2
// @description  Tema escuro flat no PJe (TRF5): cartões do Painel do usuário, painel lateral da lista de processos, barra da tarefa e a tela da minuta — com botão discreto no canto inferior esquerdo para ligar/desligar as cores SEM recarregar a página.
// @author       Ricardo
// @match        https://frontend-prd.trf5.jus.br/*
// @match        https://pje1g.trf5.jus.br/pje/*
// @match        https://pje2g.trf5.jus.br/pje/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// ==/UserScript==

/*
 * COMO FUNCIONA
 *
 * 1) São DOIS contextos diferentes, e o script detecta em qual está:
 *
 *    a) PAINEL (Angular) — host https://frontend-prd.trf5.jus.br/
 *       Os cartões do dashboard não têm id nem classe única: o script
 *       identifica cada um pelo texto do cabeçalho (.dashboard-item-header),
 *       marca o cartão pai com data-pje-dash="..." e deixa o visual por conta
 *       do CSS. Assim funciona mesmo se o Angular reordenar os cartões.
 *
 *    b) MINUTA (frame movimentar.seam) — host https://pje1g.trf5.jus.br/pje/
 *       A cadeia de frames é:
 *         pje1g.../ng2/dev.seam  (moldura)
 *           └─ iframe #ngFrame -> frontend-prd...  (painel Angular)
 *                └─ iframe -> pje1g.../Processo/movimentar.seam  <- a minuta
 *       O CSS da minuta só é injetado quando o editor está presente
 *       (PISTA_MINUTA), para não escurecer o PJe inteiro.
 *
 * 2) DUAS FOLHAS DE ESTILO por frame:
 *      #pje-css-layout  -> aparência/layout (SEMPRE ativa)
 *      #pje-css-escuro  -> só as CORES escuras (alternável)
 *    O botão do canto inferior esquerdo só troca style.disabled da folha
 *    escura, então a cor muda na hora, SEM recarregar e SEM perder a tela
 *    atual (lista de processos/minuta continuam onde estão).
 *
 * 3) O estado fica em GM_setValue/GM_getValue (vale nos 3 domínios e em
 *    todos os frames). Como o botão vive no frame de topo mas a folha escura
 *    também existe no painel e na minuta, a troca é propagada por
 *    GM_addValueChangeListener, que dispara em todos os frames.
 *
 * 4) É tudo CSS: nada é removido do DOM. Para desligar por completo, desative
 *    o script no Tampermonkey.
 *
 * 5) Tipografia: usa a Open Sans que a página já carrega (painel) e mantém a
 *    Arial do editor na minuta — a fonte do documento NÃO é alterada, porque
 *    o layout da peça (quebras de página) precisa ser preservado.
 *
 * ESTILO (por que NÃO parece "gerado por IA"):
 *   - cor de acento da identidade do PJe, sem degradê;
 *   - hierarquia por peso e tamanho, não por efeitos;
 *   - borda hairline em vez de sombra difusa;
 *   - raio pequeno e nada de letter-spacing decorativo.
 *
 * ESTRUTURAS (extraídas do bundle do PJe e de um dump do DOM real):
 *   Dashboard:  .dashboard-item-header  dentro de  div.col-md-4
 *   Linhas:     .menuItem > a > .detalheTarefasQuantidade > .nome + .quantidadeTarefa
 *   Painel:     #divProcessosTarefa > #divActions + .lista-processos
 *               (ul#myTabs, .barra-selecao-processos, .datalist-content,
 *                paginador PrimeNG .ui-paginator)
 *   Barra topo: #conteudoTarefa .header-wrapper / .header-processo / .toggleDetalhes
 *   Minuta:     .rich-panel/.rich-stglpanel/.rich-table (RichFaces),
 *               .impresso (faixa), .folha (a folha), #bdInnerContent,
 *               #bd-pages-inner-container.ProseMirror (o texto)
 */

(function () {
    'use strict';

    /* ============================================================
       CONFIGURAÇÃO
       ============================================================ */
    const CFG = {
        /* ---- painel Angular ---- */
        // Largura (em colunas de 12 do Bootstrap) dos cartões quando
        // "Minhas tarefas" está oculto. 6 + 6 = metade da janela cada.
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

        // Paleta escura nos cartões.
        escuro: true,

        // Escurece também a faixa do dashboard e o fundo da página.
        fundoEscuro: true,

        // Escurece o painel lateral da lista de processos (um cinza mais
        // claro que o fundo, para diferenciar).
        escuroPainelLista: true,

        /* ---- minuta (frame movimentar.seam) ---- */
        // Escurece a tela da minuta: barras, faixa em volta e a própria
        // folha do documento (texto claro sobre fundo escuro).
        escuroMinuta: true,
    };

    /* ============================================================
       PALETA
       ============================================================ */
    const COR = {
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
        // painel lateral da lista (um tom acima do fundo da página)
        painelBg:      '#21262d',
        painelCard:    '#262c34',
        painelHover:   '#2d353f',
        painelBorda:   '#333b45',
        // "barras" em volta do texto da minuta (folha + células da tabela):
        // um tom acima do fundo, para diferenciar do papel do documento.
        folhaBg:       '#23282f',
    };

    /* ============================================================
       LIGA/DESLIGA AS CORES ESCURAS
       Guardado em GM_setValue/GM_getValue (vale nos 3 domínios e em todos
       os frames). A troca é a quente: só alterna style.disabled da folha
       escura — sem recarregar a página.
       ============================================================ */
    const CHAVE_ESCURO = 'pje-tema-escuro';
    const ID_FOLHA_LAYOUT = 'pje-css-layout';
    const ID_FOLHA_ESCURA = 'pje-css-escuro';

    function lerEscuro() {
        try {
            if (typeof GM_getValue === 'function') return GM_getValue(CHAVE_ESCURO, true) !== false;
        } catch (e) { }
        try { return localStorage.getItem(CHAVE_ESCURO) !== '0'; } catch (e) { }
        return true;
    }

    function gravarEscuro(valor) {
        // Grava nos DOIS lugares de propósito:
        //  - GM_setValue  -> estado global (vale no painel, outra origem);
        //  - localStorage -> mesma origem pje1g, lido pelo userscript do
        //    editor (Badon Writer / ShadowRoot), que roda com @grant none
        //    e por isso não tem acesso às APIs GM_*.
        try {
            if (typeof GM_setValue === 'function') GM_setValue(CHAVE_ESCURO, valor);
        } catch (e) { }
        try { localStorage.setItem(CHAVE_ESCURO, valor ? '1' : '0'); } catch (e) { }
    }

    // Valor vivo: muda a quente, sem recarregar.
    let escuroAtual = lerEscuro();

    /* ============================================================
       DETECÇÃO DE CONTEXTO
       ============================================================ */
    const NO_PAINEL = /frontend-/.test(location.hostname);

    // Indício de que ESTA página é a tela da minuta/editor.
    const PISTA_MINUTA = '#bd-pages-inner-container, .ProseMirror, .folha, .cke_editable, [id*=":minuta-"]';

    function temMinuta() {
        try { return !!document.querySelector(PISTA_MINUTA); } catch (e) { return false; }
    }

    /* ============================================================
       IDENTIFICAÇÃO DOS CARTÕES (painel)
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
        return alterados;
    }

    /* ============================================================
       CSS — PAINEL (Angular)
       apenasEscuro = false -> só aparência/layout (sempre ativa)
       apenasEscuro = true  -> só as cores escuras (folha alternável)
       ============================================================ */
    function cssPainel(apenasEscuro) {
        const regras = [];
        const pct = n => (n / 12 * 100).toFixed(4);

        /* --- base flat (tema claro) --- */
        if (!apenasEscuro && CFG.moderno) {
            regras.push(`
[${ATRIBUTO}] {
    background: #fff !important;
    border: 1px solid #e4e8ee !important;
    border-top: 3px solid ${COR.acentoClaro} !important;
    border-radius: 6px !important;
    box-shadow: none !important;
}
[${ATRIBUTO}] .dashboard-item-header {
    background: #fff !important;
    color: #1f2937 !important;
    border-bottom: 1px solid #eef1f5 !important;
    border-radius: 0 !important;
    font-weight: 600 !important;
    letter-spacing: 0 !important;
    font-size: ${CFG.tituloFonte}px !important;
    padding: 14px 16px !important;
}
[${ATRIBUTO}] .dashboard-item-header i {
    color: ${COR.acentoClaro} !important;
}
[${ATRIBUTO}] .filtros {
    background: #fafbfc !important;
    border-top: 1px solid #eef1f5 !important;
    border-radius: 0 0 5px 5px !important;
}`);
        }

        /* --- tema escuro --- */
        if (apenasEscuro && CFG.escuro) {
            regras.push(`
/* Cartões: superfícies escuras, acento claro e bordas hairline. */
[${ATRIBUTO}] {
    background: ${COR.cardBg} !important;
    border-color: ${COR.borda} !important;
    border-top-color: ${COR.acento} !important;
    color: ${COR.texto} !important;
}
[${ATRIBUTO}] .dashboard-item-header {
    background: ${COR.headerBg} !important;
    color: ${COR.textoForte} !important;
    border-bottom-color: ${COR.borda} !important;
    font-weight: 700 !important;
}
[${ATRIBUTO}] .dashboard-item-header i {
    color: ${COR.acento} !important;
}
/* Barra "Filtros".
   ATENÇÃO: o PJe define ".filtros[_ngcontent-xxx] { background:#eee !important }"
   — mesma especificidade da regra simples (0,2,0) e injetada DEPOIS da nossa,
   então ela venceria pela ordem. Repetir o atributo sobe a especificidade para
   (0,3,0) e resolve, independente de quem é injetado primeiro. */
[${ATRIBUTO}][${ATRIBUTO}] .filtros,
[${ATRIBUTO}] .wrapper-filtro-assinaturas,
[${ATRIBUTO}] .wrapper-filtro-tarefas-pendentes {
    background: ${COR.headerBg} !important;
    border-color: ${COR.borda} !important;
    color: ${COR.texto} !important;
}
[${ATRIBUTO}][${ATRIBUTO}] .filtros span {
    color: ${COR.texto} !important;
}
[${ATRIBUTO}][${ATRIBUTO}] .filtros i {
    color: ${COR.textoSuave} !important;
}
/* Linhas (.menuItem): separador hairline e realce no hover. */
[${ATRIBUTO}] .menuItem {
    background: transparent !important;
    border-bottom: 1px solid ${COR.borda} !important;
}
[${ATRIBUTO}] .menuItem:hover {
    background: ${COR.hover} !important;
}
[${ATRIBUTO}] .menuItem a {
    color: ${COR.texto} !important;
    text-decoration: none !important;
}
/* Nome da linha e contagem: negrito, para não "apagar" no escuro. */
[${ATRIBUTO}] .detalheTarefasQuantidade {
    color: ${COR.texto} !important;
}
[${ATRIBUTO}] .detalheTarefasQuantidade .nome {
    color: ${COR.textoForte} !important;
    font-size: 15px !important;
    font-weight: 500 !important;
}
[${ATRIBUTO}] .quantidadeTarefa {
    color: ${COR.numero} !important;
    font-size: 16px !important;
    font-weight: 700 !important;
}
[${ATRIBUTO}] .menuItem i {
    color: ${COR.textoSuave} !important;
}
[${ATRIBUTO}] .nenhum-resultado .nome {
    color: ${COR.textoSuave} !important;
}
/* Alerta de erro (quando a API falha) e barra de progresso. */
[${ATRIBUTO}] .alert-danger {
    background: ${COR.alertaBg} !important;
    border: 1px solid ${COR.alertaBorda} !important;
    color: ${COR.alertaTexto} !important;
}
[${ATRIBUTO}] .progressbar,
[${ATRIBUTO}] .ui-progressbar {
    background: ${COR.borda} !important;
}
/* Painel de filtros (quando expandido): campos escuros. */
[${ATRIBUTO}] .filtro-tarefas-pendentes {
    background: ${COR.headerBg} !important;
    color: ${COR.texto} !important;
}
[${ATRIBUTO}] input,
[${ATRIBUTO}] select,
[${ATRIBUTO}] textarea {
    background: ${COR.cardBg} !important;
    border: 1px solid ${COR.bordaInput} !important;
    color: ${COR.textoForte} !important;
}
[${ATRIBUTO}] label {
    color: ${COR.texto} !important;
}
/* ---- Barra superior da tarefa (#conteudoTarefa) ---- */
#conteudoTarefa {
    background: ${COR.pageBg} !important;
}
#conteudoTarefa .header-wrapper,
#conteudoTarefa .header-wrapper-sigiloso,
#conteudoTarefa .header-processo,
#conteudoTarefa .header-processo-sigiloso {
    background: ${COR.headerBg} !important;
    color: ${COR.textoForte} !important;
    border-color: ${COR.borda} !important;
}
#conteudoTarefa .header-processo a,
#conteudoTarefa .header-processo-sigiloso a {
    color: ${COR.numero} !important;
}
#conteudoTarefa .partes {
    color: ${COR.textoSuave} !important;
}
/* Botão "Mais detalhes" (o quadradinho claro quase no centro da barra):
   .toggleDetalhes fica em .mais-detalhes / .mais-detalhes-sigiloso. */
#conteudoTarefa .toggleDetalhes,
#conteudoTarefa .mais-detalhes,
#conteudoTarefa .mais-detalhes-sigiloso {
    background: ${COR.headerBg} !important;
    color: ${COR.texto} !important;
    border-color: ${COR.borda} !important;
}
#conteudoTarefa .toggleDetalhes i {
    color: ${COR.texto} !important;
}
#conteudoTarefa .toggleDetalhes:hover {
    background: ${COR.hover} !important;
}
/* Botões claros (Bootstrap .btn-default) e dropdowns da barra da tarefa.
   Os botões de ação já são azuis no PJe; aqui só garantimos os neutros. */
#conteudoTarefa .toolbar-processo .btn-default,
#conteudoTarefa .toolbar-processo .dropdown-toggle {
    background: ${COR.headerBg} !important;
    color: ${COR.texto} !important;
    border-color: ${COR.bordaInput} !important;
}
#conteudoTarefa .toolbar-processo .btn-default i,
#conteudoTarefa .toolbar-processo .dropdown-toggle i {
    color: ${COR.texto} !important;
}
#conteudoTarefa .dropdown-menu {
    background: ${COR.cardBg} !important;
    border-color: ${COR.bordaInput} !important;
}
#conteudoTarefa .dropdown-menu > li > a {
    color: ${COR.texto} !important;
}
#conteudoTarefa .dropdown-menu > li > a:hover,
#conteudoTarefa .dropdown-menu > li > a:focus {
    background: ${COR.hover} !important;
    color: ${COR.textoForte} !important;
}`);
        }

        /* --- fundo da faixa do dashboard e da página --- */
        if (apenasEscuro && CFG.escuro && CFG.fundoEscuro) {
            regras.push(`
html, body {
    background: ${COR.pageBg} !important;
}
div.painel-usuario-interno-dashboard {
    background: ${COR.pageBg} !important;
}`);
        }

        /* --- painel lateral da lista de processos --- */
        if (apenasEscuro && CFG.escuro && CFG.escuroPainelLista) {
            regras.push(`
/* Escopo em #divProcessosTarefa (id) de propósito: sobe a especificidade e
   vence os estilos encapsulados do Angular sem precisar repetir seletores. */
#divProcessosTarefa {
    background: ${COR.painelBg} !important;
    border-right: 1px solid ${COR.painelBorda} !important;
}
/* Cabeçalho da lista: título da tarefa, contador e campo de busca. */
#divProcessosTarefa #divActions {
    background: ${COR.headerBg} !important;
    border-bottom: 1px solid ${COR.painelBorda} !important;
    color: ${COR.textoForte} !important;
}
#divProcessosTarefa #divActions input,
#divProcessosTarefa #divActions .input-group-addon,
#divProcessosTarefa #divActions select,
#divProcessosTarefa #divActions .form-control {
    background: ${COR.cardBg} !important;
    border-color: ${COR.bordaInput} !important;
    color: ${COR.textoForte} !important;
}
#divProcessosTarefa #divActions * {
    border-color: ${COR.bordaInput} !important;
}
/* Abas PROCESSOS | ETIQUETAS */
#divProcessosTarefa ul#myTabs {
    background: ${COR.painelBg} !important;
    border-bottom: 1px solid ${COR.painelBorda} !important;
}
#divProcessosTarefa ul#myTabs > li > a {
    background: transparent !important;
    color: ${COR.textoSuave} !important;
    border-color: transparent !important;
}
#divProcessosTarefa ul#myTabs > li.active > a,
#divProcessosTarefa ul#myTabs > li.active > a:hover,
#divProcessosTarefa ul#myTabs > li.active > a:focus {
    background: ${COR.painelBg} !important;
    color: ${COR.textoForte} !important;
    border-color: ${COR.painelBorda} ${COR.painelBorda} ${COR.painelBg} !important;
}
/* Área rolável e barra de seleção em lote */
#divProcessosTarefa .lista-processos,
#divProcessosTarefa .lista-processos > .tab-content,
#divProcessosTarefa #processosTarefa,
#divProcessosTarefa #processosEtiqueta {
    background: ${COR.painelBg} !important;
}
#divProcessosTarefa .barra-selecao-processos {
    background: ${COR.headerBg} !important;
    border-bottom: 1px solid ${COR.painelBorda} !important;
    color: ${COR.texto} !important;
}
/* Cartões de processo */
#divProcessosTarefa .datalist-content {
    background: ${COR.painelCard} !important;
    border: 1px solid ${COR.painelBorda} !important;
    color: ${COR.texto} !important;
}
#divProcessosTarefa .datalist-content:hover {
    background: ${COR.painelHover} !important;
}
#divProcessosTarefa .datalist-content.selecionado {
    background: ${COR.painelHover} !important;
    border-color: ${COR.acento} !important;
}
#divProcessosTarefa .datalist-content a {
    color: ${COR.numero} !important;
}
#divProcessosTarefa .datalist-content .row.icones,
#divProcessosTarefa .datalist-content .row.icones * {
    color: ${COR.textoSuave} !important;
}
/* Paginação — é um <p-dataList [paginator]="true"> do PrimeNG (prefixo ui-*),
   por isso o container branco é .ui-paginator, e não .pagination. */
#divProcessosTarefa .ui-paginator {
    background: ${COR.headerBg} !important;
    border-color: ${COR.painelBorda} !important;
    color: ${COR.texto} !important;
}
#divProcessosTarefa .ui-paginator .ui-paginator-first,
#divProcessosTarefa .ui-paginator .ui-paginator-prev,
#divProcessosTarefa .ui-paginator .ui-paginator-next,
#divProcessosTarefa .ui-paginator .ui-paginator-last,
#divProcessosTarefa .ui-paginator .ui-paginator-page {
    background: transparent !important;
    border-color: ${COR.painelBorda} !important;
    color: ${COR.texto} !important;
}
#divProcessosTarefa .ui-paginator .ui-paginator-page.ui-state-active {
    background: ${COR.acentoClaro} !important;
    border-color: ${COR.acentoClaro} !important;
    color: #fff !important;
}
/* Seletor de itens por página ("30") */
#divProcessosTarefa .ui-paginator .ui-dropdown,
#divProcessosTarefa .ui-dropdown {
    background: ${COR.painelCard} !important;
    border-color: ${COR.bordaInput} !important;
    color: ${COR.textoForte} !important;
}
#divProcessosTarefa .ui-dropdown .ui-dropdown-label,
#divProcessosTarefa .ui-dropdown .ui-dropdown-trigger {
    background: transparent !important;
    color: ${COR.textoForte} !important;
}
/* O painel do dropdown é anexado ao <body> (paginatorDropdownAppendTo="body"),
   então NÃO pode ficar escopado em #divProcessosTarefa. */
.ui-dropdown-panel {
    background: ${COR.painelCard} !important;
    border: 1px solid ${COR.bordaInput} !important;
}
.ui-dropdown-panel .ui-dropdown-item {
    color: ${COR.texto} !important;
}
.ui-dropdown-panel .ui-dropdown-item:hover,
.ui-dropdown-panel .ui-dropdown-item.ui-state-highlight {
    background: ${COR.painelHover} !important;
    color: ${COR.textoForte} !important;
}
/* Área do datalist do PrimeNG */
#divProcessosTarefa .ui-datalist,
#divProcessosTarefa .ui-datalist-content,
#divProcessosTarefa .ui-datalist-data {
    background: ${COR.painelBg} !important;
    color: ${COR.texto} !important;
}
/* Paginação Bootstrap (a aba ETIQUETAS usa .pagination) */
#divProcessosTarefa .pagination > li > a,
#divProcessosTarefa .pagination > li > span {
    background: ${COR.painelCard} !important;
    border-color: ${COR.painelBorda} !important;
    color: ${COR.texto} !important;
}
#divProcessosTarefa .pagination > .active > a,
#divProcessosTarefa .pagination > .active > span {
    background: ${COR.acentoClaro} !important;
    border-color: ${COR.acentoClaro} !important;
    color: #fff !important;
}`);
        }

        /* --- destaque do cartão "Assinaturas" (tipografia = layout) --- */
        if (!apenasEscuro) {
            regras.push(`
[${ATRIBUTO}="assinaturas"] .dashboard-item-header {
    font-size: ${CFG.assinaturasFonte}px !important;
    padding: 16px 18px !important;
}`);
        }

        /* --- larguras e cartão oculto (layout) --- */
        if (!apenasEscuro && CFG.ocultarMinhasTarefas) {
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

        return regras.join('\n');
    }

    /* ============================================================
       CSS — MINUTA (frame movimentar.seam) — só as cores
       ============================================================ */
    function cssMinuta() {
        return `
/* Estrutura real (dump do DOM):
     body > #pageBody.principal                       canvas claro
       .rich-panel / .rich-panel-body                 painel branco
         .rich-stglpanel / .rich-table                resumo, barras
         .impresso                                    faixa cinza (#717171)
           .folha                                     a "folha" (branca)
             #bdInnerContent
               #bd-pages-inner-container.ProseMirror  <- O TEXTO
   Os ids do JSF são dinâmicos (taskInstanceForm:minuta-<id>:...), por isso
   o CSS usa apenas classes/ids estáveis. */

html, body, #pageBody {
    background: ${COR.pageBg} !important;
    color: ${COR.texto} !important;
}
/* Painéis RichFaces (cabeçalho, resumo, barras de ação) */
.rich-panel, .rich-panel-body, .rich-panel-header,
.rich-stglpanel, .rich-stglpanel-body, .rich-stglpanel-header,
.rich-table, .rich-table td, .rich-table th,
.rich-table-header, .rich-table-subheadercell, .rich-table-subheader,
.modal-popup {
    background: ${COR.cardBg} !important;
    color: ${COR.texto} !important;
    border-color: ${COR.borda} !important;
}
.rich-panel-header, .rich-stglpanel-header,
.rich-table-header, .rich-table-subheadercell, .rich-table-subheader {
    background: ${COR.headerBg} !important;
    color: ${COR.textoForte} !important;
}
/* Faixa em volta da folha (era #717171) */
.impresso {
    background: ${COR.pageBg} !important;
}
/* A folha do documento — as "barras" em volta do texto, num tom ACIMA do
   papel (para diferenciar). O PJe pinta a folha com seletor mais específico
   (.impresso .folha), então a classe é duplicada/escopada para vencer. */
.folha.folha, .impresso .folha {
    background: ${COR.folhaBg} !important;
    color: ${COR.texto} !important;
    border-color: ${COR.borda} !important;
}
/* A estrutura do editor é uma TABELA:
      tr > td > #bdInnerContent > div > #bd-pages-inner-container
   As células em volta do texto são as barras laterais. */
.folha table, .folha tbody, .folha thead, .folha tr, .folha td {
    background: ${COR.folhaBg} !important;
    border-color: ${COR.borda} !important;
}
td:has(#bdInnerContent), tr:has(#bdInnerContent),
tbody:has(#bdInnerContent), table:has(#bdInnerContent) {
    background: ${COR.folhaBg} !important;
}
/* Miolo no tom das barras; o PAPEL (área do texto) fica um pouco mais escuro. */
#bdInnerContent, #bdInnerContent > div, #bd-pages-container {
    background: ${COR.folhaBg} !important;
    color: ${COR.textoForte} !important;
}
#bd-pages-inner-container, .ProseMirror {
    background: ${COR.cardBg} !important;
    color: ${COR.textoForte} !important;
}
/* O texto do documento (a fonte e o tamanho NÃO são alterados de propósito:
   o layout da peça — quebras de página — precisa ser preservado) */
#bd-pages-inner-container *,
#bd-pages-container * {
    color: ${COR.textoForte} !important;
}
/* Links e imagens dentro da peça */
#bd-pages-inner-container a,
#bd-pages-container a {
    color: ${COR.numero} !important;
}
/* ============================================================
   MODO EDIÇÃO (frame externo da tarefa) — superfícies que ainda
   ficavam claras no dump do DOM real:
     fieldset 249,249,249 · .dropzone-previews-toolbar #fff
     .rich-table-row 249,249,249 · .modal-content #fff
     .select2-selection #fff (dropdowns "Despacho" / "Selecione o modelo")
     input.inputText #fff
   ============================================================ */
label, .label, legend, .control-label {
    color: ${COR.texto} !important;
}
fieldset {
    background: ${COR.cardBg} !important;
    border-color: ${COR.borda} !important;
}
input, select, textarea, .inputText {
    background: ${COR.cardBg} !important;
    border: 1px solid ${COR.bordaInput} !important;
    color: ${COR.textoForte} !important;
}
/* Faixa de ferramentas / barra de uploads e linhas de tabela RichFaces */
.dropzone-previews-toolbar,
.rich-table-row, .rich-table-firstrow, .rich-table-subheader {
    background: ${COR.headerBg} !important;
    color: ${COR.texto} !important;
    border-color: ${COR.borda} !important;
}
/* Dropdowns select2 (Tipo do Documento, Modelo, etc.) */
.select2-selection,
.select2-selection__rendered,
.select2-selection__arrow,
.select2-selection--single,
.select2-selection--multiple {
    background: ${COR.cardBg} !important;
    color: ${COR.textoForte} !important;
    border-color: ${COR.bordaInput} !important;
}
.select2-selection__placeholder {
    color: ${COR.textoSuave} !important;
}
.select2-dropdown,
.select2-results,
.select2-results__options,
.select2-search,
.select2-search__field {
    background: ${COR.cardBg} !important;
    color: ${COR.texto} !important;
    border-color: ${COR.bordaInput} !important;
}
.select2-results__option {
    background: ${COR.cardBg} !important;
    color: ${COR.texto} !important;
}
.select2-results__option--highlighted,
.select2-results__option[aria-selected="true"] {
    background: ${COR.painelHover} !important;
    color: ${COR.textoForte} !important;
}
/* Modais */
.modal-content, .modal-body, .modal-header, .modal-footer, .modal-title {
    background: ${COR.cardBg} !important;
    color: ${COR.texto} !important;
    border-color: ${COR.borda} !important;
}
/* O iframe do editor: o editor é um app (Badon Writer) com ShadowRoot
   próprio — o CSS do documento não entra lá; o que dá para fazer daqui é
   escurecer o quadro e avisar o navegador do esquema de cores. */
iframe#editorEstruturadoFrame {
    background: ${COR.cardBg} !important;
    color-scheme: dark;
}
`;
    }

    /* ============================================================
       INJEÇÃO
       ============================================================ */
    function injetar(css) {
        if (!css) return;
        if (typeof GM_addStyle === 'function') {
            GM_addStyle(css);
            return;
        }
        const style = document.createElement('style');
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }

    // Folha com id, para poder alternar style.disabled depois.
    function criarFolha(id, css, ativa) {
        if (!css) return null;
        const antiga = document.getElementById(id);
        if (antiga) antiga.remove();
        const el = document.createElement('style');
        el.id = id;
        el.textContent = css;
        el.disabled = !ativa;
        (document.head || document.documentElement).appendChild(el);
        return el;
    }

    // Liga/desliga as CORES na hora (sem recarregar). Mantém o layout.
    function aplicarEscuro(ativo) {
        escuroAtual = ativo !== false;

        const folha = document.getElementById(ID_FOLHA_ESCURA);
        if (folha) folha.disabled = !escuroAtual;

        const b = document.getElementById('pje-tema-btn');
        if (b) {
            b.textContent = escuroAtual ? '🌙' : '☀️';
            b.title = escuroAtual
                ? 'Tema escuro LIGADO — clique para desligar as cores'
                : 'Tema escuro DESLIGADO — clique para ligar as cores';
        }
    }

    /* --- painel: layout sempre + cores alternáveis --- */
    if (NO_PAINEL) {
        criarFolha(ID_FOLHA_LAYOUT, cssPainel(false), true);
        criarFolha(ID_FOLHA_ESCURA, cssPainel(true), escuroAtual);
        marcarCartoes();
    }

    /* --- minuta (o editor pode montar depois do document-idle) --- */
    let minutaAplicada = false;
    function aplicarMinuta() {
        if (minutaAplicada || !CFG.escuroMinuta) return;
        if (!temMinuta()) return;
        minutaAplicada = true;
        criarFolha(ID_FOLHA_ESCURA, cssMinuta(), escuroAtual);
    }
    aplicarMinuta();

    /* --- observador: SPA do painel + editor que monta tarde --- */
    let agendado = null;
    new MutationObserver(function () {
        if (agendado) return;
        agendado = setTimeout(function () {
            agendado = null;
            if (NO_PAINEL) marcarCartoes();
            aplicarMinuta();
        }, 150);
    }).observe(document.documentElement, { childList: true, subtree: true });

    /* --- sincronização entre frames (o botão fica só no topo) --- */
    try {
        if (typeof GM_addValueChangeListener === 'function') {
            GM_addValueChangeListener(CHAVE_ESCURO, function (nome, antigo, novo) {
                aplicarEscuro(novo !== false);
            });
        }
    } catch (e) { }

    /* ============================================================
       BOTÃO DO TEMA (canto inferior esquerdo)
       ============================================================ */
    function criarBotaoTema() {
        // Só no frame de TOPO: assim existe UM botão só, flutuando no canto
        // da janela, por cima dos iframes (o PJe usa 3 níveis de frame).
        let noTopo = false;
        try { noTopo = (window === window.top); } catch (e) { noTopo = false; }
        if (!noTopo) return;
        if (document.getElementById('pje-tema-btn')) return;

        injetar(`
/* Botão discreto: 24px, quase transparente; fica visível no hover. */
#pje-tema-btn {
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
#pje-tema-btn:hover {
    opacity: 1;
}`);

        const b = document.createElement('button');
        b.id = 'pje-tema-btn';
        b.type = 'button';
        b.textContent = escuroAtual ? '🌙' : '☀️';
        b.title = escuroAtual
            ? 'Tema escuro LIGADO — clique para desligar as cores'
            : 'Tema escuro DESLIGADO — clique para ligar as cores';
        b.addEventListener('click', function () {
            const novo = !escuroAtual;
            gravarEscuro(novo);   // propaga para os outros frames
            aplicarEscuro(novo);  // aplica já neste frame (sem recarregar)
        });

        const alvo = document.body || document.documentElement;
        if (alvo) alvo.appendChild(b);
    }
    criarBotaoTema();
})();
