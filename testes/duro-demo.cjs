// Demonstração da perseguição da D.U.R.O. com o som do próprio jogo (corneta, apito e "plim" de senha).
// Passo 1 (tempo real): joga o roteiro e grava a saída de áudio do jogo (ganchos no AudioContext, sem placa de som).
// Passo 2 (relógio virtual, 30 q/s): joga o MESMO roteiro e tira um quadro por vez (canvas + HUD + tela de fim).
// Passo 3: junta quadros e áudio num mp4, alinhados pelo instante em que a Caravana começa a perseguir.
// Roteiro: Motoca em modo teste a partir de ~283 m → Caravana 3 Vias (300–400 m, fura o pneu) → pulo pra ~490 m →
// Esquadrilha do Protocolo (500 m) → desliga o piloto automático e passa do ponto com a Esquadrilha na cola.
// Nada de rede: Supabase e versao.json respondem 404 localmente. Uso: node testes/duro-demo.cjs [saida.mp4]
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'play-store', 'duro', 'demo-perseguicao-duro.mp4');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'duro-demo-'));
const FPS = 30;
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const j = html.lastIndexOf('})();');
html = html.slice(0, j) + 'window.__t={get s(){return s},begin,toggleCheat,get cheat(){return cheat}};\n' + html.slice(j);
let AUDIO = null; const frames = [];
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/q/')) { const f = path.join(TMP, path.basename(q.url)); r.writeHead(200, { 'content-type': 'image/jpeg' }); return r.end(fs.readFileSync(f)); }
  if (q.url === '/audio') { r.writeHead(200, { 'content-type': 'audio/webm' }); return r.end(AUDIO); }
  if (q.url === '/enc') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<body style="margin:0"><canvas id=c width=1280 height=720></canvas>'); }
  r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html);
}).listen(8843);
const wait = ms => new Promise(r => setTimeout(r, ms));
const PRE = () => {
  window.WebSocket = class { constructor() { this.readyState = 0; } send() {} close() {} };
  try { localStorage.setItem('grau80-nasc', '1990'); localStorage.setItem('grau80-instrucoes', 'fechado'); localStorage.setItem('grau80-tutorial', '{"menuTutorialVersion":2,"gameplayTutorialVersion":1}'); localStorage.setItem('grau80-nome-pedido', '1'); localStorage.setItem('grau80-novidades', 'welcome-1'); localStorage.setItem('grau80-musica', 'off'); localStorage.setItem('grau80-lang', 'pt'); } catch (e) {}
};

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
  const errs = [];
  const page = async () => {
    const p = await (await b.createBrowserContext()).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', q => q.url().startsWith('http://127.0.0.1') ? q.continue() : q.respond({ status: 404, body: '' }));
    await p.setViewport({ width: 1280, height: 720 }); return p;
  };

  // ---------- passo 1: áudio em tempo real ----------
  {
    const p = await page();
    await p.evaluateOnNewDocument(PRE);
    await p.evaluateOnNewDocument(() => {
      const orig = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (dst, ...a) {
        if (dst instanceof AudioDestinationNode) {
          const ctx = dst.context;
          if (!ctx.__tap) {
            ctx.__tap = ctx.createMediaStreamDestination();
            const rec = new MediaRecorder(ctx.__tap.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 160000 });
            window.__ach = []; rec.ondataavailable = e => e.data.size && window.__ach.push(e.data); window.__arec = rec;
          }
          orig.call(this, ctx.__tap);
        }
        return orig.call(this, dst, ...a);
      };
    });
    await p.goto('http://127.0.0.1:8843/', { waitUntil: 'load' });
    await p.mouse.click(640, 300); await wait(300);
    await p.evaluate(() => __t.begin('motoca'));
    await wait(300); await p.keyboard.type('agenor'); await wait(1200);
    const ready = await p.evaluate(() => !!window.__arec);
    if (!ready) throw new Error('o jogo não criou o áudio');
    await p.evaluate(() => {
      window.__arec.start(250); const t0 = performance.now(); window.__ev = {};
      window.__watch = setInterval(() => { const L = __t.s.law, now = performance.now() - t0;
        if (L.car && L.car.state === 'chase' && window.__ev.car == null) window.__ev.car = now;
        if (L.bikes.some(b => b.state === 'chase') && window.__ev.bikes == null) window.__ev.bikes = now; }, 5);
      __t.s.wStart -= 283 - __t.s.wDist;
    });
    while (await p.evaluate(() => __t.s.wDist) < 412) await wait(20);
    await p.evaluate(() => { __t.s.wStart -= 490 - __t.s.wDist; });
    while (await p.evaluate(() => __t.s.wDist) < 535) await wait(20);
    await p.evaluate(() => { if (__t.cheat) __t.toggleCheat(); __t.s.th = 1.7; });
    await wait(4200);
    const r = await p.evaluate(async () => {
      clearInterval(window.__watch); window.__arec.stop(); await new Promise(r => setTimeout(r, 600));
      const u = new Uint8Array(await new Blob(window.__ach, { type: 'audio/webm' }).arrayBuffer()); let s = '';
      for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return { b64: btoa(s), ev: window.__ev };
    });
    AUDIO = Buffer.from(r.b64, 'base64'); var evA = r.ev;
    fs.writeFileSync(OUT.replace(/\.mp4$/, '-som.webm'), AUDIO);
    console.log('áudio:', AUDIO.length, 'bytes · Caravana aos', (evA.car / 1000).toFixed(2), 's · Esquadrilha aos', (evA.bikes / 1000).toFixed(2), 's');
    await p.close();
  }

  // ---------- passo 2: quadros com relógio virtual ----------
  {
    const p = await page();
    await p.evaluateOnNewDocument(PRE);
    await p.evaluateOnNewDocument(() => {
      window.__vt = 1000; const q = [];
      performance.now = () => window.__vt;
      window.requestAnimationFrame = cb => { q.push(cb); return q.length; };
      window.__tick = ms => { window.__vt += ms; const cbs = q.splice(0); for (const cb of cbs) { try { cb(window.__vt); } catch (e) { console.error(e); } } };
    });
    await p.goto('http://127.0.0.1:8843/', { waitUntil: 'load' });
    const tick = n => p.evaluate((n, dt) => { for (let i = 0; i < n; i++) window.__tick(dt); }, n, 1000 / FPS);
    await tick(20);
    await p.evaluate(() => __t.begin('motoca')); await tick(9); await p.keyboard.type('agenor'); await tick(36);
    await p.evaluate(() => { __t.s.wStart -= 283 - __t.s.wDist; });
    let phase = 0, after = 0, evF = {};
    for (let i = 0; i < 2400; i++) {
      await tick(1);
      const st = await p.evaluate(() => { const L = __t.s.law; return { w: __t.s.wDist, car: !!(L.car && L.car.state === 'chase'), bikes: L.bikes.some(b => b.state === 'chase'), over: __t.s.mode === 'over' }; });
      if (st.car && evF.car == null) evF.car = i; if (st.bikes && evF.bikes == null) evF.bikes = i;
      const f = String(i).padStart(4, '0') + '.jpg';
      await p.screenshot({ path: path.join(TMP, f), type: 'jpeg', quality: 90 }); frames.push(f);
      if (phase === 0 && st.w >= 412) { await p.evaluate(() => { __t.s.wStart -= 490 - __t.s.wDist; }); phase = 1; }
      else if (phase === 1 && st.w >= 535) { await p.evaluate(() => { if (__t.cheat) __t.toggleCheat(); __t.s.th = 1.7; }); phase = 2; }
      else if (phase === 2 && st.over) { phase = 3; await wait(1300); } // a tela de fim aparece com um atraso de tempo real
      else if (phase === 3 && ++after > FPS * 3) break;
    }
    var evFr = evF;
    console.log('quadros:', frames.length, '· Caravana no quadro', evF.car, '· Esquadrilha no quadro', evF.bikes);
    await p.close();
  }

  // ---------- passo 3: junta ----------
  const offset = evA.car / 1000 - evFr.car / FPS; // quanto o áudio está "adiantado" em relação aos quadros
  const drift = (evA.bikes / 1000 - offset) - evFr.bikes / FPS;
  console.log('alinhamento: corte de', offset.toFixed(2), 's no áudio · diferença na chegada da Esquadrilha:', drift.toFixed(2), 's');
  const p = await page();
  const chunks = [];
  await p.exposeFunction('saveChunk', s => { chunks.push(Buffer.from(s, 'base64')); });
  await p.goto('http://127.0.0.1:8843/enc');
  const res = await p.evaluate(async (frames, FPS, offset) => {
    const c = document.getElementById('c'), g = c.getContext('2d');
    const ac = new AudioContext(); await ac.resume();
    const buf = await ac.decodeAudioData(await (await fetch('/audio')).arrayBuffer());
    const dest = ac.createMediaStreamDestination(); const src = ac.createBufferSource(); src.buffer = buf; src.connect(dest);
    const vt = c.captureStream(0).getVideoTracks()[0];
    const mime = 'video/mp4;codecs=avc1.640028,mp4a.40.2';
    if (!MediaRecorder.isTypeSupported(mime)) return 'sem suporte a ' + mime;
    const rec = new MediaRecorder(new MediaStream([vt, dest.stream.getAudioTracks()[0]]), { mimeType: mime, videoBitsPerSecond: 6e6, audioBitsPerSecond: 160000 });
    rec.ondataavailable = async ev => { if (ev.data.size) { const u = new Uint8Array(await ev.data.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); await window.saveChunk(btoa(s)); } };
    const load = i => i >= frames.length ? Promise.resolve(null) : fetch('/q/' + frames[i]).then(r => r.blob()).then(createImageBitmap).catch(() => null);
    const AHEAD = 12, q = []; for (let i = 0; i < AHEAD; i++) q.push(load(i));
    g.drawImage(await q[0], 0, 0);
    rec.start(1000);
    const t0 = performance.now();
    if (offset >= 0) src.start(0, offset); else src.start(ac.currentTime - offset);
    let late = 0;
    for (let i = 0; i < frames.length; i++) {
      const im = await q[i]; q.push(load(i + AHEAD));
      const w = t0 + i * 1000 / FPS - performance.now();
      if (w > 0) await new Promise(r => setTimeout(r, w)); else if (w < -20) late++;
      if (im) { g.drawImage(im, 0, 0); vt.requestFrame(); im.close && im.close(); }
    }
    await new Promise(r => setTimeout(r, 400));
    await new Promise(r => { rec.onstop = r; rec.stop(); });
    await new Promise(r => setTimeout(r, 800));
    return 'ok · quadros atrasados: ' + late;
  }, frames, FPS, offset);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.concat(chunks));
  console.log('montagem:', res, '·', OUT, fs.statSync(OUT).size, 'bytes');
  console.log('erros de página:', errs.length ? errs : 'nenhum');
  await b.close(); srv.close(); fs.rmSync(TMP, { recursive: true, force: true });
})().catch(e => { console.error(e); process.exit(1); });
