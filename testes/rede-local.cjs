// Simulador LOCAL do Supabase Realtime (protocolo Phoenix: join, presença, broadcast, heartbeat), sem gastar a franquia.
// Conta as mensagens como o Supabase cobra (broadcast = 1 enviado + 1 por cliente que recebe; presença por entrega),
// mede o pico por segundo (limite do plano grátis: 100/s no projeto) e a suavidade: diferença entre onde o parceiro
// está de verdade e onde ele aparece na tela de quem recebe.
// Uso: VERSAO=atual|<commit> N=4 SEM_DIRETA=4 WIN=20 node testes/rede-local.cjs
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const { WebSocketServer } = require(process.env.WS || 'C:/web/figma-site/node_modules/ws');
const fs = require('fs'), http = require('http'), path = require('path'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const VERSAO = process.env.VERSAO || 'atual', N = +(process.env.N || 4), NODC = +(process.env.SEM_DIRETA ?? N), WIN = +(process.env.WIN || 20);
const MENU = +(process.env.MENU || 0); // quantos ficam parados no menu da sala em vez de correr
let html = VERSAO === 'atual' ? fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8') : execSync(`git show ${VERSAO}:index.html`, { cwd: ROOT, maxBuffer: 64e6 }).toString();
const rep = (a, b) => { if (html.split(a).length !== 2) throw new Error('gancho: ' + a.slice(0, 50)); html = html.replace(a, b); };
const RTL = html.match(/const RT_URL = [^\n]*/)[0];
rep(RTL, "const RT_URL = 'ws://127.0.0.1:8841/socket';");
rep("if (!cheat && room.code) { flash", "if (false) { flash");
rep('if (cheat) { s.th += (balNow() - s.th) * Math.min(1, h * 4);', 'if (cheat) { s.th += (balNow() - 0.16 + Math.sin(performance.now() / 760) * 0.2 + Math.sin(performance.now() / 310) * 0.05 - s.th) * Math.min(1, h * 4);');
const j = html.lastIndexOf('})();');
html = html.slice(0, j) + 'window.__t = { room, remotes, rt, enterRoom, leaveRoom, begin, myId, get s() { return s; } };\n' + html.slice(j);

// ---------------- servidor Realtime falso ----------------
const topics = new Map(); // topic -> Map(ws -> {key, meta, ref, self})
const bill = { bc: 0, pres: 0, perSec: new Map() };
const billAdd = (k, n) => { bill[k] += n; const s = Math.floor(Date.now() / 1000); bill.perSec.set(s, (bill.perSec.get(s) || 0) + n); };
let pref = 0;
const send = (ws, o) => { try { ws.send(JSON.stringify(o)); } catch (e) {} };
const presOf = m => ({ [m.key]: { metas: [{ ...(m.meta || {}), phx_ref: m.ref }] } });
const wss = new WebSocketServer({ port: 8841 });
wss.on('connection', ws => {
  ws.on('message', d => {
    let m; try { m = JSON.parse(d); } catch (e) { return; }
    const T = topics.get(m.topic);
    if (m.event === 'heartbeat') return send(ws, { topic: 'phoenix', event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: m.ref });
    if (m.event === 'phx_join') {
      const t = T || new Map(); topics.set(m.topic, t);
      const cfg = (m.payload && m.payload.config) || {};
      t.set(ws, { key: (cfg.presence && cfg.presence.key) || 'k' + (++pref), meta: null, ref: 'r' + (++pref), self: !!(cfg.broadcast && cfg.broadcast.self) });
      send(ws, { topic: m.topic, event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: m.ref, join_ref: m.join_ref });
      const st = {}; for (const x of t.values()) if (x.meta) Object.assign(st, presOf(x));
      send(ws, { topic: m.topic, event: 'presence_state', payload: st }); billAdd('pres', 1);
      return;
    }
    if (!T || !T.has(ws)) return;
    const me = T.get(ws);
    if (m.event === 'presence') {
      const old = me.meta ? presOf(me) : {};
      me.meta = (m.payload && m.payload.payload) || {}; me.ref = 'r' + (++pref);
      for (const w of T.keys()) { send(w, { topic: m.topic, event: 'presence_diff', payload: { joins: presOf(me), leaves: old } }); billAdd('pres', 1); }
      return;
    }
    if (m.event === 'broadcast') {
      billAdd('bc', 1);
      for (const [w, x] of T) if (w !== ws || me.self) { send(w, { topic: m.topic, event: 'broadcast', payload: m.payload }); billAdd('bc', 1); }
      return;
    }
    if (m.event === 'phx_leave') leave(ws, m.topic);
  });
  ws.on('close', () => { for (const t of topics.keys()) leave(ws, t); });
});
function leave(ws, topic) {
  const T = topics.get(topic); if (!T || !T.has(ws)) return;
  const me = T.get(ws); T.delete(ws);
  if (me.meta) for (const w of T.keys()) { send(w, { topic, event: 'presence_diff', payload: { joins: {}, leaves: presOf(me) } }); billAdd('pres', 1); }
}
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html); }).listen(8842);
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(p, fn, arg, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await wait(200); } return false; }

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  const P = [];
  for (let i = 0; i < N; i++) {
    const p = await (await b.createBrowserContext()).newPage();
    await p.setViewport({ width: 320, height: 180 });
    await p.evaluateOnNewDocument((noRtc, i) => {
      try { localStorage.setItem('grau80-nasc', '1990'); localStorage.setItem('grau80-nome', 'Sim' + i); localStorage.setItem('grau80-instrucoes', 'fechado'); localStorage.setItem('grau80-musica', 'off'); } catch (e) {}
      if (noRtc) window.RTCPeerConnection = undefined;
    }, i < NODC, i);
    await p.goto('http://127.0.0.1:8842/', { waitUntil: 'load' });
    P.push(p);
  }
  for (const p of P) await until(p, () => __t.rt.open);
  await P[0].evaluate(() => __t.enterRoom('SIMU', true));
  await until(P[0], () => __t.room.code && !__t.room.phase);
  for (const p of P.slice(1)) { await wait(400); await p.evaluate(() => __t.enterRoom('SIMU', false)); }
  const cheia = await until(P[0], n => Object.keys(__t.room.members).length === n, N, 20000);
  const ids = []; for (const p of P) ids.push(await p.evaluate(() => __t.myId));
  for (let i = 0; i < N; i++) if (i >= N - MENU) continue; else { await P[i].evaluate(() => __t.begin('multi')); await P[i].keyboard.type('agenor'); }
  await wait(N > 2 ? 18000 : 6000); // conexões diretas fecham (ou desistem)
  const dc = []; for (const p of P) dc.push(await p.evaluate(() => Object.values(__t.room.peers).filter(x => x.dc && x.dc.readyState === 'open').length));
  bill.bc = 0; bill.pres = 0; bill.perSec.clear();
  // suavidade: a cada 100 ms compara onde o parceiro está (no aparelho dele) com onde ele aparece no aparelho do outro
  const errs = [], thErrs = []; const t0 = Date.now();
  while (Date.now() - t0 < WIN * 1000) {
    for (let a = 0; a < Math.min(N, 3); a++) for (let k = 1; k < Math.min(N, 3); k++) {
      const bI = (a + k) % N; if (bI >= N - MENU) continue;
      const [truth, seen] = await Promise.all([P[bI].evaluate(() => ({ x: __t.s.x, th: __t.s.th, m: __t.s.mode })), P[a].evaluate(id => { const r = __t.remotes.get(id); return r && r.tx != null ? { x: r.x, th: r.th } : null; }, ids[bI])]);
      if (seen && truth.m === 'ride') { const LAP = 1000, d = ((truth.x - seen.x) % LAP + LAP * 1.5) % LAP - LAP / 2; errs.push(Math.abs(d)); thErrs.push(Math.abs(truth.th - seen.th)); }
    }
    await wait(100);
  }
  const secs = [...bill.perSec.values()];
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
  const p95 = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * 0.95)] ?? NaN; };
  const r = { versao: VERSAO, N, sem_direta: NODC, no_menu: MENU, cheia, diretas: dc.join('/'), msgs_s: +((bill.bc + bill.pres) / WIN).toFixed(1), pico_s: Math.max(0, ...secs), por_hora: Math.round((bill.bc + bill.pres) / WIN * 3600),
    erro_pos_m: +avg(errs).toFixed(2), erro_pos_p95_m: +p95(errs).toFixed(2), erro_grau_rad: +avg(thErrs).toFixed(3), amostras: errs.length };
  console.log(JSON.stringify(r));
  await b.close(); srv.close(); wss.close(); process.exit(0);
})().catch(e => { console.error('ERRO', e); process.exit(2); });
