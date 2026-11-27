// Dicas do Agenor (27/11/2026): aparecem pra quem está começando, falam do erro certo, não repetem as 3 últimas,
// ficam raras pra quem já joga muito, somem quando desligadas e nunca aparecem na sala nem na demonstração. Sem rede.
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
let html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const j = html.lastIndexOf('})();');
html = html.slice(0, j) + 'window.__t={get s(){return s},begin,finish,stats,TIPS,pickTip,toggleCheat};\n' + html.slice(j);
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html); }).listen(8859);
let pass = 0, fail = 0;
const ok = (c, n, x) => { c ? pass++ : fail++; console.log((c ? '  ok    ' : '  FALHA ') + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio'] });
  async function session(save, vw = 1280, vh = 720, touch = false) {
    const p = await (await b.createBrowserContext()).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.setRequestInterception(true); p.on('request', q => q.url().startsWith('http://127.0.0.1') ? q.continue() : q.respond({ status: 404, body: '' }));
    await p.setViewport({ width: vw, height: vh, hasTouch: touch, isMobile: touch });
    await p.evaluateOnNewDocument(save => { window.WebSocket = class { send() {} close() {} }; for (const [k, v] of Object.entries(save)) localStorage.setItem(k, v); }, save);
    await p.goto('http://127.0.0.1:8859/'); await wait(1100); return { p, errs };
  }
  const BASE = { 'grau80-nasc': '1990', 'grau80-nome': 'T', 'grau80-instrucoes': 'fechado', 'grau80-nome-pedido': '1', 'grau80-novidades': 'welcome-1', 'grau80-tutorial': '{"menuTutorialVersion":1,"gameplayTutorialVersion":1}', 'grau80-best': '5000.00', 'grau80-ach': '{"w_azeitona":true}' };
  const { p, errs } = await session({ ...BASE, 'grau80-best': '10.00' });
  const r = await p.evaluate(async () => {
    const out = {};
    const fim = async how => { __t.begin('motoca'); __t.s.active = true; __t.s.wDist = 5; __t.s.maxWT = 3; __t.finish(how); await new Promise(r => setTimeout(r, 950));
      const t = document.getElementById('endTip').hidden ? '' : document.getElementById('tipText').textContent; document.getElementById('goGarage').click(); return t; };
    out.f1 = await fim('flip'); out.f2 = await fim('flip'); out.f3 = await fim('flip'); out.f4 = await fim('flip');
    out.erroCerto = [out.f3, out.f4].every(t => __t.TIPS.flip.includes(t)); // 3 iguais seguidas: dica do erro que se repete
    out.semRep = new Set([out.f2, out.f3, out.f4]).size === 3;
    out.l1 = await fim('landed');
    __t.stats.runs = 500; localStorage.setItem('x', 1); let n = 0; for (let i = 0; i < 2000; i++) if (__t.pickTip('flip')) n++; out.veterano = n / 2000; __t.stats.runs = 3;
    return out;
  });
  ok(r.f1 && r.f2 && r.f3 && r.f4, 'iniciante: dica em toda volta', r);
  ok(r.erroCerto, 'queda pra trás repetida: dica de freio');
  ok(r.semRep, 'não repete as 3 últimas');
  ok(r.l1 && (/puxão|roda|giro/.test(r.l1) || /Livre|Controles|Tutorial|equilíbrio/.test(r.l1)), 'frente no chão: dica de puxão (ou de iniciante)', r.l1);
  ok(r.veterano > 0.06 && r.veterano < 0.14, 'quem já jogou 500 voltas vê pouca dica (~10%)', r.veterano);
  await p.evaluate(async () => { __t.begin('motoca'); __t.s.active = true; __t.s.wDist = 40; __t.finish('flip'); await new Promise(r => setTimeout(r, 950)); });
  if (await p.$eval('#endTip', e => !e.hidden)) await p.click('#tipOff');
  ok(await p.evaluate(() => localStorage.getItem('grau80-dicas') === '0' && document.getElementById('endTip').hidden), 'Não mostrar mais: desliga e guarda');
  await p.click('#goGarage'); await wait(300);
  ok(await p.$eval('#tipToggle', e => e.textContent) === 'Dicas do Agenor: desligadas', 'botão embaixo de Como jogar mostra desligadas');
  const off = await p.evaluate(async () => { let n = 0; for (let i = 0; i < 3; i++) { __t.begin('motoca'); __t.s.active = true; __t.s.wDist = 40; __t.finish('flip'); await new Promise(r => setTimeout(r, 950)); if (!document.getElementById('endTip').hidden) n++; document.getElementById('goGarage').click(); } return n; });
  ok(off === 0, 'desligadas: nenhuma dica', off);
  await p.click('#tipToggle'); ok(await p.evaluate(() => localStorage.getItem('grau80-dicas') === '1'), 'liga de novo');
  ok(!errs.length, 'sem erro de página', errs);
  await p.close();
  for (const [lang, w, hh] of [['pt', 740, 360], ['es', 740, 360], ['en', 390, 844]]) {
    const c = await session({ ...BASE, 'grau80-lang': lang, 'grau80-best': '10.00' }, w, hh, true);
    const res = await c.p.evaluate(async () => { __t.begin('motoca'); __t.s.active = true; __t.s.wDist = 40; __t.s.newRecord = false; __t.finish('landed'); await new Promise(r => setTimeout(r, 1000));
      const sc = document.getElementById('endScreen'), a = document.getElementById('goAgain').getBoundingClientRect();
      return { dica: !document.getElementById('endTip').hidden, rola: sc.scrollHeight > sc.clientHeight + 1, botao: a.bottom <= innerHeight + 1 }; });
    ok(res.dica && !res.rola && res.botao, `${lang} ${w}x${hh}: tela de fim com dica cabe sem rolar`, res);
    await c.p.screenshot({ path: path.join(__dirname, '..', 'play-store', 'frases', `dica-${lang}-${w}x${hh}.png`) });
    await c.p.close();
  }
  console.log(`\n${pass} ok, ${fail} falha(s)`);
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
