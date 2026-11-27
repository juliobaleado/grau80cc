// Lobby (UI/UX Evolution V1): jogar sem rolar em toda a matriz de telas, garagem (categorias, equipar, bloqueado mostra
// requisito), configurações (apelido, efeitos, idioma, controles), ajuda, Pastel do Agenor, ranking, chat recolhível,
// Esc/foco e sem rolagem horizontal. Sem rede (placar simulado). Uso: node testes/lobby.cjs
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const j = html.lastIndexOf('})();');
html = html.slice(0, j) + 'window.__t={get pick(){return pick},input,get myName(){return myName},get muted(){return muted},set unread(v){chatUnread=v;renderChatTab()},get KID(){return KID},get cam(){return LOBBY_CAM}};\n' + html.slice(j);
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
  for (const [w, hh, touch] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [1024, 768], [768, 1024], [844, 390, true], [667, 375, true], [390, 844], [360, 800], [568, 320, true], [640, 360, true], [740, 360, true], [500, 700], [760, 600]]) {
    const { p, errs } = await session(SAVE, { vw: w, vh: hh, touch });
    const r = await p.evaluate(() => {
      const vis = id => { const e = document.getElementById(id), k = e.getBoundingClientRect(); return k.width > 0 && k.top >= 0 && k.bottom <= innerHeight + 1 && k.left >= 0 && k.right <= innerWidth + 1; };
      return { motoca: vis('goStart'), livre: vis('goFree'), multi: vis('goMulti'), nav: vis('lNav'), horiz: document.documentElement.scrollWidth <= innerWidth + 1, rec: /412.3/.test(document.getElementById('pbLine').textContent) };
    });
    const fr = await p.evaluate(() => { const c = __t.cam, k = document.querySelector('.lcard').getBoundingClientRect(); const bb = c && c.S ? { l: c.bx - 1.0 * c.S, r: c.bx + 1.6 * c.S, t: c.yc - 3.4 * c.S, b: c.yc + 0.1 * c.S } : null; const bd = document.querySelector('.leftcol .board').getBoundingClientRect(); const fora = q => !q.width || bb.r <= q.left + 1 || bb.l >= q.right - 1 || bb.b <= q.top + 1 || bb.t >= q.bottom - 1; return !!bb && bb.l >= 0 && bb.t >= 0 && (bb.r <= k.left + 1 || bb.b <= k.top + 1) && fora(bd); });
    ok(fr, `${w}x${hh}: o painel e o placar não cobrem o motoqueiro`);
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
  const m0 = await p.evaluate(() => [__t.muted, localStorage.getItem('grau80-musica')]); await p.click('#setSound'); await wait(100);
  ok(await p.evaluate(m => __t.muted === m[0] && localStorage.getItem('grau80-musica') === m[1] && localStorage.getItem('grau80-efeitos') === '0' && /off/.test(document.getElementById('setSound').textContent), m0), 'Efeitos desliga só os efeitos (música e Som geral intactos)');
  await p.click('#setSound'); await wait(100); ok(await p.evaluate(() => localStorage.getItem('grau80-efeitos') === '1'), 'Efeitos liga de novo');
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
  console.log('— V1.1: telas baixas (chat, garagem, enquadramento, modais, teclado)');
  for (const [w, hh] of [[667, 375], [844, 390], [1024, 768], [1366, 768]]) {
    const touch = hh < 500;
    const { p, errs } = await session({ ...SAVE, 'grau80-chat': '1' }, { vw: w, vh: hh, touch });
    const inter = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
    const g = await p.evaluate(() => { const R = e => e.getBoundingClientRect().toJSON(); return { chat: R(document.getElementById('lobby')), card: R(document.querySelector('.lcard')), inp: R(document.getElementById('lobbyIn')) }; });
    ok(!inter(g.chat, g.card) && g.inp.bottom <= hh + 1 && g.inp.top >= 0, `${w}x${hh}: chat aberto não cobre o lobby e o campo fica à vista`, { chat: [Math.round(g.chat.left), Math.round(g.chat.right)], card: Math.round(g.card.left) });
    await p.screenshot({ path: path.join(ROOT, 'play-store', 'lobby', 'depois', `v11-${w}x${hh}-chat.png`) });
    if (touch) {
      await p.click('#lobbyIn'); await p.setViewport({ width: w, height: Math.round(hh * 0.55), hasTouch: true, isMobile: true }); await wait(250);
      const k = await p.evaluate(() => { const r = document.getElementById('lobbyIn').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; });
      ok(k, `${w}x${hh}: com o teclado aberto o campo do chat continua à vista`);
      await p.setViewport({ width: w, height: hh, hasTouch: true, isMobile: true }); await wait(250);
    }
    await p.click('#chatTab'); await p.click('#navGarage'); await wait(500);
    const gg = await p.evaluate(() => {
      const gar = document.getElementById('garage'); gar.scrollTop = gar.scrollHeight; const R = e => e.getBoundingClientRect();
      const items = [...gar.querySelectorAll('.grow:not([hidden]) .sw')]; const last = items[items.length - 1]; const foot = R(document.querySelector('.gfoot')), gr = R(gar);
      const c = __t.cam, k = document.querySelector('.lcard').getBoundingClientRect(); const bb = c && c.S ? { l: c.bx - 1.0 * c.S, r: c.bx + 1.6 * c.S, t: c.yc - 3.4 * c.S, b: c.yc + 0.1 * c.S } : null;
      const livre = !!bb && bb.l >= 0 && bb.t >= 0 && (bb.r <= k.left || bb.b <= k.top);
      return { livre, bb: bb && Object.fromEntries(Object.entries(bb).map(([a, v]) => [a, Math.round(v)])), card: [Math.round(k.left), Math.round(k.top)], lastOk: R(last).bottom <= gr.bottom + 1 && R(last).bottom <= foot.top + 1, footOk: foot.bottom <= innerHeight + 1, qp: getComputedStyle(document.getElementById('quickPlay')).display };
    });
    ok(gg.lastOk && gg.footOk && gg.qp === 'none', `${w}x${hh}: garagem com rodapé Jogar reservado, último item alcançável, sem botão flutuante por cima`, gg);
    ok(gg.livre, `${w}x${hh}: piloto e moto inteiros fora do painel durante a garagem`, gg.bb);
    await p.screenshot({ path: path.join(ROOT, 'play-store', 'lobby', 'depois', `v11-${w}x${hh}-garagem.png`) });
    await p.click('#navPlay');
    for (const [btn, modal] of [['navRank', 'rankModal'], ['goAch', 'achModal'], ['helpBtn', 'helpModal'], ['setBtn', 'setModal'], ['goMulti', 'mpModal'], ['agenorBtn', 'agModal']]) {
      await p.click('#' + btn); await wait(350);
      const r = await p.evaluate(m => {
        const c = document.querySelector('#' + m + ' .pixm-card'), x = document.querySelector('#' + m + ' .pixm-x'); c.scrollTop = c.scrollHeight; c.querySelectorAll('*').forEach(e => { if (e.scrollHeight > e.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(e).overflowY)) e.scrollTop = e.scrollHeight; });
        const kids = [...c.querySelectorAll('*')].filter(e => e.offsetParent && !e.closest('.pixm-x') && e.children.length === 0); const last = kids[kids.length - 1];
        const cr = c.getBoundingClientRect(), lr = last.getBoundingClientRect(), xr = x.getBoundingClientRect();
        return { cabe: cr.top >= 0 && cr.bottom <= innerHeight + 1, fechar: xr.top >= cr.top - 1 && xr.bottom <= innerHeight && xr.right <= innerWidth, ultimo: lr.bottom <= cr.bottom + 1, horiz: c.scrollWidth <= c.clientWidth + 1 };
      }, modal);
      ok(r.cabe && r.fechar && r.ultimo && r.horiz, `${w}x${hh}: ${modal} cabe, fechar sempre à vista, último item alcançável, sem rolagem lateral`, r);
      await p.screenshot({ path: path.join(ROOT, 'play-store', 'lobby', 'depois', `v11-${w}x${hh}-${modal}.png`) });
      await p.keyboard.press('Escape'); await wait(150);
    }
    // Pix centralizado; conquistas com lista ampla (botões de compartilhar pequenos no cabeçalho)
    await p.evaluate(() => document.getElementById('agenorBtn').click()); await wait(250);
    await p.evaluate(() => document.getElementById('agPix').click()); await wait(300);
    const px = await p.evaluate(() => { const c = document.querySelector('#pixModal .pixm-card').getBoundingClientRect(), mid = c.left + c.width / 2;
      return ['pixTitle', 'pixCopy'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - mid) < 6; })
        .concat([document.querySelector('#pixModal .pixm-qr')].map(e => { const r = e.getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - mid) < 6; })); });
    ok(px.every(Boolean), `${w}x${hh}: Me paga um pastel com título, QR e botão centralizados`, px);
    await p.screenshot({ path: path.join(ROOT, 'play-store', 'lobby', 'depois', `v11-${w}x${hh}-pix.png`) });
    await p.keyboard.press('Escape'); await wait(150);
    await p.evaluate(() => document.getElementById('goAch').click()); await wait(300);
    const ag = await p.evaluate(() => { const g = document.getElementById('achGrid'), b = document.getElementById('achShareAll').getBoundingClientRect(), hd = document.querySelector('.achhead').getBoundingClientRect();
      return { lista: Math.round(g.clientHeight / innerHeight * 100), noCabecalho: b.top >= hd.top - 2 && b.bottom <= hd.bottom + 2, botaoPequeno: b.height <= 36 }; });
    ok(ag.lista >= (hh < 500 ? 40 : 45) && ag.noCabecalho && ag.botaoPequeno, `${w}x${hh}: conquistas com lista ampla e compartilhar pequeno no cabeçalho`, ag);
    await p.keyboard.press('Escape'); await wait(150);
    await p.evaluate(() => document.getElementById('goCtl').click()); await wait(300);
    const cr = await p.evaluate(() => { const c = document.querySelector('#ctlModal .pixm-card'); c.scrollTop = c.scrollHeight; const R = c.getBoundingClientRect(), a = document.getElementById('ctlOk').getBoundingClientRect();
      return { cabe: R.top >= 0 && R.bottom <= innerHeight + 1, pronto: a.bottom <= R.bottom + 1 && a.bottom <= innerHeight }; });
    ok(cr.cabe && cr.pronto, `${w}x${hh}: Controles cabe e o Pronto é alcançável`, cr);
    await p.screenshot({ path: path.join(ROOT, 'play-store', 'lobby', 'depois', `v11-${w}x${hh}-ctlModal.png`) });
    await p.keyboard.press('Escape');
    if (errs.length) ok(false, 'erro de página', errs);
    await p.close();
  }
  console.log(`\n${pass} ok, ${fail} falha(s)`);
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
