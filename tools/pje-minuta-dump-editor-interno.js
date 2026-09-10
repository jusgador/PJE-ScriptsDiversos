/* =====================================================================
   PJe - DIAGNÓSTICO: o editor (Badon Writer) — FRAME INTERNO
   ---------------------------------------------------------------------
   Rode este script no frame INTERNO do editor
   (iframe#editorEstruturadoFrame — a entrada do console cujo conteúdo é
   só <body> + <div id="badon-writer-app-container">).

   Responde: (a) o texto do documento está no DOM leve ou num ShadowRoot
   (aberto/fechado)? (b) quais classes/cores o editor usa? (c) se dá para
   escurecer por CSS ou se só dá via variáveis CSS / filtro.

   Não altera nada: só lê.
   ===================================================================== */
(() => {
    const desc = (e) => {
        if (!e || e.nodeType !== 1) return null;
        const cls = (typeof e.className === 'string' ? e.className : '').trim();
        return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') +
            (cls ? '.' + cls.split(/\s+/).slice(0, 4).join('.') : '');
    };
    const cadeia = (e, n) => {
        const p = []; let x = e;
        while (x && x.nodeType === 1 && p.length < n) { p.push(desc(x)); x = x.parentElement; }
        return p.join(' < ');
    };
    const cor = (e, p) => { try { return getComputedStyle(e)[p]; } catch (err) { return null; } };

    const out = { url: location.href, janela: [innerWidth, innerHeight] };
    out.totalElementos = document.querySelectorAll('*').length;

    // 1) ShadowRoots ABERTOS (se o editor usar fechado, isto vem vazio)
    const sombras = [];
    const varrer = (raiz, nivel) => {
        if (!raiz || nivel > 4) return;
        let nos = [];
        try { nos = [...raiz.querySelectorAll('*')]; } catch (e) { return; }
        for (const el of nos) {
            if (!el.shadowRoot) continue;
            sombras.push({
                host: desc(el), nivel,
                chars: (el.shadowRoot.textContent || '').replace(/\s+/g, '').length,
                primeiros: [...el.shadowRoot.querySelectorAll('*')].slice(0, 15).map(desc),
            });
            varrer(el.shadowRoot, nivel + 1);
        }
    };
    varrer(document, 0);
    out.shadowAbertos = sombras.slice(0, 6);

    // 2) o texto do documento está no DOM leve?
    const FRASE = 'PODER JUDICI';
    let noLeve = false;
    try { noLeve = ((document.body && document.body.textContent) || '').includes(FRASE); } catch (e) { }
    out.textoNoDomLeve = noLeve;

    if (noLeve) {
        const alvo = [...document.querySelectorAll('*')].filter((e) => {
            const t = e.textContent || '';
            if (!t.includes(FRASE)) return false;
            return ![...e.children].some((c) => (c.textContent || '').includes(FRASE));
        }).slice(0, 3);
        out.ondeEstaOTexto = alvo.map((e) => ({
            el: desc(e), cadeia: cadeia(e, 6),
            bg: cor(e, 'backgroundColor'), cor: cor(e, 'color'),
            editavel: e.isContentEditable === true,
        }));
    }

    // 3) o container do editor e seus filhos diretos
    const app = document.getElementById('badon-writer-app-container');
    if (app) {
        out.appContainer = {
            cadeia: cadeia(app, 4),
            bg: cor(app, 'backgroundColor'), cor: cor(app, 'color'),
            filhos: [...app.children].slice(0, 12).map((c) => ({
                el: desc(c), bg: cor(c, 'backgroundColor'), cor: cor(c, 'color'),
                h: Math.round(c.getBoundingClientRect().height),
                classes: [...c.querySelectorAll('*')].slice(0, 10).map(desc),
            })),
            cssVars: (() => {
                const cs = getComputedStyle(app);
                const vars = [];
                for (const nome of ['--bw-bg', '--background', '--color', '--bw-color', '--bw-text', '--bw-surface']) {
                    const v = cs.getPropertyValue(nome);
                    if (v && v.trim()) vars.push(nome + ': ' + v.trim());
                }
                return vars;
            })(),
            corEsquema: cor(app, 'colorScheme'),
        };
    }

    // 4) classes mais comuns (ajuda a achar os nomes do editor)
    const contagem = new Map();
    for (const el of document.querySelectorAll('[class]')) {
        const c = (typeof el.className === 'string' ? el.className : '').trim();
        if (!c) continue;
        for (const nome of c.split(/\s+/)) contagem.set(nome, (contagem.get(nome) || 0) + 1);
    }
    out.classesMaisComuns = [...contagem.entries()]
        .sort((a, b) => b[1] - a[1]).slice(0, 30).map(([n, q]) => n + ' (' + q + ')');

    // 5) superfícies claras (mesmo critério dos outros dumps)
    const claro = (c) => {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c || '');
        if (!m) return false;
        if (m[4] !== undefined && parseFloat(m[4]) < 0.5) return false;
        return (0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]) > 170;
    };
    out.claras = [...document.querySelectorAll('*')]
        .filter((e) => { const r = e.getBoundingClientRect(); return r.width >= 80 && r.height >= 16; })
        .filter((e) => claro(cor(e, 'backgroundColor')))
        .slice(0, 20)
        .map((e) => ({ el: desc(e), bg: cor(e, 'backgroundColor'), cor: cor(e, 'color'), editavel: e.isContentEditable === true }));

    const json = JSON.stringify(out, null, 1);
    console.log(json);
    try { copy(json); console.log('%c(copiado)', 'color:#0a0'); } catch (e) { }
    return out;
})();
