// Lobby (UI/UX Evolution V1): jogar sem rolar em toda a matriz de telas, garagem (categorias, equipar, bloqueado mostra
// requisito), configurações (apelido, efeitos, idioma, controles), ajuda, Pastel do Agenor, ranking, chat recolhível,
// Esc/foco e sem rolagem horizontal. Sem rede (placar simulado). Uso: node testes/lobby.cjs
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const j = html.lastIndexOf('})();');
html = html.slice(0, j) + 'window.__t={get pick(){return pick},input,get myName(){return myName},get muted(){return muted},set unread(v){chatUnread=v;renderChatTab()},get KID(){return KID}};\n' + html.slice(j);
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u.startsWith('/img/') && fs.existsSync(path.join(ROOT, u))) { r.writeHead(200, { 'content-type': 'image/webp' }); return r.end(fs.readFileSync(path.join(ROOT, u))); }
  r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html);
}).listen(8863);
let pass = 0, fail = 0;
const ok = (c, n, x) => { c ? pass++ : fail++; console.log((c ? '  ok    ' : '  FALHA ') + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const SAVE = { 'grau80-nasc': '1990', 'grau80-nome': 'Veterano', 'grau80-nome-pedido': '1', 'grau80-novidades': 'welcome-1', 'grau80-instrucoes': 'fechado',
  'grau80-tutorial': '{"menuTutorialVersion":2,"gameplayTutorialVersion":1}', 'grau80-best': '412.30', 'grau80-ach': '{"grau30":true}', 'grau80-look': '{"model":"caicara"}' };
const BOARD = [{ nome: 'ReiDoGrau', metros: 2310.4 }, { nome: 'Zezinho', metros: 1880.2 }, { nome: 'Veterano', metros: 412.3 }];
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio'] });
  async function session(save, { vw = 1280, vh = 720, touch = false } = {}) {
    const p = await (await b.createBrowserContext()).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', q => { const u = q.url(); if (u.startsWith('http://127.0.0.1')) return q.continue();
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
      if (q.method() === 'OPTIONS') return q.respond({ status: 204, headers: cors, body: '' });
      if (u.includes('/rest/v1/placar')) return q.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(BOARD) });
      q.respond({ status: 404, body: '' }); });
    await p.setViewport({ width: vw, height: vh, hasTouch: touch, isMobile: touch });
    await p.evaluateOnNewDocument(s => { window.WebSocket = class { send() {} close() {} }; for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, save);
    await p.goto('http://127.0.0.1:8863/'); await wait(1300);
    return { p, errs };
  }
  console.log('— jogar sem rolar, em toda a matriz');
  for (const [w, hh, touch] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [1024, 768], [768, 1024], [844, 390, true], [667, 375, true], [390, 844], [360, 800]]) {
    const { p, errs } = await session(SAVE, { vw: w, vh: hh, touch });
    const r = await p.evaluate(() => {
      const vis = id => { const e = document.getElementById(id), k = e.getBoundingClientRect(); return k.width > 0 && k.top >= 0 && k.bottom <= innerHeight + 1 && k.left >= 0 && k.right <= innerWidth + 1; };
      return { motoca: vis('goStart'), livre: vis('goFree'), multi: vis('goMulti'), nav: vis('lNav'), horiz: document.documentElement.scrollWidth <= innerWidth + 1, rec: /412.3/.test(document.getElementById('pbLine').textContent) };
    });
    ok(r.motoca && r.livre && r.multi && r.nav && r.horiz && r.rec, `${w}x${hh}: modos, abas e recorde à vista sem rolar; sem rolagem horizontal`, r);
    if (errs.length) ok(false, 'erro de página', errs);
    await p.close();
  }
  console.log('— garagem');
  let { p, errs } = await session(SAVE);
  await p.click('#navGarage'); await wait(200);
  const rows = () => p.evaluate(() => [...document.querySelectorAll('#garage .grow')].filter(r => !r.hidden).map(r => r.id));
  ok(JSON.stringify(await rows()) === '["grow-model","grow-frame"]', 'categoria Motoca: modelo e cor', await rows());
  await p.evaluate(() => [...document.querySelectorAll('#gCats button')].find(x => x.textContent === 'Caramelo').click()); await wait(100);
  ok(JSON.stringify(await rows()) === '["grow-dog"]', 'categoria Caramelo');
  await p.evaluate(() => [...document.querySelectorAll('#gCats button')].find(x => x.textContent === 'Motoca').click()); await wait(100);
  await p.click('#look-model-monark'); await wait(150);
  ok(await p.evaluate(() => __t.pick.model === 'monark' && JSON.parse(localStorage.getItem('grau80-look')).model === 'monark'), 'equipar a Circuleira salva e troca a bike na hora');
  await p.click('#look-model-xr'); await wait(150);
  const lk = await p.evaluate(() => ({ model: __t.pick.model, req: document.querySelector('#grow-model .greq').textContent, vis: !document.querySelector('#grow-model .greq').hidden }));
  ok(lk.model === 'monark' && lk.vis && /conquista/.test(lk.req), 'bloqueado: não equipa e mostra como libera', lk.req);
  await p.evaluate(() => document.querySelector('#grow-model .greq button').click()); await wait(200);
  ok(await p.$eval('#achModal', e => !e.hidden), '"Ver conquistas" abre a coleção');
  await p.keyboard.press('Escape'); await wait(100);
  console.log('— configurações');
  await p.click('#setBtn'); await wait(200);
  ok(await p.evaluate(() => document.activeElement.id === 'setClose'), 'foco vai pro modal');
  await p.$eval('#setNick', e => { e.value = 'porra'; }); await p.click('#setNickForm .go'); await wait(100);
  ok(/não pode/.test(await p.$eval('#setNickMsg', e => e.textContent)) && await p.evaluate(() => __t.myName === 'Veterano'), 'apelido proibido barrado');
  await p.$eval('#setNick', e => { e.value = 'Novo Nome'; }); await p.click('#setNickForm .go'); await wait(100);
  ok(await p.evaluate(() => __t.myName === 'Novo Nome' && localStorage.getItem('grau80-nome') === 'Novo Nome' && document.getElementById('lNick').textContent === 'Novo Nome'), 'apelido salvo (mesmo nome do placar) e perfil atualizado');
  const m0 = await p.evaluate(() => __t.muted); await p.click('#setSound'); await wait(100);
  ok(await p.evaluate(m => __t.muted === !m && localStorage.getItem('grau80-mute') === (m ? '0' : '1'), m0), 'Efeitos liga/desliga o som (mesma preferência do botão Som)');
  await p.evaluate(() => [...document.querySelectorAll('#langs button')].find(x => /EN/.test(x.textContent)).click()); await wait(200);
  ok(await p.$eval('#navPlay', e => e.textContent) === 'Play' && await p.$eval('#setTitle', e => e.textContent) === 'Settings', 'idioma troca a interface toda');
  await p.evaluate(() => [...document.querySelectorAll('#langs button')].find(x => /PT/.test(x.textContent)).click()); await wait(100);
  await p.click('#goCtl'); await wait(200);
  ok(await p.$eval('#setModal', e => e.hidden) && await p.$eval('#ctlModal', e => !e.hidden), 'Controles abre o painel de controles');
  await p.keyboard.press('Escape'); await wait(100);
  console.log('— ajuda, pastel e ranking');
  await p.click('#helpBtn'); await wait(200);
  ok(await p.$eval('#howList', e => !e.hidden) && await p.$eval('#tutRow', e => e.offsetParent !== null), 'ajuda com instruções completas e tutoriais');
  await p.evaluate(() => document.getElementById('fbBtn').click()); await wait(200);
  ok(await p.$eval('#helpModal', e => e.hidden) && await p.$eval('#fbModal', e => !e.hidden), 'feedback a partir da ajuda');
  await p.keyboard.press('Escape'); await wait(100);
  await p.click('#navPlay'); await wait(100);
  await p.click('#agenorBtn'); await wait(200);
  await p.click('#agPix'); await wait(200);
  ok(await p.$eval('#pixModal', e => !e.hidden), 'Me paga um pastel abre o apoio de sempre (Pix no site)');
  await p.keyboard.press('Escape'); await wait(100);
  await p.click('#navPlay'); await p.click('#agenorBtn'); await wait(200); await p.click('#agDogs'); await wait(200);
  ok(JSON.stringify(await rows()) === '["grow-dog"]' && await p.$eval('#pGarage', e => !e.hidden), 'Caramelos especiais leva pra garagem dos caramelos');
  await p.click('#navPlay'); await p.click('#navRank'); await wait(500);
  const rk = await p.evaluate(() => ({ king: document.getElementById('rankKing').textContent, me: document.querySelector('#rankList li.me') && document.querySelector('#rankList li.me').textContent }));
  ok(/Rei do Grau/.test(rk.king) && /ReiDoGrau/.test(rk.king) && /2310.4 m/.test(rk.king), 'ranking: 1º em destaque como Rei do Grau, em metros', rk.king);
  await p.keyboard.press('Escape'); await wait(150);
  ok(await p.evaluate(() => document.activeElement.id === 'navRank'), 'fechar devolve o foco pro botão que abriu');
  console.log('— chat');
  ok(await p.$eval('#lobby', e => e.classList.contains('closed')) && await p.$eval('#lobbyLog', e => e.offsetParent === null), 'chat começa recolhido');
  await p.evaluate(() => { __t.unread = 3; }); await wait(50);
  ok(await p.$eval('#chatUnread', e => !e.hidden && e.textContent === '3'), 'mostra mensagens não lidas');
  await p.click('#chatTab'); await wait(150);
  ok(await p.evaluate(() => localStorage.getItem('grau80-chat') === '1' && document.getElementById('chatUnread').hidden && document.getElementById('lobbyIn').offsetParent !== null), 'abre, zera não lidas e guarda a preferência');
  await p.click('#lobbyIn'); await p.keyboard.type('bora ', { delay: 10 }); await p.keyboard.down('Space'); await wait(150);
  ok(await p.evaluate(() => !__t.input.gas), 'digitar no chat não acelera a moto');
  await p.keyboard.up('Space');
  ok(!errs.length, 'sem erro de página', errs);
  await p.close();
  ({ p } = await session({ ...SAVE, 'grau80-chat': '1' }));
  ok(await p.$eval('#lobby', e => !e.classList.contains('closed')), 'reabriu o jogo: chat continua aberto');
  await p.close();
  ({ p } = await session({ ...SAVE, 'grau80-nasc': String(new Date().getFullYear() - 9) }));
  await p.click('#agenorBtn'); await wait(200);
  ok(await p.evaluate(() => __t.KID && getComputedStyle(document.getElementById('agPix')).display === 'none' && getComputedStyle(document.getElementById('lobby')).display === 'none'), 'menor de 13: sem pagamento no Pastel e sem chat');
  await p.close();
  console.log(`\n${pass} ok, ${fail} falha(s)`);
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
