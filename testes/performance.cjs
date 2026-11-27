// Comparação de performance (navegador de computador, NÃO é aparelho real): FPS, estabilidade do frame time e memória JS
// no lobby e numa volta, versão main x branch atual. Uso: node testes/performance.cjs [index-antigo.html]
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OLD = process.argv[2];
const files = { atual: fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), anterior: OLD ? fs.readFileSync(OLD, 'utf8') : null };
const inj = h => { const j = h.lastIndexOf('})();'); return h.slice(0, j) + 'window.__t={begin,get s(){return s}};\n' + h.slice(j); };
let cur = '';
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0];
  if (u.startsWith('/img/') && fs.existsSync(path.join(ROOT, u))) { r.writeHead(200, { 'content-type': 'image/webp' }); return r.end(fs.readFileSync(path.join(ROOT, u))); }
  r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(inj(files[cur])); }).listen(8864);
const SAVE = { 'grau80-nasc': '1990', 'grau80-nome': 'P', 'grau80-nome-pedido': '1', 'grau80-novidades': 'welcome-1', 'grau80-instrucoes': 'fechado', 'grau80-tutorial': '{"menuTutorialVersion":2,"gameplayTutorialVersion":1}' };
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio', '--enable-precise-memory-info'] });
  const out = {};
  for (const k of Object.keys(files)) {
    if (!files[k]) continue; cur = k;
    const p = await (await b.createBrowserContext()).newPage();
    await p.setRequestInterception(true); p.on('request', q => q.url().startsWith('http://127.0.0.1') ? q.continue() : q.respond({ status: 404, body: '' }));
    await p.setViewport({ width: 1280, height: 720 });
    await p.evaluateOnNewDocument(s => { window.WebSocket = class { send() {} close() {} }; for (const [a, v] of Object.entries(s)) localStorage.setItem(a, v); }, SAVE);
    await p.goto('http://127.0.0.1:8864/'); await new Promise(r => setTimeout(r, 1500));
    const medir = () => p.evaluate(() => new Promise(res => { const d = []; let last = performance.now(), t0 = last;
      const f = t => { d.push(t - last); last = t; if (t - t0 < 4000) requestAnimationFrame(f); else { d.shift(); d.sort((a, b) => a - b);
        const avg = d.reduce((a, b) => a + b, 0) / d.length; res({ fps: +(1000 / avg).toFixed(1), p95ms: +d[Math.floor(d.length * 0.95)].toFixed(1), piorMs: +d[d.length - 1].toFixed(1), heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null }); } };
      requestAnimationFrame(f); }));
    const lobby = await medir();
    await p.evaluate(() => { __t.begin('livre'); });
    const volta = await medir();
    out[k] = { lobby, volta }; await p.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close(); srv.close(); process.exit(0);
})();
