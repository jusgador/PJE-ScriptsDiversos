/* =====================================================================
   PJe - DIAGNÓSTICO: editor da minuta (MODO EDIÇÃO)
   ---------------------------------------------------------------------
   Objetivo: descobrir (a) quais superfícies ainda estão CLARAS no modo
   edição (barra de ferramentas, breadcrumb, folha, dropdowns), (b) se o
   editor está dentro de um iframe e se é acessível, (c) as classes reais
   do editor (classes bd-*, ProseMirror, toolbar).

   COMO RODAR
   1) Abra a minuta em MODO EDIÇÃO no PJe.
   2) F12 -> Console -> no seletor de contexto escolha o frame
      "movimentar.seam".
   3) Cole este arquivo inteiro e Enter.
   4) A saída é copiada para a área de transferência; cole no chat.

   Não altera nada: só lê.
   ===================================================================== */
(() => {
    const desc = (e) => {
        if (!e || e.nodeType !== 1) return null;
        const cls = (typeof e.className === 'string' ? e.className : '').trim();
        return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') +
            (cls ? '.' + cls.split(/\s+/).slice(0, 3).join('.') : '');
    };
    const claro = (cor) => {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(cor || '');
        if (!m) return false;
        if (m[4] !== undefined && parseFloat(m[4]) < 0.5) return false;
        return (0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]) > 170;
    };

    // superfícies claras e grandes de UM documento (recursivo p/ iframes)
    function superficies(doc, rotulo) {
        const out = [];
        let nos = [];
        try { nos = [...doc.querySelectorAll('*')]; } catch (e) { return out; }
        for (const el of nos) {
            const r = el.getBoundingClientRect();
            if (r.width < 100 || r.height < 24) continue;
            const cs = getComputedStyle(el);
            if (!claro(cs.backgroundColor)) continue;
            out.push({
                onde: rotulo, el: desc(el), w: Math.round(r.width), h: Math.round(r.height),
                bg: cs.backgroundColor, cor: cs.color,
            });
        }
        out.sort((a, b) => (b.w * b.h) - (a.w * a.h));
        return out.slice(0, 14);
    }

    const out = { url: location.href, janela: [innerWidth, innerHeight] };

    // 1) superfícies claras no próprio frame da minuta
    out.clarasNoFrame = superficies(document, 'frame-minuta');

    // 2) iframes: acessíveis? o que têm dentro?
    out.iframes = [];
    for (const f of document.querySelectorAll('iframe')) {
        const item = { el: desc(f), src: (f.src || '').slice(0, 110), w: f.offsetWidth, h: f.offsetHeight };
        try {
            const d = f.contentDocument;
            item.acessivel = !!d;
            if (d) {
                item.clarasDentro = superficies(d, 'iframe:' + (f.id || '(sem id)'));
                item.proseMirror = [...d.querySelectorAll('.ProseMirror, [class*="bd-"], .cke_editable, [contenteditable="true"]')]
                    .slice(0, 12).map((e) => {
                        const cs = getComputedStyle(e);
                        return { el: desc(e), bg: cs.backgroundColor, cor: cs.color, editavel: e.isContentEditable === true };
                    });
            }
        } catch (e) { item.acessivel = false; item.erro = e.message; }
        out.iframes.push(item);
    }

    // 3) editor no PRÓPRIO frame (modo edição sem iframe)
    const SELS = [
        '#appEditorAreaConteudoInner', '.ProseMirror', '.ProseMirror[contenteditable="true"]',
        '.bd-ens', '[class*="bd-pages"]', '[class*="bd-toolbar"]', '[class*="bd-"]',
        '[contenteditable="true"]', '.cke_editable',
    ];
    out.editorNoFrame = [];
    for (const s of SELS) {
        let nos = [];
        try { nos = [...document.querySelectorAll(s)]; } catch (e) { continue; }
        for (const el of nos.slice(0, 4)) {
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            out.editorNoFrame.push({
                sel: s, el: desc(el), w: Math.round(r.width), h: Math.round(r.height),
                bg: cs.backgroundColor, cor: cs.color, editavel: el.isContentEditable === true,
            });
        }
    }

    // 4) todas as classes bd-* / toolbar presentes (ajuda a achar os nomes)
    const classes = new Set();
    for (const el of document.querySelectorAll('[class]')) {
        const c = (typeof el.className === 'string' ? el.className : '').trim();
        if (!c) continue;
        for (const nome of c.split(/\s+/)) {
            if (/^(bd-|appEditor|toolbar|cke_|editor)/i.test(nome)) classes.add(nome);
        }
    }
    out.classesEditor = [...classes].slice(0, 40);

    // 5) barra de ferramentas e breadcrumb (os claros do topo)
    out.topo = [...document.querySelectorAll('*')]
        .filter((e) => { const r = e.getBoundingClientRect(); return r.top < 420 && r.width > 200 && r.height > 20; })
        .slice(0, 12)
        .map((e) => {
            const cs = getComputedStyle(e);
            return { el: desc(e), bg: cs.backgroundColor, h: Math.round(e.getBoundingClientRect().height) };
        });

    const json = JSON.stringify(out, null, 1);
    console.log(json);
    try { copy(json); console.log('%c(copiado)', 'color:#0a0'); } catch (e) { }
    return out;
})();
