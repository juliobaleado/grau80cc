// Mede quantas mensagens do Supabase Realtime uma sala consome (salas reais, código aleatório).
// Regra de cobrança (docs do Supabase): cada broadcast conta 1 no envio + 1 por cliente inscrito que recebe.
// Cada cliente conta os quadros do websocket: broadcasts enviados e recebidos, presença e heartbeat.
// "Sem conexão direta" é simulado apagando o RTCPeerConnection do cliente (igual rede que bloqueia WebRTC ou criança).
// Uso: N=7 FALLBACK=0,1,3,7 node testes/consumo.cjs
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
const isolar = require('./isolar-saguao.cjs'), RUN = Math.random().toString(36).slice(2, 8); // saguão exclusivo desta execução
const N = +(process.env.N || 4), CASES = (process.env.FALLBACK || '0,1').split(',').map(Number), WIN = +(process.env.WIN || 15);
let html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const j = html.lastIndexOf('})();');
html = html.slice(0, j) + 'window.__t = { room, enterRoom, leaveRoom, begin, rt, get s() { return s; } };\n' + html.slice(j);
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html); }).listen(8827);
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(p, fn, arg, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await wait(300); } return false; }

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  const rows = [];
  for (const nf of CASES) {
    const P = [];
    for (let i = 0; i < N; i++) {
      const p = await (await b.createBrowserContext()).newPage();
      await p.setViewport({ width: 480, height: 270 });
      await isolar(p, RUN);
      await p.evaluateOnNewDocument((noRtc, i) => {
        try { localStorage.setItem('grau80-nasc', '1990'); localStorage.setItem('grau80-nome', 'Medidor' + i); localStorage.setItem('grau80-instrucoes', 'fechado'); localStorage.setItem('grau80-musica', 'off'); } catch (e) {}
        if (noRtc) { delete window.RTCPeerConnection; window.RTCPeerConnection = undefined; }
        const C = window.__cnt = { out: {}, in: {}, on: false };
        const add = (o, k) => { if (C.on) o[k] = (o[k] || 0) + 1; };
        const key = m => m.event === 'broadcast' ? 'bc:' + ((m.payload && m.payload.event) || '?') : m.event;
        const WS = window.WebSocket;
        window.WebSocket = class extends WS {
          send(d) { try { add(C.out, key(JSON.parse(d))); } catch (e) {} return super.send(d); }
          set onmessage(f) { super.onmessage = e => { try { add(C.in, key(JSON.parse(e.data))); } catch (_) {} f(e); }; }
          get onmessage() { return super.onmessage; }
        };
      }, i < nf, i);
      await p.goto('http://127.0.0.1:8827/', { waitUntil: 'load' });
      P.push(p);
    }
    for (const p of P) await until(p, () => __t.rt.open);
    const code = 'M' + Math.random().toString(36).slice(2, 5).toUpperCase().replace(/[01OI]/g, 'X');
    await P[0].evaluate(c => __t.enterRoom(c, true), code);
    await until(P[0], () => __t.room.code && !__t.room.phase);
    await wait(3000);
    for (const p of P.slice(1)) { await p.evaluate(c => __t.enterRoom(c, false), code); await wait(600); }
    const full = await until(P[0], n => Object.keys(__t.room.members).length === n, N, 30000);
    for (const p of P) await p.evaluate(() => __t.begin('multi'));
    await wait(20000); // tempo pras conexões diretas fecharem (ou desistirem) antes de medir
    for (const p of P) await p.evaluate(() => { __cnt.out = {}; __cnt.in = {}; __cnt.on = true; });
    await wait(WIN * 1000);
    const per = [];
    for (const p of P) per.push(await p.evaluate(() => { __cnt.on = false; return { out: __cnt.out, in: __cnt.in, mode: __t.s.mode, dc: Object.values(__t.room.peers).filter(x => x.dc && x.dc.readyState === 'open').length }; }));
    const sum = (k, f) => per.reduce((a, x) => a + Object.entries(x[k]).filter(([e]) => f(e)).reduce((s, [, v]) => s + v, 0), 0);
    const bcOut = sum('out', e => e.startsWith('bc:')), bcIn = sum('in', e => e.startsWith('bc:'));
    const pres = sum('in', e => e.startsWith('presence')) + sum('out', e => e === 'presence');
    const billedPerHour = Math.round((bcOut + bcIn) / WIN * 3600);
    rows.push({ N, fallback: nf, cheia: full, dcAbertos: per.map(x => x.dc).join('/'), modos: [...new Set(per.map(x => x.mode))].join(','), envios_s: +(bcOut / WIN).toFixed(1), recebidos_s: +(bcIn / WIN).toFixed(1), presenca: pres, cobradas_hora: billedPerHour, detalhe: per[N - 1].out });
    console.log(JSON.stringify(rows[rows.length - 1]));
    for (const p of P) { await p.evaluate(() => __t.leaveRoom()).catch(() => {}); await p.browserContext().close(); }
    await wait(1500);
  }
  await b.close(); srv.close();
})().catch(e => { console.error('ERRO', e); srv.close(); process.exit(2); });
