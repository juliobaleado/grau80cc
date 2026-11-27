// Jogo sem internet: toda requisição ao Supabase falha (REST e websocket). O jogo tem que abrir, jogar e avisar.
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
let html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const j = html.lastIndexOf('})();');
html = html.slice(0, j) + 'window.__t = { begin, finish, get s() { return s; } };\n' + html.slice(j);
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html); }).listen(8828);
let pass = 0, fail = 0; const ok = (c, n, x) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FALHA ') + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); };
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio', '--host-resolver-rules=MAP *.supabase.co 0.0.0.0'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluateOnNewDocument(() => { localStorage.setItem('grau80-nasc', '1990'); localStorage.setItem('grau80-instrucoes', 'fechado'); localStorage.setItem('grau80-tutorial', '{"menuTutorialVersion":1,"gameplayTutorialVersion":1}'); localStorage.setItem('grau80-nome-pedido', '1'); localStorage.setItem('grau80-novidades', 'welcome-1'); });
  await p.goto('http://127.0.0.1:8828/', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 2500));
  ok(/Sem conexão/.test(await p.$eval('#boardList', e => e.textContent)), 'placar avisa "Sem conexão com o placar."');
  await p.evaluate(() => __t.begin('motoca')); await new Promise(r => setTimeout(r, 1500));
  ok(await p.evaluate(() => __t.s.mode === 'ride'), 'partida começa sem internet');
  await p.evaluate(() => { __t.s.runBest = 120; __t.s.runTime = 9; __t.finish('landed'); }); await new Promise(r => setTimeout(r, 1300));
  ok(await p.evaluate(() => !document.getElementById('endScreen').hidden), 'tela de fim aparece');
  await p.evaluate(() => { const f = document.getElementById('gSend'); if (!f.hidden) { document.getElementById('gName').value = 'Off'; f.requestSubmit(); } });
  await new Promise(r => setTimeout(r, 1500));
  const msg = await p.$eval('#gMsg', e => e.textContent);
  ok(msg === '' || /Não deu pra enviar/.test(msg), 'envio sem internet mostra erro amigável (ou nem oferece)', msg);
  await p.evaluate(() => document.getElementById('lobbyIn') && (document.getElementById('lobbyIn').value = 'oi'));
  await p.evaluate(() => document.getElementById('lobbyForm').requestSubmit()); await new Promise(r => setTimeout(r, 300));
  ok(/Sem conexão com o chat/.test(await p.$eval('#lobbyLog', e => e.textContent)), 'chat avisa "Sem conexão com o chat."');
  ok(!errs.length, 'sem erro de página', errs.slice(0, 3));
  console.log(`\n${pass} ok, ${fail} falha(s)`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); srv.close(); process.exit(2); });
