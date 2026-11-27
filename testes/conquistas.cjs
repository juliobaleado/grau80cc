// Conquistas do Welcome Update (27/11/2026): antigas preservadas, novas liberando pelo critério certo, sem duplicar,
// em fila, fora do modo teste e da demonstração, top 10 e 1º lugar só pelo placar oficial, apoio só com compra
// confirmada pela Google Play, e o modal Minhas Conquistas (PC e celular). Sem rede: o placar é simulado aqui.
// Uso: node testes/conquistas.cjs [pasta-das-capturas]
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'play-store', 'conquistas');
fs.mkdirSync(OUT, { recursive: true });
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const j = html.lastIndexOf('})();');
html = html.slice(0, j) + 'window.__t={get s(){return s},begin,finish,stats,unlocked,achQ,checkTimeAch,toggleCheat,tutJogo,TUT,room,myId,mpDie,syncOwned};\n' + html.slice(j);
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html); }).listen(8857);
let pass = 0, fail = 0;
const ok = (c, n, x) => { c ? pass++ : fail++; console.log((c ? '  ok    ' : '  FALHA ') + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const BASE = { 'grau80-nasc': '1990', 'grau80-nome': 'Teste', 'grau80-instrucoes': 'fechado', 'grau80-nome-pedido': '1', 'grau80-novidades': 'welcome-1', 'grau80-tutorial': '{"menuTutorialVersion":2,"gameplayTutorialVersion":1}',
  'grau80-ach': JSON.stringify({ grau30: true, grau100: true }), 'grau80-best': '5000.00' };

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio'] });
  async function session(save, { vw = 1280, vh = 720, touch = false, native = false, board = [] } = {}) {
    const p = await (await b.createBrowserContext()).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', q => {
      const u = q.url();
      if (u.startsWith('http://127.0.0.1')) return q.continue();
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
      if (q.method() === 'OPTIONS') return q.respond({ status: 204, headers: cors, body: '' });
      const js = v => q.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(v) });
      if (u.includes('/rpc/grau_iniciar')) return js('11111111-2222-3333-4444-555555555555');
      if (u.includes('/rpc/grau_enviar')) { board.unshift({ nome: 'Teste', metros: 99999 }); return js('ok'); }
      if (u.includes('/rest/v1/placar') && q.method() === 'GET') return js(board);
      q.respond({ status: 404, body: '' });
    });
    await p.setViewport({ width: vw, height: vh, hasTouch: touch, isMobile: touch });
    await p.evaluateOnNewDocument((save, native) => {
      window.WebSocket = class { send() {} close() {} };
      if (native) window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', registerPlugin: () => ({ getProducts: async () => ({ products: [] }),
        getPurchases: async () => ({ purchases: [{ productIdentifier: 'mini_pastel', purchaseState: '1' }] }) }) };
      for (const [k, v] of Object.entries(save)) localStorage.setItem(k, v);
    }, save, native);
    await p.goto('http://127.0.0.1:8857/'); await wait(1300);
    return { p, errs };
  }
  const end = (p, how, extra = 'null') => p.evaluate(async (how, extra) => {
    __t.begin('motoca'); __t.s.active = true; __t.s.wDist = 40; __t.s.maxWT = 4; Object.assign(__t.s, JSON.parse(extra) || {});
    __t.finish(how); await new Promise(r => setTimeout(r, 1000));
    const t = document.getElementById('endTitle').textContent; document.getElementById('goGarage').click(); await new Promise(r => setTimeout(r, 200)); return t;
  }, how, extra);
  const has = (p, id) => p.evaluate(id => !!__t.unlocked[id], id);

  console.log('— jogador antigo: conquistas preservadas');
  const { p, errs } = await session({ ...BASE, 'grau80-stats': JSON.stringify({ quedas: 99, curtas: 9 }) });
  ok(await p.evaluate(() => localStorage.getItem('grau80-ach') === JSON.stringify({ grau30: true, grau100: true })), 'grau80-ach intacto ao abrir');
  await p.click('#goAch'); await wait(300);
  let m = await p.evaluate(() => ({ count: document.getElementById('achCount').textContent, cards: document.querySelectorAll('.achc').length, got: document.querySelectorAll('.achc.got').length,
    tabs: [...document.querySelectorAll('#achTabs button')].map(b => b.textContent), names: [...document.querySelectorAll('.achc.got b')].map(b => b.textContent),
    prog: [...document.querySelectorAll('.achc small')].map(s => s.textContent).filter(t => / de /.test(t)), reward: [...document.querySelectorAll('.areward')].length }));
  ok(m.count === '2/21 · 10%' && m.cards === 21 && m.got === 2, 'modal: 2 de 21 (9 antigas + 12 novas)', m.count);
  ok(m.names.includes('Acima de mim só Deus e a roda da frente') && m.names.includes('Situação Cãoplicada'), 'nomes das antigas sem mudança', m.names);
  ok(m.tabs.length === 7 && m.reward >= 5, 'categorias e recompensas das antigas (bikes/itens) aparecem', m.tabs);
  ok(m.prog.includes('99 de 100') && m.prog.includes('9 de 10'), 'progresso: 99 de 100 quedas, 9 de 10 voltas curtas', m.prog);
  await p.screenshot({ path: path.join(OUT, 'modal-pc.png') });
  await p.keyboard.press('Escape'); await wait(200);
  ok(await p.$eval('#achModal', e => e.hidden), 'Esc fecha o modal');

  console.log('— desbloqueios');
  let t = await end(p, 'flip', '{"maxWT":0.4}');
  const q1 = await p.evaluate(() => ({ az: !!__t.unlocked.w_azeitona, c100: !!__t.unlocked.w_caramelo100, dom: !!__t.unlocked.w_domingo, fila: __t.achQ.length, data: !!JSON.parse(localStorage.getItem('grau80-ach-data') || '{}').w_azeitona }));
  ok(q1.az && q1.c100 && q1.dom, 'uma queda libera Azeitona + Caramelo Profissional (100ª) + Passeio de Domingo (10ª curta)', q1);
  ok(q1.fila >= 2, 'os avisos entram em fila (um de cada vez)', q1.fila);
  ok(q1.data, 'data de liberação guardada');
  ok(t === 'Conquista na conta!', 'título não tira sarro de quem acabou de liberar conquista', t);
  await wait(4500);
  ok(await p.evaluate(() => __t.achQ.length) < q1.fila, 'a fila anda sozinha, sem parar o jogo');
  const n0 = await p.evaluate(() => Object.keys(__t.unlocked).length);
  await end(p, 'flip', '{"maxWT":3}');
  ok(await p.evaluate(n => Object.keys(__t.unlocked).length === n, n0), 'cair de novo não duplica nada');
  // recorde e humildade
  await end(p, 'landed', '{"wDist":6000,"maxWT":20}');
  ok(await p.evaluate(() => __t.stats.posRec === true), 'bateu recorde: marca pra Humildade');
  await end(p, 'flip', '{"maxWT":0.5}');
  ok(await has(p, 'w_humildade'), 'Humildade: recorde e depois queda com menos de 1 s');
  // grau em segundos
  await p.evaluate(() => { __t.begin('motoca'); __t.s.active = true; __t.s.wTime = 61; __t.checkTimeAch(); document.getElementById('goGarage').click(); });
  ok(await has(p, 'w_luxo10') && await has(p, 'w_gravidade60') && !(await has(p, 'w_aposentadoria300')), '10 s e 60 s liberam; 300 s ainda não');
  // Modo Livre não conta queda
  const qL = await p.evaluate(() => __t.stats.quedas);
  await p.evaluate(async () => { __t.begin('livre'); __t.s.active = true; __t.s.wDist = 40; __t.finish('flip'); await new Promise(r => setTimeout(r, 900)); document.getElementById('goGarage').click(); });
  ok(await p.evaluate(q => __t.stats.quedas === q, qL), 'Modo Livre segue sem conquistas (não conta queda)');
  // modo teste e demonstração não liberam
  await p.evaluate(() => { __t.toggleCheat(); __t.begin('motoca'); __t.s.active = true; __t.s.wTime = 400; __t.checkTimeAch(); document.getElementById('goGarage').click(); __t.toggleCheat(); });
  ok(!(await has(p, 'w_aposentadoria300')), 'modo teste não libera conquista');
  await p.evaluate(async () => { __t.tutJogo('motoca', false); await new Promise(r => setTimeout(r, 200)); __t.s.wTime = 400; __t.checkTimeAch(); document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true })); });
  await p.keyboard.press('Escape'); await wait(300);
  ok(!(await has(p, 'w_aposentadoria300')), 'demonstração do tutorial não libera conquista');
  // sala com 7
  const f7 = await p.evaluate(() => { try { for (let i = 0; i < 6; i++) __t.room.members['x' + i] = { nome: 'P' + i, at: i }; __t.room.members[__t.myId] = { nome: 'Eu', at: 9 }; __t.room.code = 'ABCD'; __t.begin('multi', 1); } catch (e) { return 'erro ' + e.message; } return !!__t.unlocked.w_firma7; });
  ok(f7 === true, 'A Firma Tá Forte: rodada com 7 na sala', f7);
  const qm = await p.evaluate(() => { const q = __t.stats.quedas; __t.s.active = true; __t.s.wDist = 10; __t.mpDie(); const r = __t.stats.quedas - q; __t.room.code = ''; __t.room.members = {}; return r; });
  ok(qm === 1, 'queda na sala conta', qm);
  ok(!errs.length, 'sem erro de página', errs);
  await p.close();

  console.log('— placar oficial e compra');
  const s2 = await session({ ...BASE, 'grau80-best': '10.00' }, { board: [] });
  await s2.p.evaluate(async () => { __t.begin('motoca'); __t.s.active = true; __t.s.wDist = 50; __t.s.maxWT = 9; __t.finish('landed'); await new Promise(r => setTimeout(r, 1000)); });
  ok(!(await has(s2.p, 'w_elite')), 'só aparecer pra enviar não libera a Elite');
  await s2.p.$eval('#gName', e => { e.value = 'Teste'; }); await s2.p.click('#gBtn'); await wait(1500);
  ok(await has(s2.p, 'w_elite') && await has(s2.p, 'w_rei'), 'enviou e o placar confirmou: Elite + Dono da Coroa', await s2.p.evaluate(() => [document.getElementById('gMsg').textContent, document.getElementById('gSend').hidden]));
  ok(!s2.errs.length, 'sem erro de página', s2.errs);
  await s2.p.close();
  const s3 = await session(BASE, { native: true });
  await wait(1500);
  ok(await has(s3.p, 'w_apoio'), 'app com compra confirmada pela Google Play: Eu Acredito no Projeto');
  await s3.p.close();
  const s4 = await session({ ...BASE, 'grau80-doa': '["mini_pastel"]' });
  ok(!(await has(s4.p, 'w_apoio')), 'no site, lista de compras guardada não libera nada');
  await s4.p.close();

  console.log('— celular');
  for (const [w, hh] of [[740, 360], [390, 844]]) {
    const c = await session({ ...BASE, 'grau80-ach': JSON.stringify({ grau30: true, w_azeitona: true, w_luxo10: true }), 'grau80-stats': '{"quedas":127}' }, { vw: w, vh: hh, touch: true });
    await c.p.evaluate(() => document.getElementById('goAch').click()); await wait(300);
    const r = await c.p.evaluate(() => { const card = document.querySelector('.achcard').getBoundingClientRect(), x = document.getElementById('achClose').getBoundingClientRect();
      const g = document.getElementById('achGrid'); return { cabe: card.top >= 0 && card.bottom <= innerHeight + 1 && card.right <= innerWidth + 1, fechar: x.top >= 0 && x.right <= innerWidth, rola: g.scrollHeight > g.clientHeight,
        vip: [...document.querySelectorAll('.achc small')].map(s => s.textContent).includes('127 de 500') }; });
    ok(r.cabe && r.fechar && r.rola && r.vip, `${w}x${hh}: modal cabe, botão de fechar à vista, lista rola, "127 de 500"`, r);
    await c.p.screenshot({ path: path.join(OUT, `modal-${w}x${hh}.png`) });
    await c.p.close();
  }
  console.log(`\n${pass} ok, ${fail} falha(s)   capturas em ${OUT}`);
  await b.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
