// ==UserScript==
// @name         PJe - Minuta: editor escuro (Badon Writer / ShadowRoot)
// @namespace    pje.minuta.editor.escuro
// @version      0.3.2
// @description  Escurece o editor da minuta (Badon Writer). O editor vive em iframe#editorEstruturadoFrame (src="", about:blank, que o Tampermonkey NÃO alcança) > #badon-writer-app-container > ShadowRoot FECHADO > iframe#appEditorAreaIframe (o papel). Este script roda no frame pai (mesma origem) e desce essa cadeia: patcha o attachShadow de cada realm e injeta a folha escura no documento externo, no ShadowRoot e no documento do iframe interno.
// @author       Ricardo
// @match        https://pje1g.trf5.jus.br/pje/*
// @match        https://pje2g.trf5.jus.br/pje/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

/*
 * CADEIA REAL (descoberta por diagnóstico):
 *
 *   movimentar.seam?edicao=true (frame pai — este script roda aqui)
 *     └─ iframe#editorEstruturadoFrame (src="", about:blank, mesma origem)
 *          └─ #badon-writer-app-container
 *               └─ ShadowRoot FECHADO (capturado via patch de attachShadow)
 *                    ├─ div#targetContent (barra de ferramentas etc.)
 *                    └─ iframe#appEditorAreaIframe   ← O PAPEL mora aqui
 *
 * Por que em três camadas: CSS de documento não atravessa iframe nem shadow
 * fechado. Então a folha escura é injetada (1) no documento do iframe
 * externo, (2) dentro do ShadowRoot e (3) no documento do iframe interno.
 *
 * O liga/desliga vem do localStorage (mesma origem para topo/minuta/editor);
 * o evento storage atualiza as folhas a quente, sem recarregar.
 */

(function () {
    'use strict';

    const CHAVE = 'pje-tema-escuro';
    const ID_FRAME = 'editorEstruturadoFrame';
    const ID_AREA_IFRAME = 'appEditorAreaIframe';
    const ID_DOC = 'pje-editor-escuro-doc';
    const ID_ROOT = 'pje-editor-escuro-root';
    const LOG = '[pje-editor-escuro]';

    console.log(LOG, 'iniciou em', location.href);

    // Folha do DOCUMENTO do iframe externo (DOM leve: html/body/container).
    const CSS_DOC = `
html, body, #badon-writer-app-container {
    background: #1c2128 !important;
    color: #e6edf3 !important;
    color-scheme: dark;
}
`;

    // Folha do DOCUMENTO do iframe INTERNO (o papel e as barras laterais).
    const CSS_DOC_ANINHADO = `
html, body {
    background: #1c2128 !important;
    color: #e6edf3 !important;
    color-scheme: dark;
}
body * {
    color: #e6edf3 !important;
    background-color: transparent !important;
    border-color: #2d333b !important;
}
body a, body a * {
    color: #6cb8e0 !important;
}
body input, body textarea, body select {
    background-color: #1c2128 !important;
    color: #e6edf3 !important;
    border-color: #3a434e !important;
}
`;

    // Folha DENTRO do ShadowRoot (barra de ferramentas e casca do editor).
    const CSS_ROOT = `
:host {
    background: #1c2128 !important;
    color: #e6edf3 !important;
    color-scheme: dark;
}
:host * {
    color: #e6edf3 !important;
    background-color: transparent !important;
    border-color: #2d333b !important;
}
:host a, :host a * {
    color: #6cb8e0 !important;
}
:host input, :host textarea, :host select {
    background-color: #1c2128 !important;
    color: #e6edf3 !important;
    border-color: #3a434e !important;
}
`;

    const raizes = new Map();            // raiz -> Document dono (p/ criar style)
    const iframesAninhados = new WeakSet();

    function ativo() {
        try { return localStorage.getItem(CHAVE) !== '0'; } catch (e) { return true; }
    }

    /* ----- patch do attachShadow de um realm ----- */
    function patchRealm(win, doc) {
        const proto = win && win.Element && win.Element.prototype;
        if (!proto || !proto.attachShadow || proto.attachShadow.__pjeEditorEscuro) return false;
        const original = proto.attachShadow;
        const novo = function (init) {
            const raiz = original.call(this, init);
            try {
                raizes.set(raiz, doc);
                console.log(LOG, 'ShadowRoot capturado no realm de', doc.location.href,
                    'mode=' + (init && init.mode),
                    'host=' + (this.id || this.className || this.tagName));
                setTimeout(aplicar, 0);
            } catch (e) { }
            return raiz;
        };
        novo.__pjeEditorEscuro = true;
        proto.attachShadow = novo;
        console.log(LOG, 'patch de attachShadow instalado em', doc.location.href);
        return true;
    }

    /* ----- injeção em Documentos ----- */
    function injetarNoDoc(doc, css) {
        if (!doc || !doc.documentElement) return;
        let el = null;
        try { el = doc.getElementById(ID_DOC); } catch (e) { }
        if (!el) {
            el = doc.createElement('style');
            el.id = ID_DOC;
            el.textContent = css;
            try { (doc.head || doc.documentElement).appendChild(el); } catch (e) { return; }
        } else {
            // Reanexar: os estilos do app entram depois; ficando por último,
            // a gente vence a cascata.
            try { (doc.head || doc.documentElement).appendChild(el); } catch (e) { }
        }
        el.disabled = !ativo();
    }

    function injetarNaRaiz(raiz, doc) {
        let el = null;
        try { el = raiz.getElementById ? raiz.getElementById(ID_ROOT) : null; } catch (e) { }
        if (!el) {
            el = doc.createElement('style');
            el.id = ID_ROOT;
            el.textContent = CSS_ROOT;
            try { (raiz.head || raiz).appendChild(el); } catch (e) { return; }
        } else {
            try { raiz.appendChild(el); } catch (e) { }
        }
        el.disabled = !ativo();
    }

    function prepararDocumento(win, doc, css) {
        if (!win || !doc || !doc.documentElement) return false;
        patchRealm(win, doc);
        injetarNoDoc(doc, css);
        return true;
    }

    /* ----- aplica tudo, descendo a cadeia ----- */
    function aplicar() {
        // 1) iframe externo do editor
        const f = document.getElementById(ID_FRAME);
        if (f) {
            try {
                const w = f.contentWindow;
                const d = f.contentDocument || (w && w.document);
                if (d) prepararDocumento(w, d, CSS_DOC);
            } catch (e) { }
        }

        // 2) ShadowRoots capturados + 3) iframe interno do papel
        raizes.forEach(function (doc, raiz) {
            injetarNaRaiz(raiz, doc);
            try {
                const area = raiz.getElementById ? raiz.getElementById(ID_AREA_IFRAME) : null;
                if (!area) return;
                if (!iframesAninhados.has(area)) {
                    iframesAninhados.add(area);
                    area.addEventListener('load', aplicar);
                }
                const w = area.contentWindow;
                const d = area.contentDocument || (w && w.document);
                if (d) prepararDocumento(w, d, CSS_DOC_ANINHADO);
            } catch (e) { }
        });
    }

    // Realm deste frame (nunca é demais).
    patchRealm(window, document);

    /* ----- diagnóstico: dump das duas camadas ----- */
    let dumpFeito = false;
    function desc(e) {
        const cls = (typeof e.className === 'string' ? e.className : '').trim();
        return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') +
            (cls ? '.' + cls.split(/\s+/).slice(0, 3).join('.') : '');
    }
    function resumo(docRaiz) {
        try {
            const nos = [...docRaiz.querySelectorAll('*')];
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
        if (dumpFeito || raizes.size === 0) return;
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

    // Repetição teimosa: a cadeia monta tarde e em camadas.
    [0, 200, 500, 1000, 2000, 4000, 8000].forEach(function (ms) {
        setTimeout(function () { aplicar(); if (ms >= 4000) dumpRaizes(); }, ms);
    });

    let agendado = null;
    new MutationObserver(function () {
        if (agendado) return;
        agendado = setTimeout(function () { agendado = null; aplicar(); dumpRaizes(); }, 150);
    }).observe(document.documentElement, { childList: true, subtree: true });

    window.addEventListener('storage', function (e) {
        if (!e || e.key === CHAVE) aplicar();
    });

    document.addEventListener('load', function (e) {
        const alvo = e.target;
        if (alvo && (alvo.id === ID_FRAME || alvo.id === ID_AREA_IFRAME)) aplicar();
    }, true);

    aplicar();
})();
