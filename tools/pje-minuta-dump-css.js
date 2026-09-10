/* =====================================================================
   PJe - DIAGNÓSTICO: onde ficam as superfícies claras da tela da minuta?
   ---------------------------------------------------------------------
   Objetivo: mapear, no frame da minuta (movimentar.seam), os elementos
   que hoje são CLAROS (fundo branco/cinza) e grandes — ou seja, tudo que
   precisaria ficar escuro — e a estrutura do editor.

   COMO RODAR
   1) Abra a minuta no PJe (modo edição ou visualização).
   2) F12 -> aba Console -> no seletor de contexto (topo do console) escolha
      o frame "movimentar.seam".
   3) Cole este arquivo inteiro e Enter.
   4) A saída é copiada para a área de transferência automaticamente
      (e também aparece no console). Cole aqui no chat.

   Não altera nada: só lê.
   ===================================================================== */
(() => {
    const descreve = (e) => {
        if (!e || e.nodeType !== 1) return null;
        const cls = (typeof e.className === 'string' ? e.className : '').trim();
        return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (cls ? '.' + cls.split(/\s+/).slice(0, 3).join('.') : '');
    };
    const cadeia = (e, n) => {
        const p = [];
        let x = e;
        while (x && x.nodeType === 1 && p.length < n) { p.push(descreve(x)); x = x.parentElement; }
        return p.join(' < ');
    };
    // luminância aproximada: true = claro
    const claro = (cor) => {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(cor || '');
        if (!m) return false;
        if (m[4] !== undefined && parseFloat(m[4]) < 0.5) return false;
        const [r, g, b] = [+m[1], +m[2], +m[3]];
        return (0.299 * r + 0.587 * g + 0.114 * b) > 170;
    };

    const out = {
        url: location.href,
        title: document.title,
        tamanhoJanela: [innerWidth, innerHeight],
    };

    // 1) superfícies CLARAS e grandes (candidatas a escurecer)
    const superficies = [];
    for (const el of document.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width < 120 || r.height < 40) continue;          // só blocos relevantes
        const cs = getComputedStyle(el);
        if (!claro(cs.backgroundColor)) continue;
        superficies.push({
            el: descreve(el),
            w: Math.round(r.width), h: Math.round(r.height),
            bg: cs.backgroundColor,
            cor: cs.color,
            overflow: cs.overflowY,
            cadeia: cadeia(el, 4),
        });
    }
    superficies.sort((a, b) => (b.w * b.h) - (a.w * a.h));
    out.superficiesClaras = superficies.slice(0, 18);

    // 2) superfícies ESCURAS grandes (para referência do que já está escuro)
    const escuras = [];
    for (const el of document.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width < 200 || r.height < 80) continue;
        const cs = getComputedStyle(el);
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(cs.backgroundColor || '');
        if (!m) continue;
        if (claro(cs.backgroundColor)) continue;
        escuras.push({ el: descreve(el), w: Math.round(r.width), h: Math.round(r.height), bg: cs.backgroundColor });
    }
    escuras.sort((a, b) => (b.w * b.h) - (a.w * a.h));
    out.superficiesEscuras = escuras.slice(0, 8);

    // 3) editor (Bernoulli/ProseMirror/CKEditor) — estrutura e cores
    const SELS_EDITOR = ['#appEditorAreaConteudoInner', '.ProseMirror', '.cke_editable',
        '.bd-ens', '[class*="bd-pages"]', '[contenteditable="true"]'];
    out.editor = [];
    for (const s of SELS_EDITOR) {
        let nos = [];
        try { nos = [...document.querySelectorAll(s)]; } catch (e) { continue; }
        for (const el of nos.slice(0, 3)) {
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            out.editor.push({
                sel: s, el: descreve(el), w: Math.round(r.width), h: Math.round(r.height),
                bg: cs.backgroundColor, cor: cs.color, fonte: cs.fontFamily.slice(0, 60), tamanho: cs.fontSize,
                cadeia: cadeia(el, 5),
            });
        }
    }

    // 4) iframes internos e shadow roots abertos
    out.iframes = [...document.querySelectorAll('iframe')].map((f) => ({
        id: f.id, cls: (typeof f.className === 'string' ? f.className : '').slice(0, 40), src: (f.src || '').slice(0, 100),
    }));
    const sombras = [];
    const varrer = (raiz, nivel) => {
        if (!raiz || nivel > 4) return;
        for (const el of raiz.querySelectorAll('*')) {
            if (!el.shadowRoot) continue;
            const cs = getComputedStyle(el.shadowRoot.host || el);
            sombras.push({
                host: descreve(el), nivel,
                chars: (el.shadowRoot.textContent || '').replace(/\s+/g, '').length,
                bgHost: cs.backgroundColor,
                primeiros: [...el.shadowRoot.querySelectorAll('*')].slice(0, 12).map(descreve),
            });
            varrer(el.shadowRoot, nivel + 1);
        }
    };
    varrer(document, 0);
    out.shadowAbertos = sombras.slice(0, 6);

    // 5) barra de cima (título/botões) — o que aparece no topo da tela
    const topo = document.elementFromPoint(innerWidth / 2, 20);
    out.topo = topo ? { el: descreve(topo), cadeia: cadeia(topo, 4), bg: getComputedStyle(topo).backgroundColor } : null;

    const json = JSON.stringify(out, null, 1);
    console.log(json);
    try { copy(json); console.log('%c(copiado para a área de transferência)', 'color:#0a0'); } catch (e) { }
    return out;
})();
