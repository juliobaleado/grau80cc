// Novidades da versão e feedback (27/11/2026): novidades só pra quem já jogava, uma vez por versão, na fila sem
// sobrepor idade/convite/tour, reabrir manual; feedback com validação, servidor simulado (ok, limite, fora do ar, sem
// internet), espera de 1 min entre envios e informações técnicas opcionais. Uso: node testes/novidades-feedback.cjs
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
let html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const j = html.lastIndexOf('})();');
html = html.slice(0, j) + 'window.__t={TUT,input};\n' + html.slice(j);
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html); }).listen(8860);
let pass = 0, fail = 0;
const ok = (c, n, x) => { c ? pass++ : fail++; console.log((c ? '  ok    ' : '  FALHA ') + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const VET = { 'grau80-nasc': '1990', 'grau80-nome': 'Veterano', 'grau80-instrucoes': 'fechado', 'grau80-best': '300.00' };
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio'] });
  const srvMode = { v: '404' }, bodies = [];
  async function session(save, { url = '', vw = 1280, vh = 720, touch = false, ctx = null } = {}) {
    const c = ctx || await b.createBrowserContext(), p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', q => {
      const u = q.url(); if (u.startsWith('http://127.0.0.1')) return q.continue();
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
      if (q.method() === 'OPTIONS') return q.respond({ status: 204, headers: cors, body: '' });
      if (u.includes('/rpc/grau_feedback')) {
        bodies.push(q.postData());
        if (srvMode.v === 'net') return q.abort();
        if (srvMode.v === '404') return q.respond({ status: 404, headers: cors, body: '' });
        return q.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(srvMode.v) });
      }
      q.respond({ status: 404, body: '' });
    });
    await p.setViewport({ width: vw, height: vh, hasTouch: touch, isMobile: touch });
    await p.evaluateOnNewDocument(save => { window.WebSocket = class { send() {} close() {} };
      if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', 1); for (const [k, v] of Object.entries(save)) localStorage.setItem(k, v); } }, save);
    await p.goto('http://127.0.0.1:8860/' + url); await wait(1300);
    return { p, errs, c };
  }
  const vis = (p, id) => p.$eval('#' + id, e => !e.hidden);

  console.log('— novidades');
  const ctx = await b.createBrowserContext();
  let { p, errs } = await session(VET, { ctx });
  ok(await vis(p, 'newsModal'), 'jogador antigo: novidades abrem sozinhas');
  ok(!(await p.evaluate(() => __t.TUT.on)), 'o tour espera as novidades (nada por cima)');
  const items = await p.$$eval('#newsList li', L => L.map(l => l.textContent));
  ok(items.length === 7 && !items.some(t => /patinete/.test(t)), 'lista só com o que existe (patinete só pra testador do app)', items.length);
  await p.click('#newsOk'); await wait(800);
  ok(!(await vis(p, 'newsModal')) && await p.evaluate(() => __t.TUT.on && __t.TUT.kind === 'menu'), 'fechou: vem o tour dos menus');
  ok(await p.evaluate(() => localStorage.getItem('grau80-novidades') === 'welcome-1'), 'grava a versão vista');
  await p.keyboard.press('Escape'); await wait(200);
  await p.reload(); await wait(1300);
  ok(!(await vis(p, 'newsModal')), 'reabriu o jogo: não mostra de novo');
  await p.click('#newsBtn'); await wait(200);
  ok(await vis(p, 'newsModal'), '"Últimas novidades" reabre');
  await p.keyboard.press('Escape'); await wait(200);
  ok(!(await vis(p, 'newsModal')) && !(await p.evaluate(() => __t.TUT.on)), 'Esc fecha e não puxa o tour de novo');
  ok(!errs.length, 'sem erro de página', errs);
  await p.close(); await ctx.close();
  ({ p } = await session({}));
  ok(await vis(p, 'ageModal') && !(await vis(p, 'newsModal')), 'jogador novo: tela de idade, sem novidades');
  await p.select('#ageYear', '1995'); await p.click('#ageOk'); await wait(800);
  ok(!(await vis(p, 'newsModal')) && await p.evaluate(() => __t.TUT.on), 'jogador novo vai direto pro tour');
  await p.close();
  ({ p } = await session(VET, { url: '?sala=ZZZZ' }));
  ok(await vis(p, 'newsModal') && !(await vis(p, 'mpModal')), 'antigo com convite: novidades primeiro');
  await p.click('#newsOk'); await wait(700);
  ok(await vis(p, 'mpModal') && await p.$eval('#mpCode', e => e.value) === 'ZZZZ', 'depois o convite da sala');
  await p.close();

  console.log('— feedback');
  ({ p, errs } = await session({ ...VET, 'grau80-novidades': 'welcome-1', 'grau80-tutorial': '{"menuTutorialVersion":2,"gameplayTutorialVersion":1}' }));
  await p.evaluate(() => document.getElementById('fbBtn').click()); await wait(200);
  ok(await vis(p, 'fbModal') && /v\d+ · navegador · computador · pt/.test(await p.$eval('#fbTechTxt', e => e.textContent)), 'abre com as informações técnicas mostradas', await p.$eval('#fbTechTxt', e => e.textContent));
  await p.type('#fbMsg', 'oi'); await p.click('#fbSend'); await wait(200);
  ok(/pelo menos 3/.test(await p.$eval('#fbOut', e => e.textContent)) && bodies.length === 0, 'mensagem curta não envia');
  await p.type('#fbMsg', ' tudo bem? A Nórdica ficou show');
  ok(await p.evaluate(() => !__t.input.gas), 'digitar (Espaço) não acelera a moto');
  srvMode.v = '404'; await p.click('#fbSend'); await wait(400);
  ok(/ainda não está no ar/.test(await p.$eval('#fbOut', e => e.textContent)), 'servidor sem a função: avisa que ainda não está no ar');
  srvMode.v = 'net'; await p.click('#fbSend'); await wait(400);
  ok(/Confere a internet/.test(await p.$eval('#fbOut', e => e.textContent)), 'sem internet: avisa');
  srvMode.v = 'muitos_envios'; await p.click('#fbSend'); await wait(400);
  ok(/Muito envio/.test(await p.$eval('#fbOut', e => e.textContent)), 'limite do servidor: avisa');
  srvMode.v = 'ok'; await p.click('#fbCat'); await p.select('#fbCat', 'moto'); await p.click('#fbTech'); await p.click('#fbSend'); await wait(400);
  const last = JSON.parse(bodies[bodies.length - 1]);
  ok(/chegou/.test(await p.$eval('#fbOut', e => e.textContent)) && await p.$eval('#fbMsg', e => e.value) === '', 'servidor confirmou: agradece e limpa');
  ok(last.p_categoria === 'moto' && last.p_info === null && /Nórdica/.test(last.p_mensagem) && !('nome' in last) && Object.keys(last).length === 3, 'envia só assunto, mensagem e (se marcado) info técnica', last);
  await p.type('#fbMsg', 'outra ideia aqui'); const n0 = bodies.length; await p.click('#fbSend'); await wait(300);
  ok(bodies.length === n0 && /Muito envio/.test(await p.$eval('#fbOut', e => e.textContent)), 'espera 1 minuto entre envios');
  await p.keyboard.press('Escape'); await wait(150);
  ok(!(await vis(p, 'fbModal')), 'Esc fecha');
  ok(!errs.length, 'sem erro de página', errs);
  await p.close();
  for (const [w, hh] of [[740, 360], [390, 844]]) {
    const c = await session({ ...VET, 'grau80-lang': 'es' }, { vw: w, vh: hh, touch: true });
    const fit = id => c.p.evaluate(id => { const k = document.querySelector('#' + id + ' .pixm-card').getBoundingClientRect(); return k.top >= 0 && k.bottom <= innerHeight + 1 && k.right <= innerWidth + 1; }, id);
    const a = await fit('newsModal'); await c.p.screenshot({ path: path.join(__dirname, '..', 'play-store', 'onboarding', `novidades-${w}.png`) });
    await c.p.click('#newsOk'); await wait(600); await c.p.keyboard.press('Escape');
    await c.p.evaluate(() => document.getElementById('fbBtn').click()); await wait(200);
    const f = await fit('fbModal'); await c.p.screenshot({ path: path.join(__dirname, '..', 'play-store', 'onboarding', `feedback-${w}.png`) });
    ok(a && f, `${w}x${hh} (espanhol): novidades e feedback cabem na tela`, [a, f]);
    await c.p.close();
  }
  console.log(`\n${pass} ok, ${fail} falha(s)`);
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
