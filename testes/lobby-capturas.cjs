// Capturas do lobby (UI/UX Evolution V1) em vários tamanhos: tela inicial, garagem, modais e chat.
// Uso: node testes/lobby-capturas.cjs [index.html] [pasta]   (sem rede; WebSocket falso)
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = process.argv[2] || path.join(ROOT, 'index.html');
const OUT = process.argv[3] || path.join(ROOT, 'play-store', 'lobby', 'depois');
fs.mkdirSync(OUT, { recursive: true });
const html = fs.readFileSync(SRC, 'utf8');
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u.startsWith('/img/')) { const f = path.join(ROOT, u); if (fs.existsSync(f)) { r.writeHead(200, { 'content-type': 'image/webp' }); return r.end(fs.readFileSync(f)); } }
  r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html);
}).listen(8862);
const SAVE = { 'grau80-nasc': '1990', 'grau80-nome': 'Veterano', 'grau80-nome-pedido': '1', 'grau80-novidades': 'welcome-1', 'grau80-instrucoes': 'fechado',
  'grau80-tutorial': '{"menuTutorialVersion":2,"gameplayTutorialVersion":1}', 'grau80-best': '412.30', 'grau80-best-livre': '88.10',
  'grau80-ach': '{"grau30":true,"grau100":true,"w_azeitona":true}', 'grau80-look': '{"model":"monark","frame":"ferrari"}' };
const BOARD = [{ nome: 'ReiDoGrau', metros: 2310.4 }, { nome: 'Zezinho', metros: 1880.2 }, { nome: 'Veterano', metros: 412.3 }, { nome: 'Motoca777', metros: 390 }, { nome: 'Lu', metros: 251.6 }, { nome: 'Bia', metros: 199 }, { nome: 'Kaká', metros: 150.2 }];
const VPS = (process.env.VPS || '1920x1080,1440x900,1366x768,1280x720,1024x768,844x390,667x375').split(',').map(v => v.split('x').map(Number));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio'] });
  const errs = [];
  for (const [w, hh] of VPS) {
    const touch = w < 1000 && hh < 500;
    const p = await (await b.createBrowserContext()).newPage(); p.on('pageerror', e => errs.push(w + ': ' + e.message));
    await p.setRequestInterception(true);
    p.on('request', q => { const u = q.url(); if (u.startsWith('http://127.0.0.1')) return q.continue();
      if (q.method() === 'OPTIONS') return q.respond({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }, body: '' });
      if (u.includes('/rest/v1/placar')) return q.respond({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'application/json', body: JSON.stringify(BOARD) });
      q.respond({ status: 404, body: '' }); });
    await p.setViewport({ width: w, height: hh, hasTouch: touch, isMobile: touch });
    await p.evaluateOnNewDocument(s => { window.WebSocket = class { send() {} close() {} }; for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SAVE);
    await p.goto('http://127.0.0.1:8862/'); await new Promise(r => setTimeout(r, 1500));
    const shot = async n => p.screenshot({ path: path.join(OUT, `${w}x${hh}-${n}.png`) });
    await shot('1-lobby');
    const has = id => p.$('#' + id);
    if (await has('navGarage')) {
      await p.click('#navGarage'); await new Promise(r => setTimeout(r, 300)); await shot('2-garagem');
      await p.evaluate(() => { const l = [...document.querySelectorAll('#pGarage .sw.locked')].find(x => x.offsetParent); if (l) l.click(); }); await new Promise(r => setTimeout(r, 200)); await shot('3-garagem-bloqueado');
      await p.click('#navPlay');
      for (const [btn, n, close] of [['navRank', '4-ranking', 'rankClose'], ['setBtn', '5-config', 'setClose'], ['helpBtn', '6-ajuda', 'helpClose'], ['agenorBtn', '7-agenor', 'agClose'], ['goAch', '8-conquistas', 'achClose']]) {
        await p.click('#' + btn); await new Promise(r => setTimeout(r, 400)); await shot(n); await p.click('#' + close); await new Promise(r => setTimeout(r, 150));
      }
      await p.click('#chatTab'); await new Promise(r => setTimeout(r, 200)); await shot('9-chat-aberto');
    }
    await p.close();
  }
  console.log('erros:', errs.length ? errs : 'nenhum');
  await b.close(); srv.close(); process.exit(0);
})();
