// Teste multiplayer com 3 clientes no Realtime de verdade (sala com código aleatório; não grava nada no banco).
// Uso: node testes/multiplayer.cjs
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
let html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const j = html.lastIndexOf('})();');
html = html.slice(0, j) + `window.__t = { room, remotes, rt, rtCast, enterRoom, leaveRoom, chatOut, myId, begin, get s() { return s; } };\n` + html.slice(j);
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html); }).listen(8818);
let pass = 0, fail = 0;
const ok = (c, n, x) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FALHA ') + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); };
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(p, fn, arg, ms = 15000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await wait(250); } return false; }

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio'] });
  const P = [];
  for (const nome of ['TesteA', 'TesteB', 'TesteC']) {
    const p = await (await b.createBrowserContext()).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.evaluateOnNewDocument(n => { try { localStorage.setItem('grau80-nasc', '1990'); localStorage.setItem('grau80-nome', n); localStorage.setItem('grau80-instrucoes', 'fechado'); } catch (e) {} }, nome);
    await p.goto('http://127.0.0.1:8818/', { waitUntil: 'load' });
    P.push({ p, errs, nome });
  }
  const [A, B, C] = P;
  await until(A.p, () => __t.rt.open);
  const code = 'T' + Math.random().toString(36).slice(2, 5).toUpperCase().replace(/[01OI]/g, 'X');
  await A.p.evaluate(c => __t.enterRoom(c, true), code);
  ok(await until(A.p, () => __t.room.code && !__t.room.phase), 'A cria a sala ' + code);
  await wait(2500);
  for (const X of [B, C]) { await until(X.p, () => __t.rt.open); await X.p.evaluate(c => __t.enterRoom(c, false), code); }
  ok(await until(A.p, () => Object.keys(__t.room.members).length === 3), 'os 3 se veem na sala');
  for (const X of P) console.log('   ', X.nome, JSON.stringify(await X.p.evaluate(() => ({ code: __t.room.code, phase: __t.room.phase, n: Object.keys(__t.room.members).length, msg: document.getElementById('mpMsg').textContent, open: __t.rt.open }))));
  const dcOpen = () => Object.values(__t.room.peers).filter(x => x.dc && x.dc.readyState === 'open').length;
  ok(await until(A.p, () => Object.values(__t.room.peers).filter(x => x.dc && x.dc.readyState === 'open').length === 2, null, 20000), 'conexão direta (WebRTC) aberta de A com B e C', await A.p.evaluate(dcOpen));

  // todos começam a rodada e a posição chega
  for (const X of P) await X.p.evaluate(() => __t.begin('multi'));
  ok(await until(B.p, id => { const r = __t.remotes.get(id); return r && r.tx != null && r.m === 'ride'; }, await A.p.evaluate(() => __t.myId)), 'B recebe a posição de A');

  // chat
  await A.p.evaluate(() => { const i = document.getElementById('roomIn') || document.getElementById('lobbyIn'); });
  const chatSent = await A.p.evaluate(() => __t.rtCast(__t.room.ch, 'chat', { id: __t.myId, nome: 'TesteA', txt: 'oi galera <b>x</b>' }));
  ok(chatSent && await until(B.p, () => /oi galera <b>x<\/b>/.test(document.getElementById('roomLog').textContent)), 'chat da sala chega (como texto)');

  // spoof real: C manda posição pelo Supabase dizendo ser A
  const aId = await A.p.evaluate(() => __t.myId);
  const before = await B.p.evaluate(id => __t.remotes.get(id).tx, aId);
  await C.p.evaluate(id => { for (let i = 0; i < 5; i++) __t.rtCast(__t.room.ch, 'pos', { id, q: 1e9 + i, m: 'ride', x: 99999, v: 0, th: 1 }); }, aId);
  await wait(1500);
  const after = await B.p.evaluate(id => __t.remotes.get(id).tx, aId);
  ok(after < 90000, 'B ignora a posição falsa "em nome de A" vinda de C', { before, after });

  // queda de internet de C: fecha o websocket e a conexão direta, o jogo reconecta sozinho
  await C.p.evaluate(() => { for (const x of Object.values(__t.room.peers)) try { x.pc.close(); } catch (e) {} __t.rt.ws.close(); });
  ok(await until(A.p, () => Object.keys(__t.room.members).length === 2, null, 40000), 'A vê C sair quando a conexão cai');
  ok(await until(A.p, () => Object.keys(__t.room.members).length === 3, null, 30000), 'C volta sozinho quando a conexão volta');

  // B sai
  await B.p.evaluate(() => __t.leaveRoom());
  ok(await until(A.p, () => Object.keys(__t.room.members).length === 2), 'saída de B aparece pra A');

  for (const X of P) ok(!X.errs.length, 'sem erro de página em ' + X.nome, X.errs.slice(0, 3));
  for (const X of P) await X.p.evaluate(() => __t.leaveRoom()).catch(() => {});
  console.log(`\n${pass} ok, ${fail} falha(s)`);
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERRO', e); srv.close(); process.exit(2); });
