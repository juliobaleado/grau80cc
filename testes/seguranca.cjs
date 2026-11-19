// Testes de segurança do Grau 80cc (rodam no Chrome via puppeteer, sem tocar no Supabase de verdade:
// REST é simulado por interceptação e o WebSocket do Realtime é trocado por um falso).
// Uso: node testes/seguranca.cjs   (PUPPETEER=caminho/do/puppeteer opcional)
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
let html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const j = html.lastIndexOf('})();');
html = html.slice(0, j) + `window.__t = { NOME_RUIM, maskBad, chatIn, onPos, room, remotes, owned, begin, finish, get s() { return s; }, set s(v) { s = v; }, get runTok() { return runTok; }, get rpcOff() { return rpcOff; }, myId };\n` + html.slice(j);
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html); }).listen(8817);

let pass = 0, fail = 0;
const ok = (cond, name, extra) => { cond ? pass++ : fail++; console.log((cond ? '  ok   ' : '  FALHA ') + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); };

async function page(b, mock) {
  const p = await (await b.createBrowserContext()).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const calls = [];
  await p.setRequestInterception(true);
  p.on('request', q => {
    const u = q.url();
    if (!u.includes('supabase.co')) return q.continue();
    if (q.method() === 'OPTIONS') return q.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE' } });
    calls.push({ url: u.replace(/^.*\/rest\/v1/, ''), method: q.method(), body: q.postData() || '' });
    const res = mock(u, q.method(), q.postData() || '');
    q.respond({ status: res[0], contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(res[1]) });
  });
  await p.evaluateOnNewDocument(() => {
    try { localStorage.setItem('grau80-nasc', '1990'); localStorage.setItem('grau80-instrucoes', 'fechado'); localStorage.setItem('grau80-doa', '["pastel_vento","mini_pastel"]'); } catch (e) {}
    window.WebSocket = class { constructor() { this.readyState = 0; } send() {} close() {} };
  });
  await p.goto('http://127.0.0.1:8817/', { waitUntil: 'load' });
  return { p, errs, calls };
}
const BOARD = [{ nome: 'Deco no pc', metros: 3163 }, { nome: 'daum', metros: 1858 }];

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio'] });

  console.log('\n1. Nomes e palavrões');
  {
    const { p, errs } = await page(b, u => [200, u.includes('placar?select') ? BOARD : []]);
    const bad = ['caralho', 'C4R4LH0', 'filho da puta', 'puta', 'Admin', 'Moderador', 'Suporte Grau', 'grau80cc oficial', 'p.o.r.r.a', 'b u c e t a', 'Hitler'];
    const good = ['Deco no pc', 'daum', 'Baleado', 'JulioBaleado', 'Rei do Grau', 'computador', 'Viaduto', 'Paulo', 'Cuca', 'Rafa', 'Motoca123', 'Pauzinho', 'Escuta', 'Rolando'];
    const r = await p.evaluate((bad, good) => ({ bad: bad.filter(x => !__t.NOME_RUIM(x)), good: good.filter(x => __t.NOME_RUIM(x)),
      mask: __t.maskBad('vai tomar no cu seu porra, bora no grau'), keep: __t.maskBad('computador escuta o pastel') }), bad, good);
    ok(!r.bad.length, 'nomes ofensivos/falsa moderação barrados', r.bad);
    ok(!r.good.length, 'nomes normais passam (sem falso positivo)', r.good);
    ok(!/\bcu\b|porra/.test(r.mask) && r.mask.includes('bora no grau'), 'palavrão mascarado no chat', r.mask);
    ok(r.keep === 'computador escuta o pastel', 'frase normal intacta', r.keep);
    ok(!errs.length, 'sem erro de página', errs);
  }

  console.log('\n2. Chat: XSS e flood');
  {
    const { p, errs } = await page(b, u => [200, u.includes('placar?select') ? BOARD : []]);
    const r = await p.evaluate(() => {
      const box = document.getElementById('lobbyLog'); box.textContent = '';
      window.__xss = 0;
      __t.chatIn(box, { id: 'a1', nome: '<img src=x onerror="__xss=1">', txt: '<script>__xss=1</script><img src=x onerror="__xss=1">' });
      __t.chatIn(box, { id: 'a2', nome: 'Zé', txt: 'oi\u202Eetirw\u200B' });
      const nXss = box.querySelectorAll('img,script').length;
      box.textContent = '';
      for (let i = 0; i < 40; i++) __t.chatIn(box, { id: 'r' + i, nome: 'Spam' + i, txt: 'flood numero ' + i });
      const flood = box.children.length;
      const box2 = document.getElementById('roomLog'); box2.textContent = '';
      for (let i = 0; i < 5; i++) __t.chatIn(box2, { id: 'x' + i, nome: 'Rep' + i, txt: 'COMPRE AGORA' });
      return { nXss, flood, rep: box2.children.length, ctl: !/[\u202E\u200B]/.test(document.body.innerText) };
    });
    await new Promise(r => setTimeout(r, 300));
    const x = await p.evaluate(() => window.__xss);
    ok(r.nXss === 0 && x === 0, 'HTML do chat vira texto, nada executa', r.nXss);
    ok(r.ctl, 'caracteres invisíveis/bidi removidos');
    ok(r.flood <= 14, 'flood com id trocando a cada mensagem é cortado (≤14 em 8 s)', r.flood);
    ok(r.rep === 1, 'mesma frase repetida aparece uma vez', r.rep);
    ok(!errs.length, 'sem erro de página', errs);
  }

  console.log('\n3. Multiplayer: spoof de posição');
  {
    const { p, errs } = await page(b, u => [200, u.includes('placar?select') ? BOARD : []]);
    const r = await p.evaluate(() => {
      const t = __t; t.room.code = 'TEST'; t.room.phase = '';
      t.room.members.v1 = { nome: 'Vitima', at: 1, look: {} };
      t.room.peers.v1 = { dc: { readyState: 'open' }, pc: {} };
      t.onPos({ id: 'v1', q: 1, m: 'ride', x: 50, v: 10, th: 1 }, null); // pelo Supabase, com DC aberto: ignora
      const viaRt = t.remotes.has('v1') && t.remotes.get('v1').tx != null;
      t.onPos({ id: 'v1', q: 2, m: 'ride', x: 60, v: 10, th: 1 }, 'v1'); // pela conexão direta: aceita
      const viaDc = t.remotes.get('v1') && t.remotes.get('v1').tx;
      t.onPos({ id: 'naoesta', q: 1, m: 'ride', x: 1 }, null); // quem não está na sala: ignora
      t.onPos({ id: 'v1', q: 3, m: 'ride', x: 1e12, v: 1e9, th: 99 }, 'v1'); // valores absurdos: limitados
      const rr = t.remotes.get('v1');
      delete t.room.peers.v1; t.room.members = {}; t.room.code = '';
      return { viaRt, viaDc, intruso: t.remotes.has('naoesta'), clamp: [rr.tx, rr.tv, rr.tth] };
    });
    ok(!r.viaRt, 'posição "em nome de outro" pelo Supabase é ignorada quando há conexão direta');
    ok(r.viaDc === 60, 'posição pela conexão direta é aceita', r.viaDc);
    ok(!r.intruso, 'id fora da sala é ignorado');
    ok(r.clamp[0] <= 1e6 && r.clamp[1] <= 40 && r.clamp[2] <= 2, 'valores absurdos são limitados', r.clamp);
    ok(!errs.length, 'sem erro de página', errs);
  }

  console.log('\n4. Cosméticos pagos no site');
  {
    const { p } = await page(b, u => [200, u.includes('placar?select') ? BOARD : []]);
    const r = await p.evaluate(() => [...__t.owned]);
    ok(r.length === 0, 'localStorage editado não libera caramelo pago no site', r);
  }

  console.log('\n5. Placar: envio com bilhete');
  for (const caso of [
    { nome: 'banco sem as funções novas (404) → envio direto antigo', rpc: 404, expect: 'direto' },
    { nome: 'banco com as funções → grau_iniciar + grau_enviar', rpc: 'ok', expect: 'rpc' },
    { nome: 'nome já usado por outro aparelho → mensagem e não marca enviado', rpc: 'nome_em_uso', expect: 'recusa' }
  ]) {
    const { p, errs, calls } = await page(b, (u, m, body) => {
      if (u.includes('placar?select')) return [200, BOARD.slice(0, 1)];
      if (u.includes('/rpc/grau_iniciar')) return caso.rpc === 404 ? [404, { code: 'PGRST202' }] : [200, '11111111-2222-3333-4444-555555555555'];
      if (u.includes('/rpc/grau_enviar')) return [200, caso.rpc === 'ok' ? 'ok' : caso.rpc];
      if (u.endsWith('/placar') && m === 'POST') return [201, {}];
      return [200, []];
    });
    await p.evaluate(() => __t.begin('motoca'));
    await new Promise(r => setTimeout(r, 400));
    await p.evaluate(() => { const s = __t.s; s.runBest = 812.4; s.runTime = 41.2; s.wDist = 0; __t.finish('landed'); });
    await new Promise(r => setTimeout(r, 1200));
    const vis = await p.evaluate(() => !document.getElementById('gSend').hidden);
    await p.evaluate(() => { document.getElementById('gName').value = 'Testador'; document.getElementById('gSend').requestSubmit(); });
    await new Promise(r => setTimeout(r, 800));
    const msg = await p.evaluate(() => document.getElementById('gMsg').textContent);
    const direto = calls.find(c => c.url === '/placar' && c.method === 'POST');
    const env = calls.find(c => c.url.includes('grau_enviar'));
    if (caso.expect === 'direto') ok(vis && direto && !env && /placar global/.test(msg), caso.nome, msg);
    if (caso.expect === 'rpc') {
      const bd = env ? JSON.parse(env.body) : {};
      ok(vis && !direto && bd.p_token && bd.p_metros === 812.4 && bd.p_segundos === 41.2 && /^[a-f0-9]{32}$/.test(bd.p_dono) && /placar global/.test(msg), caso.nome, msg);
    }
    if (caso.expect === 'recusa') ok(/outro jogador/.test(msg) && !direto, caso.nome, msg);
    ok(!errs.length, '   sem erro de página', errs);
  }

  console.log('\n6. Modo teste e livre não pedem bilhete');
  {
    const { p, calls } = await page(b, u => [200, u.includes('placar?select') ? BOARD : '11111111-2222-3333-4444-555555555555']);
    await p.evaluate(() => __t.begin('livre'));
    await p.keyboard.type('agenor');
    await p.evaluate(() => __t.begin('motoca'));
    await new Promise(r => setTimeout(r, 300));
    ok(!calls.some(c => c.url.includes('grau_iniciar')), 'nenhum bilhete no Livre nem no modo teste');
  }

  console.log(`\n${pass} ok, ${fail} falha(s)`);
  await b.close(); srv.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERRO', e); srv.close(); process.exit(2); });
