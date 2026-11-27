// Frases de fim de grau (27/11/2026): sorteio por motivo (caiu pra trás / frente no chão), 3% de raras, sem repetir as
// 3 últimas, todas traduzidas, sorteadas uma vez por fim de volta e cabendo na tela de fim (inclusive celular deitado).
// Sem rede. Uso: node testes/frases-fim.cjs [pasta-das-capturas]
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'play-store', 'frases');
fs.mkdirSync(OUT, { recursive: true });
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const j = html.lastIndexOf('})();');
html = html.slice(0, j) + 'window.__t={stats,get best(){return best},get s(){return s},begin,finish,END_FRASES,pickEndFrase,endRecent,I18N,TUT,tutJogo};\n' + html.slice(j);
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html); }).listen(8856);
let pass = 0, fail = 0;
const ok = (c, n, x) => { c ? pass++ : fail++; console.log((c ? '  ok    ' : '  FALHA ') + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const SAVE = { 'grau80-nasc': '1990', 'grau80-nome': 'Teste', 'grau80-instrucoes': 'fechado', 'grau80-nome-pedido': '1', 'grau80-novidades': 'welcome-1', 'grau80-tutorial': '{"menuTutorialVersion":1,"gameplayTutorialVersion":1}', 'grau80-stats': '{"runs":50}', 'grau80-best': '5000.00', 'grau80-ach': '{"w_azeitona":true}' };

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio'] });
  async function session(lang, vw = 1280, vh = 720, touch = false) {
    const p = await (await b.createBrowserContext()).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', q => q.url().startsWith('http://127.0.0.1') ? q.continue() : q.respond({ status: 404, body: '' }));
    await p.setViewport({ width: vw, height: vh, hasTouch: touch, isMobile: touch });
    await p.evaluateOnNewDocument((save, lang) => { window.WebSocket = class { send() {} close() {} }; for (const [k, v] of Object.entries(save)) localStorage.setItem(k, v); localStorage.setItem('grau80-lang', lang); }, SAVE, lang);
    await p.goto('http://127.0.0.1:8856/'); await wait(1000);
    return { p, errs };
  }
  const { p, errs } = await session('pt');
  const r = await p.evaluate(() => {
    const t = __t, F = t.END_FRASES, out = { n: [F.flip.length, F.landed.length, F.rare.length] };
    out.azeitona = F.flip.includes('Piloto de azeitona!');
    const all = [...F.flip, ...F.landed, ...F.rare];
    out.semTrad = all.filter(f => !(t.I18N[f] && t.I18N[f][0] && t.I18N[f][1]));
    let rare = 0, wrong = 0, rep = 0; const last = [];
    for (let i = 0; i < 20000; i++) {
      const k = i % 2 ? 'flip' : 'landed', f = t.pickEndFrase(k);
      if (F.rare.includes(f)) rare++; else if (!F[k].includes(f)) wrong++;
      if (last.includes(f)) rep++;
      last.push(f); if (last.length > 3) last.shift();
    }
    Object.assign(out, { rare: rare / 20000, wrong, rep });
    return out;
  });
  ok(r.n[0] === 27 && r.n[1] === 22 && r.n[2] === 8, 'grupos: 27 caiu pra trás, 22 frente no chão, 8 raras', r.n);
  ok(r.azeitona, '"Piloto de azeitona!" continua entre as frases');
  ok(!r.semTrad.length, 'todas com tradução em inglês e espanhol', r.semTrad);
  ok(r.rare > 0.022 && r.rare < 0.038, 'raras saem por volta de 3%', +(r.rare * 100).toFixed(2));
  ok(r.wrong === 0, 'frase comum sempre do grupo do motivo certo', r.wrong);
  ok(r.rep === 0, 'nunca repete uma das 3 últimas', r.rep);
  // fim de volta de verdade: a frase é do grupo certo e não muda depois de sorteada
  for (const how of ['flip', 'landed']) {
    const f = await p.evaluate(async how => {
      __t.begin('motoca'); __t.s.active = true; __t.s.wDist = 40; __t.finish(how);
      const a = document.getElementById('endTitle').textContent; await new Promise(r => setTimeout(r, 1200));
      const b = document.getElementById('endTitle').textContent;
      return { a, b, ok: (__t.END_FRASES[how].includes(a) || __t.END_FRASES.rare.includes(a)), vis: !document.getElementById('endScreen').hidden };
    }, how);
    ok(f.ok && f.a === f.b && f.vis, `${how}: frase do grupo certo, sorteada uma vez só`, f.a);
    await p.evaluate(() => document.getElementById('goGarage').click()); await wait(300);
  }
  // iniciante (menos de 20 voltas) não recebe frase rara
  const ini = await p.evaluate(() => { const r = __t.stats.runs; __t.stats.runs = 3; let n = 0; for (let i = 0; i < 3000; i++) if (__t.END_FRASES.rare.includes(__t.pickEndFrase('flip'))) n++; __t.stats.runs = r; return n; });
  ok(ini === 0, 'quem está começando não recebe frase rara', ini);
  // recorde pessoal sem top 10: celebra com comparação, título sem tirar sarro, e grava
  const pb = await p.evaluate(async () => { __t.begin('motoca'); __t.s.active = true; __t.s.wDist = 6000; __t.finish('flip'); await new Promise(r => setTimeout(r, 1100));
    return { t: document.getElementById('endTitle').textContent, pb: !document.getElementById('endPB').hidden, txt: document.getElementById('pbText').textContent,
      conf: !!document.querySelector('.confetti'), gravado: localStorage.getItem('grau80-best') }; });
  ok(pb.pb && pb.t === 'Tá evoluindo!' && /antes: 5000.0 m · melhorou 1000.0 m/.test(pb.txt) && pb.conf && pb.gravado === '6000.00', 'novo recorde pessoal: celebração, comparação e gravação', pb);
  await p.evaluate(() => document.getElementById('goGarage').click()); await wait(300);
  const cmp = await p.evaluate(async () => { __t.begin('motoca'); __t.s.active = true; __t.s.wDist = 100; __t.finish('landed'); await new Promise(r => setTimeout(r, 1100));
    return { pb: !document.getElementById('endPB').hidden, cmp: document.getElementById('endCmp').textContent, linha: null }; });
  ok(!cmp.pb && cmp.cmp === 'Faltou 5900.0 m pro teu recorde (6000.0 m)', 'sem recorde: mostra quanto faltou', cmp.cmp);
  await p.evaluate(() => document.getElementById('goGarage').click()); await wait(300);
  ok(/Teu recorde · Motoca 6000.0 m · Livre/.test(await p.$eval('#pbLine', e => e.textContent)), 'tela inicial mostra o recorde pessoal de cada modo');
  // desafio continua com a frase própria
  const des = await p.evaluate(() => { __t.begin('motoca'); __t.s.law.car = { state: 'chase' }; __t.s.active = true; __t.s.wDist = 40; __t.finish('landed'); return document.getElementById('endTitle').textContent; });
  ok(des === 'Pegaro os lanche', 'perseguição do D.U.R.O. mantém a frase do desafio', des);
  await p.evaluate(() => document.getElementById('goGarage').click()); await wait(300);
  // tutorial automatizado: nunca abre tela de derrota
  const tut = await p.evaluate(async () => { __t.tutJogo('motoca', false); await new Promise(r => setTimeout(r, 300)); __t.s.th = 1.7; await new Promise(r => setTimeout(r, 400));
    return { end: !document.getElementById('endScreen').hidden, mode: __t.s.mode }; });
  ok(!tut.end && tut.mode === 'ride', 'demonstração passou do ponto: sem tela de derrota', tut);
  ok(!errs.length, 'sem erro de página', errs);
  await p.close();
  // frases mais longas em cada idioma cabem na tela de fim (PC e celular deitado)
  for (const [lang, vw, vh, touch] of [['pt', 1280, 720, false], ['pt', 740, 360, true], ['en', 740, 360, true], ['es', 740, 360, true], ['es', 390, 844, true]]) {
    const s = await session(lang, vw, vh, touch);
    const res = await s.p.evaluate(async lang => {
      const F = __t.END_FRASES, all = [...F.flip, ...F.landed, ...F.rare];
      const tr = f => lang === 'pt' ? f : __t.I18N[f][lang === 'en' ? 0 : 1];
      const longest = all.sort((a, b) => tr(b).length - tr(a).length)[0];
      __t.begin('motoca'); __t.s.active = true; __t.s.wDist = 40;
      __t.END_FRASES.landed.splice(0, __t.END_FRASES.landed.length, longest); __t.END_FRASES.rare.splice(0, 99, longest);
      __t.endRecent.length = 0; __t.finish('landed');
      await new Promise(r => setTimeout(r, 1300));
      const card = document.querySelector('#endScreen .card').getBoundingClientRect(), t = document.getElementById('endTitle').getBoundingClientRect();
      const sc = document.getElementById('endScreen');
      return { frase: document.getElementById('endTitle').textContent, cabeX: card.left >= 0 && card.right <= innerWidth + 1 && t.right <= innerWidth + 1,
        cabeY: sc.scrollHeight <= sc.clientHeight + 1, botoes: document.getElementById('goAgain').getBoundingClientRect().bottom <= innerHeight + 1 };
    }, lang);
    ok(res.cabeX && res.cabeY && res.botoes, `${lang} ${vw}x${vh}: frase mais longa cabe, sem rolar e com os botões à vista`, res);
    await s.p.screenshot({ path: path.join(OUT, `fim-${lang}-${vw}x${vh}.png`) });
    await s.p.close();
  }
  console.log(`\n${pass} ok, ${fail} falha(s)   capturas em ${OUT}`);
  await b.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
