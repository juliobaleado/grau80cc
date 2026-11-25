// Trailer V2 · passo 1: captura em 2x (3840x2160) pra permitir zoom e o vertical em tela cheia sem perder nitidez.
// Mesmas regras do V1: só o renderizador do jogo, relógio virtual, piloto automático do modo teste e parceiros
// de sala posicionados por script. Novidade: a cena da transformação é gravada com o jogador em destaque, câmera
// lenta de verdade (o relógio do jogo anda 40% por quadro) no instante da troca, e os avisos do próprio jogo na tela.
// Cada cena grava também meta.json (por quadro: modo do jogador, posição na tela dos parceiros, câmera lenta, cortes),
// que a montagem usa pra enquadrar.
// Uso: node trailer/captura-v2.cjs   (SEG=D recaptura só uma cena)   depois: node trailer/monta-v2.cjs
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = path.join(__dirname, '..');
const FR = process.argv[2] || path.join(ROOT, 'play-store', 'trailer', 'v2', 'quadros');
const SEG = (process.env.SEG || '').split(',').filter(Boolean);
const FPS = 30, DT = 1000 / FPS;

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const rep = (a, b) => { if (html.split(a).length !== 2) throw new Error('gancho sumiu do jogo: ' + a.slice(0, 60)); html = html.replace(a, b); };
rep('if (cheat) toggleCheat(); closeMp(); mpRound = 0;', 'closeMp(); mpRound = 0;');
rep("if (!cheat && room.code) { flash", "if (false) { flash");
rep("flash(T(cheat ? 'Modo teste ligado: tudo liberado' : 'Modo teste desligado'));", "if (!window.__quiet) flash(T(cheat ? 'Modo teste ligado: tudo liberado' : 'Modo teste desligado'));"); // o aviso do modo teste não aparece no vídeo
rep('if (cheat) { s.th += (balNow() - s.th) * Math.min(1, h * 4);', 'if (cheat) { s.th += ((window.__th || balNow() - 0.16 + Math.sin(performance.now() / 760) * 0.2 + Math.sin(performance.now() / 310) * 0.05) - s.th) * Math.min(1, h * 4);');
rep('  function stepRemotes(dt) {\n    if (!remotes.size) return;', '  function stepRemotes(dt) {\n    if (window.__fakeStep) window.__fakeStep();\n    if (!remotes.size) return;');
const j = html.lastIndexOf('})();');
html = html.slice(0, j) + 'window.__t={get s(){return s},get cheat(){return cheat},room,remotes,begin,becomeDog,mpHud,LOOKS,input,pick,toggleCheat,renderGarage,near,laneIds};\n' + html.slice(j);

const BOARD = [['Deco', 3163], ['Bia', 2503.3], ['Tonho', 1858], ['Lucas', 1520.5], ['Digão', 1301.9], ['Mari', 1130.7], ['Rafa', 1093.8], ['Duda', 1034.4], ['Pedro', 750.4], ['Zé', 509.1]].map(([nome, metros]) => ({ nome, metros }));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html); }).listen(8833);
const HIDE = `.pad, .hud-btns, #ach, #chatBtn, #micBtn, #quickPlay, #iosTip, .lobby, #pauseBtn, .mute, .musicbtn, .eyetools, .updbar { visibility: hidden !important; }
  body:not(.toastok) #toast { visibility: hidden !important; }`;

(async () => {
  fs.mkdirSync(FR, { recursive: true });
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio'] });
  const errs = [];
  async function session(look) {
    const p = await (await b.createBrowserContext()).newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', q => {
      const u = q.url();
      if (u.includes('versao.json')) return q.respond({ status: 404, body: '' });
      if (!u.includes('supabase.co')) return q.continue();
      if (q.method() === 'OPTIONS') return q.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      q.respond({ status: u.includes('placar?select') ? 200 : 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(u.includes('placar?select') ? BOARD : {}) });
    });
    await p.evaluateOnNewDocument(look => {
      window.__quiet = true;
      window.Capacitor = { isNativePlatform: () => true, registerPlugin: () => ({ getProducts: async () => ({ products: [] }), getPurchases: async () => ({ purchases: [] }) }) };
      window.WebSocket = class { constructor() { this.readyState = 0; } send() {} close() {} };
      try {
        localStorage.setItem('grau80-nome', 'Julio'); localStorage.setItem('grau80-instrucoes', 'fechado'); localStorage.setItem('grau80-nasc', '1990');
        localStorage.setItem('grau80-musica', 'off'); localStorage.setItem('grau80-look', JSON.stringify(look || {}));
      } catch (e) {}
      window.__vt = 1000; const q = [];
      performance.now = () => window.__vt;
      window.requestAnimationFrame = cb => { q.push(cb); return q.length; };
      window.__tick = ms => { window.__vt += ms; const cbs = q.splice(0); for (const cb of cbs) { try { cb(window.__vt); } catch (e) { console.error(e); } } };
    }, look);
    await p.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
    await p.goto('http://127.0.0.1:8833/', { waitUntil: 'load' });
    await p.addStyleTag({ content: HIDE });
    const tick = (n = 1, dt = DT) => p.evaluate((n, dt) => { for (let i = 0; i < n; i++) window.__tick(dt); }, n, dt);
    await tick(30);
    return { p, tick, ev: (fn, ...a) => p.evaluate(fn, ...a) };
  }
  const castSetup = () => {
    const t = __t; t.room.code = 'GRAU'; t.room.phase = '';
    const keys = k => Object.keys(t.LOOKS[k].opts);
    window.__cast = {};
    window.__add = (id, nome, n, o) => {
      const look = {}; for (const k of Object.keys(t.LOOKS)) { const ks = keys(k).filter(x => !t.LOOKS[k].opts[x].lock); look[k] = ks[(n * 3 + 1 + k.length * 2) % ks.length]; }
      if (o.model) look.model = o.model; if (o.frame) look.frame = o.frame; look.dog = o.dog || 'normal';
      t.room.members[id] = { nome, at: Date.now() - 1000 * (n + 1), look };
      t.remotes.set(id, { x: t.s.x + o.off, tx: t.s.x + o.off, tv: 0, th: o.th || 0, tth: o.th || 0, rt: performance.now(), m: o.m, q: 1, wheel: 0, leg: 0, say: 0, fl: 0, st: 0, pl: 0, b: o.b || 0, c: o.c0 || 0, mic: !!o.mic, lastM: o.m });
      o.ph = n * 1.7; window.__cast[id] = o;
    };
    window.__fakeStep = () => {
      const s = t.s, now = performance.now();
      if (s.pack && s.pack.dogs && s.pack.dogs.length) s.pack.dogs = [];
      for (const [id, o] of Object.entries(window.__cast)) {
        const r = t.remotes.get(id); if (!r) continue;
        r.tx = s.x + o.off; r.rt = now; r.m = o.m; r.tv = o.m === 'ride' ? 12 : Math.max(8, s.v);
        r.tth = o.m === 'ride' ? o.th + Math.sin(now / (650 + o.ph * 90) + o.ph) * 0.2 : 0;
        if (o.m === 'ride') r.c = (o.c0 || 0) + (s.x - (o.x0 ?? (o.x0 = s.x)));
        if (o.m === 'dog' && Math.sin(now / 900 + o.ph * 3) > 0.985) r.say = 0.28;
      }
    };
  };
  const stripTest = () => { const h = document.getElementById('hudMode'); h.textContent = h.textContent.replace(/ · (teste|test|prueba)/i, ''); };
  // onde estão as coisas na tela (px CSS do quadro 1920x1080), pra montagem enquadrar
  const metaNow = () => {
    const t = __t, s = t.s, S = 120, BX = 1920 * 0.36, yC = Math.round(1080 * 0.78);
    const out = { m: s.mode, me: [Math.round(BX + (s.mode === 'dog' ? 0 : 0.35 * S)), Math.round(yC - (s.mode === 'dog' ? 0.35 : 0.9) * S)], others: [] };
    if (t.room.code) t.laneIds().forEach((id, i) => {
      const r = t.remotes.get(id); if (!r || r.tx == null) return;
      const x = BX + (t.near(r.x) - s.x) * S, y = yC + (i + 1) * 0.3 * S;
      if (x > -200 && x < 2120) out.others.push([Math.round(x + (r.m === 'dog' ? 0 : 0.35 * S)), Math.round(y - (r.m === 'dog' ? 0.35 : 0.9) * S), r.m]);
    });
    return out;
  };
  async function shootSeg(name, ctx, count, each) {
    const dir = path.join(FR, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const meta = [];
    for (let i = 0; i < count; i++) {
      const extra = (each && await each(i)) || {};
      await ctx.tick(1, extra.dt || DT);
      await ctx.ev(stripTest);
      meta.push({ ...(await ctx.ev(metaNow)), ...extra, dt: undefined, slow: extra.dt ? +(extra.dt / DT).toFixed(2) : undefined });
      await ctx.p.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 88 });
    }
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta));
    console.log('  ', name, count, 'quadros');
  }
  const want = k => !SEG.length || SEG.includes(k);

  // A (gancho) e C (multiplayer): a galera junta
  if (want('A') || want('C')) {
    const c = await session({ model: 'monark', frame: 'ferrari' });
    await c.ev(castSetup);
    await c.ev(() => {
      __add('a1', 'Deco', 0, { m: 'ride', off: 4.2, th: 1.0, b: 412.3, mic: true, c0: 60, model: 'bruno', frame: 'vinho' });
      __add('a3', 'Bia', 2, { m: 'ride', off: 2.2, th: 1.05, b: 230.1, c0: 20, model: 'caicara', frame: 'rosa' });
      __add('a2', 'Tonho', 1, { m: 'ride', off: 6.4, th: 0.95, b: 377.8, c0: 90, model: 'xr' });
      __add('d1', 'Lucas', 3, { m: 'dog', off: -1.6, b: 140 });
      __t.begin('multi'); __t.mpHud();
    });
    await c.tick(5); await c.p.keyboard.type('agenor'); await c.tick(110);
    if (want('A')) await shootSeg('A', c, 90);
    if (want('C')) await shootSeg('C', c, 150);
    await c.p.close();
  }

  // B: grau sozinho com a Caravana da D.U.R.O. chegando
  if (want('B')) {
    const c = await session({ model: 'caicara', frame: 'agua' });
    await c.ev(() => __t.begin('motoca'));
    await c.tick(5); await c.p.keyboard.type('agenor'); await c.tick(100);
    await c.ev(() => { __t.s.wStart -= 255; });
    await shootSeg('B', c, 150);
    await c.p.close();
  }

  // D: A TRANSFORMAÇÃO. Só o jogador e dois parceiros à frente (nenhum outro caramelo pra confundir).
  if (want('D')) {
    const c = await session({ model: 'monark', frame: 'ferrari' });
    await c.ev(castSetup);
    await c.ev(() => {
      __add('a1', 'Deco', 0, { m: 'ride', off: 3.6, th: 1.0, b: 412.3, c0: 60, model: 'bruno', frame: 'vinho' });
      __add('a3', 'Bia', 2, { m: 'ride', off: 6.6, th: 1.05, b: 230.1, c0: 20, model: 'caicara', frame: 'rosa' });
      __t.begin('multi'); __t.mpHud();
    });
    await c.tick(5); await c.p.keyboard.type('agenor'); await c.tick(90);
    // (os avisos pequenos do jogo ficam de fora: os títulos dizem o mesmo em tamanho legível e eles brigavam com os títulos)
    let st = { phase: 'ride', swapAt: -1, slowLeft: 0, cutAt: -1, backAt: -1 };
    await shootSeg('D', c, 250, async i => {
      const s = await c.ev(() => ({ m: __t.s.mode, die: __t.s.dieT || 0 }));
      const ev = {};
      if (i === 34) { await c.ev(() => { __t.toggleCheat(); __t.s.om = 3.4; }); ev.flip = true; } // tira o piloto e dá o tranco: passa do ponto de verdade
      // câmera lenta de verdade: o relógio do jogo anda 40% por quadro do fim da queda até um pouco depois da troca
      if (s.m === 'over' && s.die > 1.2 && st.phase === 'ride') st.phase = 'slow';
      if (st.phase === 'slow' && s.m === 'dog' && st.swapAt < 0) { st.swapAt = i; ev.swap = true; st.slowLeft = 30; }
      if (st.phase === 'slow') { ev.dt = DT * 0.4; if (st.swapAt >= 0 && --st.slowLeft <= 0) st.phase = 'run'; }
      // correndo: a galera vai ficando ao alcance, o caramelo chega na cola do Deco (e late, que é do jogo)
      if (st.phase === 'run') await c.ev(() => { __cast.a1.off = Math.max(1.3, __cast.a1.off - 0.03); __cast.a3.off = Math.max(3.6, __cast.a3.off - 0.035); });
      // corte pra perto da pastelaria: o caramelo cruza a volta e o jogo devolve a moto
      if (st.phase === 'run' && st.swapAt >= 0 && i === st.swapAt + 30 + 75) {
        await c.ev(() => { const s = __t.s, d = s.pet; if (d) { d.x = 992.5; d.v = 11; } s.x = 992.5; __cast.a1.off = 3.4; __cast.a3.off = 6.2; });
        st.cutAt = i; ev.cut = true; st.phase = 'agenor';
      }
      if (st.phase === 'agenor' && s.m === 'ride') { if (st.backAt < 0) { st.backAt = i; ev.back = true; } await c.ev(() => { if (!__t.cheat) __t.toggleCheat(); }); }
      return ev;
    });
    await c.p.close();
  }

  // E: garagem (em 2x, pra o zoom nas opções ficar nítido)
  if (want('E')) {
    const c = await session({ model: 'caicara', frame: 'agua' });
    const order = [['helmet', 2], ['jersey', 1], ['bag', 1], ['frame', 4], ['shorts', 3], ['helmet', 5], ['jersey', 7], ['frame', 1], ['bag', 0], ['helmet', 3]];
    await shootSeg('E', c, 120, async i => {
      if (i % 11 === 4) await c.ev(([k, n]) => { const o = Object.keys(__t.LOOKS[k].opts).filter(x => !__t.LOOKS[k].opts[x].lock); __t.pick[k] = o[n % o.length]; __t.renderGarage(); }, order[Math.floor(i / 11) % order.length]);
    });
    await c.p.close();
  }

  // F: caramelos especiais e fundo do encerramento
  if (want('F')) {
    const c = await session({ model: 'monark', frame: 'ferrari' });
    await c.ev(castSetup);
    await c.ev(() => {
      [['magro', 'Rafa', -2.4], ['gordinho', 'Duda', 1.4], ['gordo', 'Pedro', 3.4], ['gordaco', 'Lucas', 5.4], ['meca', 'Digão', 7.4], ['vento', 'Mari', 2.4]]
        .forEach(([dog, nome, off], k) => __add('k' + k, nome, k + 5, { m: 'dog', off, dog, b: 50 + k * 30 }));
      __t.begin('multi'); __t.mpHud();
    });
    await c.tick(5); await c.p.keyboard.type('agenor'); await c.tick(100);
    await shootSeg('F', c, 150);
    await c.p.close();
  }

  console.log('erros de página:', errs.length ? [...new Set(errs)].slice(0, 5) : 'nenhum');
  await b.close(); srv.close();
})().catch(e => { console.error('FALHOU', e); srv.close(); process.exit(1); });
