// Trailer do Grau 80cc · passo 1: captura as cenas do jogo de verdade, quadro a quadro.
// O relógio do jogo é virtual (1/30 s por quadro), então o movimento sai liso mesmo com o print demorando.
// Só há duas ajudas de filmagem: o piloto automático do modo teste (o mesmo do "agenor") segura o grau,
// e os parceiros da sala são jogadores de mentira posicionados pelo script (desenhados pelo próprio jogo).
// Nada de animação inventada: tudo que aparece é o renderizador do jogo.
//
// Uso: node trailer/captura.cjs [pasta-dos-quadros]   (depois: node trailer/monta.cjs)
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = path.join(__dirname, '..');
const FR = process.argv[2] || path.join(ROOT, 'play-store', 'trailer', 'quadros');
const SEG = (process.env.SEG || '').split(',').filter(Boolean); // SEG=B,D recaptura só alguns
const FPS = 30, DT = 1000 / FPS;

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const rep = (a, b) => { if (html.split(a).length !== 2) throw new Error('gancho sumiu do jogo: ' + a.slice(0, 60)); html = html.replace(a, b); };
rep('if (cheat) toggleCheat(); closeMp(); mpRound = 0;', 'closeMp(); mpRound = 0;'); // o piloto automático vale na sala de filmagem
rep("if (!cheat && room.code) { flash", "if (false) { flash");
// piloto automático: o grau sobe e desce em volta do ponto de equilíbrio, como um piloto de verdade
rep('if (cheat) { s.th += (balNow() - s.th) * Math.min(1, h * 4);', 'if (cheat) { s.th += ((window.__th || balNow() - 0.16 + Math.sin(performance.now() / 760) * 0.2 + Math.sin(performance.now() / 310) * 0.05) - s.th) * Math.min(1, h * 4);');
rep('  function stepRemotes(dt) {\n    if (!remotes.size) return;', '  function stepRemotes(dt) {\n    if (window.__fakeStep) window.__fakeStep();\n    if (!remotes.size) return;');
const j = html.lastIndexOf('})();');
html = html.slice(0, j) + 'window.__t={get s(){return s},get cheat(){return cheat},room,remotes,begin,becomeDog,mpHud,LOOKS,input,pick,toggleCheat,renderGarage,applyLook};\n' + html.slice(j);

// placar de demonstração (pra não expor apelidos de jogadores reais no vídeo)
const BOARD = [['Deco', 3163], ['Bia', 2503.3], ['Tonho', 1858], ['Lucas', 1520.5], ['Digão', 1301.9], ['Mari', 1130.7], ['Rafa', 1093.8], ['Duda', 1034.4], ['Pedro', 750.4], ['Zé', 509.1]]
  .map(([nome, metros]) => ({ nome, metros }));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html); }).listen(8823);

const HIDE = `.pad, .hud-btns, #toast, #ach, #chatBtn, #micBtn, #quickPlay, #iosTip, .lobby, #pauseBtn, .mute, .musicbtn, .eyetools { visibility: hidden !important; }`;

(async () => {
  fs.mkdirSync(FR, { recursive: true });
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio'] });
  const errs = [];

  async function session(look) {
    const p = await (await b.createBrowserContext()).newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', q => {
      if (!q.url().includes('supabase.co')) return q.continue();
      if (q.method() === 'OPTIONS') return q.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      q.respond({ status: q.url().includes('placar?select') ? 200 : 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(q.url().includes('placar?select') ? BOARD : {}) });
    });
    await p.evaluateOnNewDocument(look => {
      window.Capacitor = { isNativePlatform: () => true, registerPlugin: () => ({ getProducts: async () => ({ products: [] }) }) };
      window.WebSocket = class { constructor() { this.readyState = 0; } send() {} close() {} }; // sem Realtime de verdade
      try {
        localStorage.setItem('grau80-nome', 'Julio'); localStorage.setItem('grau80-instrucoes', 'fechado'); localStorage.setItem('grau80-nasc', '1990');
        localStorage.setItem('grau80-musica', 'off'); localStorage.setItem('grau80-look', JSON.stringify(look || {}));
      } catch (e) {}
      window.__vt = 1000; const q = [];
      performance.now = () => window.__vt;
      window.requestAnimationFrame = cb => { q.push(cb); return q.length; };
      window.__tick = ms => { window.__vt += ms; const cbs = q.splice(0); for (const cb of cbs) { try { cb(window.__vt); } catch (e) { console.error(e); } } };
    }, look);
    await p.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await p.goto('http://127.0.0.1:8823/', { waitUntil: 'load' });
    await p.addStyleTag({ content: HIDE });
    const tick = (n = 1) => p.evaluate((n, dt) => { for (let i = 0; i < n; i++) window.__tick(dt); }, n, DT);
    await tick(30);
    return { p, tick, ev: (fn, ...a) => p.evaluate(fn, ...a) };
  }
  // sala de mentira: os parceiros andam junto, cada um oscilando o próprio grau
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
    window.__del = id => { delete t.room.members[id]; t.remotes.delete(id); delete window.__cast[id]; };
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

  async function shootSeg(name, ctx, count, each) {
    const dir = path.join(FR, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < count; i++) {
      if (each) await each(i);
      await ctx.tick(1);
      await ctx.p.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 90 });
    }
    console.log('  ', name, count, 'quadros');
  }
  const want = k => !SEG.length || SEG.includes(k);

  // A · gancho (3 s): a galera inteira no grau, um caramelo no meio
  // C · multiplayer (6 s): mesma sala, nomes e placar da sala na tela
  if (want('A') || want('C')) {
    const c = await session({ model: 'monark', frame: 'ferrari' });
    await c.ev(castSetup);
    await c.ev(() => {
      __add('a1', 'Deco', 0, { m: 'ride', off: 6, th: 1.0, b: 412.3, mic: true, c0: 60, model: 'bruno', frame: 'vinho' });
      __add('a2', 'Tonho', 1, { m: 'ride', off: 11.5, th: 0.95, b: 377.8, c0: 90, model: 'xr' });
      __add('a3', 'Bia', 2, { m: 'ride', off: 3.4, th: 1.05, b: 230.1, c0: 20, model: 'caicara', frame: 'rosa' });
      __add('d1', 'Lucas', 3, { m: 'dog', off: -2.2, b: 140 });
      __t.begin('multi'); __t.mpHud();
    });
    await c.tick(5); await c.p.keyboard.type('agenor'); await c.tick(110); await c.ev(stripTest);
    if (want('A')) await shootSeg('A', c, 90);
    if (want('C')) {
      await c.ev(() => { __add('a4', 'Mari', 5, { m: 'ride', off: 15.5, th: 0.98, b: 198.4, c0: 40, model: 'bikelete' }); __add('d2', 'Digão', 4, { m: 'dog', off: 8.6, b: 96 }); });
      await shootSeg('C', c, 180);
    }
    await c.p.close();
  }

  // B · jogabilidade (6 s): sozinho no Modo Motoca, contador subindo, a matilha de caramelos aparece nos 100 m
  if (want('B')) {
    const c = await session({ model: 'caicara', frame: 'agua' });
    await c.ev(() => __t.begin('motoca'));
    await c.tick(5); await c.p.keyboard.type('agenor'); await c.tick(100); await c.ev(stripTest);
    await c.ev(() => { __t.s.wStart -= 252; }); // começa perto dos 290 m: a viatura chega nos 300
    await shootSeg('B', c, 180);
    await c.p.close();
  }

  // D · caramelo (7 s): vira pra trás de verdade, vira caramelo, corre, passa no Agenor e volta pra bike
  if (want('D')) {
    const c = await session({ model: 'monark', frame: 'ferrari' });
    await c.ev(castSetup);
    await c.ev(() => {
      __add('a1', 'Deco', 0, { m: 'ride', off: 5, th: 1.0, b: 412.3, c0: 60, model: 'bruno', frame: 'vinho' });
      __add('a3', 'Bia', 2, { m: 'ride', off: 9.5, th: 1.05, b: 230.1, c0: 20, model: 'caicara', frame: 'rosa' });
      __t.begin('multi'); __t.mpHud();
    });
    await c.tick(5); await c.p.keyboard.type('agenor'); await c.tick(90); await c.ev(stripTest);
    let phase = 0;
    await shootSeg('D', c, 210, async i => {
      if (i === 8) await c.ev(() => { __t.toggleCheat(); __t.s.om = 3.2; }); // tira o piloto e dá um tranco: passa do ponto
      if (i === 120 && phase === 0) { // corte (na montagem) pra perto da pastelaria: o caramelo cruza a volta
        await c.ev(() => { const s = __t.s, d = s.pet; if (d) { d.x = 990; d.v = 12; } s.x = 990; __cast.a1.off = 3.2; __cast.a3.off = 6.5; });
        phase = 1;
      }
      if (phase === 1) await c.ev(() => { const s = __t.s; if (s.mode === 'ride' && !__t.cheat) { __t.toggleCheat(); } });
    });
    await c.p.close();
  }

  // E · garagem (3 s): troca de visual de verdade na tela inicial; bikes travadas aparecem com cadeado
  if (want('E')) {
    const c = await session({ model: 'caicara', frame: 'agua' });
    const order = [['helmet', 2], ['jersey', 1], ['bag', 1], ['frame', 4], ['shorts', 3], ['helmet', 5], ['jersey', 7], ['frame', 1]];
    await shootSeg('E', c, 90, async i => {
      if (i % 11 === 5) await c.ev(([k, n]) => { const o = Object.keys(__t.LOOKS[k].opts).filter(x => !__t.LOOKS[k].opts[x].lock); __t.pick[k] = o[n % o.length]; __t.renderGarage(); }, order[Math.floor(i / 11) % order.length]);
    });
    await c.p.close();
  }

  // F · caramelos especiais (2 s) e fundo do encerramento (4 s)
  if (want('F')) {
    const c = await session({ model: 'monark', frame: 'ferrari' });
    await c.ev(castSetup);
    await c.ev(() => {
      [['magro', 'Rafa', -3.2], ['gordinho', 'Duda', 1.8], ['gordo', 'Pedro', 4.6], ['gordaco', 'Lucas', 7.4], ['meca', 'Digão', 10.2], ['vento', 'Mari', 2.6]]
        .forEach(([dog, nome, off], k) => __add('k' + k, nome, k + 5, { m: 'dog', off, dog, b: 50 + k * 30 }));
      __t.begin('multi'); __t.mpHud();
    });
    await c.tick(5); await c.p.keyboard.type('agenor'); await c.tick(100); await c.ev(stripTest);
    await shootSeg('F', c, 180);
    await c.p.close();
  }

  console.log('erros de página:', errs.length ? [...new Set(errs)].slice(0, 5) : 'nenhum');
  await b.close(); srv.close();
})().catch(e => { console.error('FALHOU', e); srv.close(); process.exit(1); });
