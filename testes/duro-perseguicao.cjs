// Regressão da remodelagem D.U.R.O.: roda a MESMA partida (relógio virtual, sorteio com semente fixa, piloto automático
// do modo teste) na versão anterior (tag pre-descaracterizacao-2026-11-25) e na atual, e compara quadro a quadro o estado
// da perseguição (posições, velocidades, estados, conquistas, fim da volta). Também tira as capturas dos veículos novos.
// Uso: node testes/duro-perseguicao.cjs [pasta-das-capturas]
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'play-store', 'duro', 'capturas');
const hook = h => { const j = h.lastIndexOf('})();'); return h.slice(0, j) + 'window.__t={get s(){return s},begin,toggleCheat,get cheat(){return cheat},get best(){return best},achGot:()=>JSON.stringify(Object.keys(unlocked).sort()),fresh};\n' + h.slice(j); };
const NOVO = hook(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));
const ANTIGO = hook(execSync('git show pre-descaracterizacao-2026-11-25:index.html', { cwd: ROOT, maxBuffer: 1 << 26 }).toString('utf8'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(q.url.startsWith('/antigo') ? ANTIGO : NOVO); }).listen(8841);
let pass = 0, fail = 0;
const ok = (c, n, x) => { c ? pass++ : fail++; console.log((c ? '  ok    ' : '  FALHA ') + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); };

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio'] });
  async function session(which, vw = 1280, vh = 720, lang = 'pt') {
    const p = await (await b.createBrowserContext()).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', q => { const u = q.url(); if (u.startsWith('http://127.0.0.1')) return q.continue(); q.respond({ status: 404, body: '' }); });
    await p.evaluateOnNewDocument(lang => {
      window.WebSocket = class { constructor() { this.readyState = 0; } send() {} close() {} };
      try {
        localStorage.setItem('grau80-nome', 'Teste'); localStorage.setItem('grau80-instrucoes', 'fechado'); localStorage.setItem('grau80-nasc', '1990');
        localStorage.setItem('grau80-musica', 'off'); localStorage.setItem('grau80-lang', lang);
      } catch (e) {}
      let seed = 12345; Math.random = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
      window.__vt = 1000; const q = [];
      performance.now = () => window.__vt; Date.now = () => 1764000000000 + window.__vt;
      window.requestAnimationFrame = cb => { q.push(cb); return q.length; };
      window.__tick = ms => { window.__vt += ms; const cbs = q.splice(0); for (const cb of cbs) { try { cb(window.__vt); } catch (e) { console.error(e); } } };
    }, lang);
    await p.setViewport({ width: vw, height: vh });
    await p.goto(`http://127.0.0.1:8841/${which}`, { waitUntil: 'load' });
    const tick = (n = 1) => p.evaluate(n => { for (let i = 0; i < n; i++) window.__tick(1000 / 60); }, n);
    await tick(30);
    return { p, tick, errs };
  }
  const snap = () => {
    const s = __t.s, L = s.law, r = v => v == null ? null : Math.round(v * 1000) / 1000;
    const o = q => q ? { x: r(q.x), v: r(q.v), st: q.state, f: r(q.flat) } : null;
    return { x: r(s.x), v: r(s.v), w: r(s.wDist), m: s.mode, car: o(L.car), bikes: L.bikes.map(o), cg: o(L.cg ?? L.fuga), th: o(L.thief), uno: o(L.uno ?? L.quad),
      flags: [L.carDone, L.carEscaped, L.rocamDone ?? L.esqDone, L.rocamEscaped ?? L.esqEscaped, L.thiefDone, L.thiefEscaped, L.unoBeaten ?? L.quadBeaten].join(','), reason: s.reason || '' };
  };
  // mesma partida nas duas versões: Motoca, modo teste (piloto automático) e pulo pra perto dos 280 m
  async function run(which) {
    const c = await session(which);
    await c.p.evaluate(() => __t.begin('motoca'));
    await c.tick(5); await c.p.keyboard.type('agenor'); await c.tick(60);
    await c.p.evaluate(() => { __t.s.wStart -= 270; });
    const log = [];
    for (let i = 0; i < 6000; i++) { await c.tick(1); if (i % 3 === 0) log.push(await c.p.evaluate(snap)); if (await c.p.evaluate(() => __t.s.mode === 'over')) break; }
    const fim = await c.p.evaluate(() => ({ eyebrow: document.getElementById('endEyebrow').textContent, achs: __t.achGot() }));
    await c.p.close();
    return { log, errs: c.errs, fim };
  }
  console.log('\nA. Mesma partida, versão anterior × nova');
  const A = await run('antigo'), N = await run('novo');
  ok(!A.errs.length && !N.errs.length, 'nenhum erro de JavaScript', [...A.errs, ...N.errs].slice(0, 3));
  ok(A.log.length === N.log.length, 'mesma duração da partida (amostras)', [A.log.length, N.log.length]);
  let diff = -1; for (let i = 0; i < Math.min(A.log.length, N.log.length); i++) if (JSON.stringify(A.log[i]) !== JSON.stringify(N.log[i])) { diff = i; break; }
  ok(diff === -1, 'estado da perseguição idêntico em todas as amostras (posição, velocidade, estado de cada veículo, fim)', diff === -1 ? undefined : { i: diff, antigo: A.log[diff], novo: N.log[diff] });
  const seen = k => N.log.some(e => k(e));
  ok(seen(e => e.car && e.car.st === 'chase') && seen(e => e.car && e.car.st === 'flat'), 'a Caravana persegue e fura o pneu nos mesmos pontos');
  ok(seen(e => e.bikes.length === 3 && e.bikes.every(q => q.st === 'chase')) && seen(e => e.bikes.some(q => q.st === 'go')), 'a Esquadrilha persegue e vai atrás da CG nos mesmos pontos');
  ok(seen(e => e.bikes.some(q => q.st === 'hunt')), 'a Esquadrilha volta e espanta os ladrões');
  ok(A.fim.achs === N.fim.achs, 'mesmas conquistas no fim', N.fim.achs);
  const last = N.log[N.log.length - 1];
  console.log('    partida comparada até', last.w, 'm de grau,', N.log.length, 'amostras');

  console.log('\nB. Desempenho do desenho (tempo médio por quadro com a Caravana e a Esquadrilha na tela)');
  for (const which of ['antigo', 'novo']) {
    const c = await session(which);
    await c.p.evaluate(() => __t.begin('motoca')); await c.tick(5); await c.p.keyboard.type('agenor'); await c.tick(60);
    await c.p.evaluate(() => { __t.s.wStart -= 300; }); await c.tick(60);
    const t0 = Date.now(); await c.tick(600); const dt = (Date.now() - t0) / 600;
    console.log(`    ${which}: ${dt.toFixed(2)} ms por quadro (simulação + desenho, 1280×720, sem GPU)`);
    if (which === 'novo') ok(dt < 16, 'cabe em 60 quadros por segundo', dt.toFixed(2));
    await c.p.close();
  }

  console.log('\nC. Capturas (1280×720 e celular deitado 844×390)');
  fs.mkdirSync(OUT, { recursive: true });
  const shots = [
    ['caravana', 318, 'pt'], ['caravana-pneu', 403, 'pt'], ['esquadrilha', 524, 'pt'], ['esquadrilha-cg', 603, 'pt'], ['esquadrilha-ladroes', 1012, 'pt'],
    ['caravana-en', 330, 'en'], ['esquadrilha-es', 530, 'es']
  ];
  for (const [vw, vh, suf] of [[1280, 720, ''], [844, 390, '-celular']]) for (const [name, at, lang] of shots) {
    if (suf && lang !== 'pt') continue;
    const c = await session('novo', vw, vh, lang);
    await c.p.evaluate(() => __t.begin('motoca')); await c.tick(5); await c.p.keyboard.type('agenor'); await c.tick(60);
    await c.p.evaluate(at => { __t.s.wStart -= at - 40; }, at);
    for (let i = 0; i < 900 && (await c.p.evaluate(() => __t.s.wDist)) < at; i++) await c.tick(5);
    await c.tick(20);
    await c.p.screenshot({ path: path.join(OUT, name + suf + '.png') });
    await c.p.close();
  }
  // fim da volta pego pela Caravana e pela Esquadrilha, nos 3 idiomas
  for (const [kind, at] of [['caravana', 330], ['esquadrilha', 545]]) for (const lang of ['pt', 'en', 'es']) {
    const c = await session('novo', 1280, 720, lang);
    await c.p.evaluate(() => __t.begin('motoca')); await c.tick(5); await c.p.keyboard.type('agenor'); await c.tick(60);
    await c.p.evaluate(at => { __t.s.wStart -= at - 40; }, at);
    for (let i = 0; i < 900 && (await c.p.evaluate(() => __t.s.wDist)) < at; i++) await c.tick(5);
    await c.p.evaluate(() => { if (__t.cheat) __t.toggleCheat(); __t.s.th = 1.7; }); // desliga o piloto automático e passa do ponto com a D.U.R.O. na cola
    for (let i = 0; i < 600 && !(await c.p.evaluate(() => __t.s.mode === 'over')); i++) await c.tick(5);
    await new Promise(r => setTimeout(r, 1500)); await c.tick(10); // a tela de fim aparece com atraso de tempo real
    const txt = await c.p.evaluate(() => [document.getElementById('endEyebrow').textContent, document.getElementById('endTitle').textContent]);
    console.log(`    fim (${kind}, ${lang}):`, txt.join(' / '));
    await c.p.screenshot({ path: path.join(OUT, `fim-${kind}-${lang}.png`) });
    await c.p.close();
  }
  // tela inicial com o aviso de ficção
  for (const lang of ['pt', 'en', 'es']) {
    const c = await session('novo', 1280, 720, lang);
    await c.p.evaluate(() => { const l = document.getElementById('howList'); if (l) l.hidden = false; });
    const t = await c.p.evaluate(() => { const e = document.querySelector('.ficcao'); e.scrollIntoView(); return e.textContent; });
    console.log(`    aviso (${lang}):`, t);
    await c.p.screenshot({ path: path.join(OUT, `tela-inicial-aviso-${lang}.png`) });
    await c.p.close();
  }
  console.log(`\n${pass} ok, ${fail} falha(s)   capturas em ${OUT}`);
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
