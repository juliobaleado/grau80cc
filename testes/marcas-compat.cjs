// Compatibilidade e visual das marcas fictícias (69 Rango, Pedalona 80, Fumacinha 4T, Litorânea, Bravona, Trilha Bruta,
// Vermelho Foguete, Guaranazinho; o Uno com escada voltou) e das cores novas de bike. Abre o jogo com dados salvos de um jogador da versão anterior e confere
// que nada se perde: visual escolhido, bikes liberadas, conquistas, recordes e compras (pastéis da Google Play).
// Também confere as três mochilas, a troca na garagem, as traduções e tira capturas. Sem rede: o WebSocket é falso e
// toda requisição externa responde 404 (não entra no saguão nem em sala nenhuma).
// Uso: node testes/marcas-compat.cjs [pasta-das-capturas]
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'play-store', 'duro', 'marcas');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const j = html.lastIndexOf('})();');
html = html.slice(0, j) + 'window.__t={get s(){return s},begin,pick,LOOKS,get bag(){return BAG},get best(){return best},unlocked,owned,isLocked,renderGarage,toggleCheat,get cheat(){return cheat}};\n' + html.slice(j);
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html); }).listen(8848);
let pass = 0, fail = 0;
const ok = (c, n, x) => { c ? pass++ : fail++; console.log((c ? '  ok    ' : '  FALHA ') + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); };
const wait = ms => new Promise(r => setTimeout(r, ms));
// dados salvos de alguém que jogou a versão anterior: mochila aiFudi, Monark liberada e escolhida, cor Ferrari,
// conquistas até 200 m, recordes e um pastel comprado (caramelo magrelo)
const SAVE = {
  'grau80-nasc': '1990', 'grau80-nome': 'Veterano', 'grau80-instrucoes': 'fechado', 'grau80-tutorial': '{"menuTutorialVersion":2,"gameplayTutorialVersion":1}', 'grau80-nome-pedido': '1', 'grau80-novidades': 'welcome-1', 'grau80-musica': 'off',
  'grau80-look': JSON.stringify({ helmet: 'preto', jersey: 'vermelha', shorts: 'jeans', bag: 'aifode', model: 'monark', frame: 'ferrari', dog: 'magro' }),
  'grau80-ach': JSON.stringify({ grau30: 1, grau100: 1, grau200: 1 }), 'grau80-best': '412.30', 'grau80-best-livre': '88.10',
  'grau80-doa': JSON.stringify(['mini_pastel'])
};

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio'] });
  async function session(save, { vw = 1280, vh = 720, lang = 'pt', dpr = 1 } = {}) {
    const p = await (await b.createBrowserContext()).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', q => q.url().startsWith('http://127.0.0.1') ? q.continue() : q.respond({ status: 404, body: '' }));
    await p.evaluateOnNewDocument((save, lang) => {
      window.WebSocket = class { constructor() { this.readyState = 0; } send() {} close() {} };
      // app nativo com a compra registrada na Google Play (igual ao aparelho do jogador)
      window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', registerPlugin: () => ({
        getProducts: async () => ({ products: [] }),
        getPurchases: async () => ({ purchases: [{ productIdentifier: 'mini_pastel', purchaseState: '1' }] }) }) };
      try { for (const [k, v] of Object.entries(save)) localStorage.setItem(k, v); localStorage.setItem('grau80-lang', lang); } catch (e) {}
      window.__vt = 1000; const q = [];
      performance.now = () => window.__vt;
      window.requestAnimationFrame = cb => { q.push(cb); return q.length; };
      window.__tick = ms => { window.__vt += ms; const cbs = q.splice(0); for (const cb of cbs) { try { cb(window.__vt); } catch (e) { console.error(e); } } };
    }, save, lang);
    await p.setViewport({ width: vw, height: vh, deviceScaleFactor: dpr });
    await p.goto('http://127.0.0.1:8848/', { waitUntil: 'load' });
    const tick = (n = 1) => p.evaluate(n => { for (let i = 0; i < n; i++) window.__tick(1000 / 60); }, n);
    await tick(30); await wait(300); await tick(5);
    return { p, tick, errs };
  }
  fs.mkdirSync(OUT, { recursive: true });

  console.log('\nA. Save da versão anterior');
  {
    const c = await session(SAVE);
    const st = await c.p.evaluate(() => ({ pick: { ...__t.pick }, bag: __t.bag.name, model: __t.LOOKS.model.opts[__t.pick.model].name, frame: __t.LOOKS.frame.opts[__t.pick.frame].name,
      ach: Object.keys(__t.unlocked).sort(), best: __t.best, owned: [...__t.owned], monarkLocked: __t.isLocked('model', __t.LOOKS.model.opts.monark),
      xrLocked: __t.isLocked('model', __t.LOOKS.model.opts.xr), magroLocked: __t.isLocked('dog', __t.LOOKS.dog.opts.magro),
      bikeleteLocked: __t.isLocked('model', __t.LOOKS.model.opts.bikelete),
      saved: JSON.parse(localStorage.getItem('grau80-look')), achSaved: localStorage.getItem('grau80-ach'), bestSaved: localStorage.getItem('grau80-best') }));
    ok(st.pick.bag === 'aifode' && st.bag === 'aiFudi', 'mochila aiFudi continua escolhida (nome mantido)', st.bag);
    ok(st.pick.model === 'monark' && !st.monarkLocked && st.model === 'Circuleira', 'bike liberada e escolhida continua (agora aparece como Circuleira)', st.model);
    ok(st.pick.frame === 'ferrari' && st.frame === 'Vermelho Foguete', 'cor escolhida continua (agora "Vermelho Foguete")', st.frame);
    ok(!st.xrLocked && st.bikeleteLocked, 'desbloqueios iguais: XRrôna liberada (200 m), Nórdica ainda bloqueada (500 m)');
    ok(JSON.stringify(st.ach) === '["grau100","grau200","grau30"]' && st.achSaved === SAVE['grau80-ach'], 'conquistas intactas', st.ach);
    ok(st.best === 412.3 && st.bestSaved === '412.30', 'recorde intacto', st.best);
    ok(st.owned.includes('mini_pastel') && !st.magroLocked && st.pick.dog === 'magro', 'compra (pastel) preservada: caramelo magrelo liberado e escolhido', st.owned);
    ok(st.saved.bag === 'aifode' && st.saved.model === 'monark' && st.saved.frame === 'ferrari', 'o save não foi reescrito com chaves novas');
    ok(!c.errs.length, 'sem erro de JavaScript', c.errs);
    await c.p.screenshot({ path: path.join(OUT, 'save-antigo-garagem.png') });
    await c.p.close();
  }

  console.log('\nB. As três mochilas, separadamente');
  for (const [bag, name] of [['keetute', 'keetute'], ['aifode', 'aiFudi'], ['rango69', '69 Rango']]) {
    const c = await session({ ...SAVE, 'grau80-look': JSON.stringify({ bag }) }, { dpr: 2 });
    const st = await c.p.evaluate(() => ({ k: __t.pick.bag, n: __t.bag.name, row: [...document.querySelectorAll('#garage *')].map(e => e.textContent).find(t => /Mochila/.test(t)) || '' }));
    ok(st.k === bag && st.n === name && /keetute/.test(st.row) && /aiFudi/.test(st.row) && /69 Rango/.test(st.row), `mochila ${name}: escolhida, e as 3 aparecem na garagem`, st.n);
    await c.p.screenshot({ path: path.join(OUT, `mochila-${bag}.png`) });
    await c.p.evaluate(() => __t.begin('motoca')); await c.tick(5); await c.p.keyboard.type('agenor'); await c.tick(200);
    await c.p.screenshot({ path: path.join(OUT, `mochila-${bag}-grau.png`) });
    ok(!c.errs.length, `sem erro com a ${name}`, c.errs);
    await c.p.close();
  }
  {
    const c = await session({ ...SAVE, 'grau80-look': JSON.stringify({ bag: 'nao-existe' }) });
    ok(await c.p.evaluate(() => __t.pick.bag === 'keetute'), 'chave de mochila desconhecida cai na primeira (keetute), sem erro');
    await c.p.close();
  }

  console.log('\nC. Troca na garagem e gravação');
  {
    const c = await session({ ...SAVE, 'grau80-look': JSON.stringify({ bag: 'keetute' }) });
    const r = await c.p.evaluate(() => {
      const btn = [...document.querySelectorAll('#garage button')].find(x => /69 Rango/.test(x.textContent));
      if (!btn) return 'sem botão'; btn.click();
      return [__t.pick.bag, JSON.parse(localStorage.getItem('grau80-look')).bag].join('/');
    });
    ok(r === 'rango69/rango69', 'tocar em "69 Rango" escolhe e grava a chave própria rango69', r);
    await c.p.close();
  }

  console.log('\nD. Bikes, cores e traduções');
  const NAMES = { caicara: 'Litorânea de cestinha', monark: 'Circuleira', xr: 'XRrôna', bikelete: 'Nórdica', bruno: 'Titânica 99', pop2: 'Pó-pop Bicilíndrica', gs: 'Robozão' };
  for (const [model, name] of Object.entries(NAMES)) {
    const all = JSON.stringify({ grau30: 1, grau100: 1, grau200: 1, grau300: 1, grau500: 1, grau700: 1, grau1000: 1, grau2000: 1, grau3000: 1, grau5000: 1 });
    const c = await session({ ...SAVE, 'grau80-ach': all, 'grau80-look': JSON.stringify({ model, frame: model === 'bruno' ? 'vinho' : undefined, bag: 'rango69' }) }, { dpr: 2 });
    const st = await c.p.evaluate(() => ({ k: __t.pick.model, n: __t.LOOKS.model.opts[__t.pick.model].name }));
    ok(st.k === model && st.n === name, `${name} selecionável`, st.n);
    await c.p.screenshot({ path: path.join(OUT, `bike-${model}.png`) });
    await c.p.close();
  }
  {
    const c = await session(SAVE);
    const st = await c.p.evaluate(() => { const o = __t.LOOKS.frame.opts, k = Object.keys(o); return { k: k.slice(0, 6), azul: o.azul && o.azul.name, verde: o.verde && o.verde.name, rosa: o.rosa && o.rosa.name, cromado: o.cromado && o.cromado.name, first: k[0] }; });
    ok(st.azul === 'Azul royal' && st.verde === 'Verde bandeira' && st.rosa === 'Rosa chiclete' && st.cromado === 'Cromado', 'cores novas de bike: azul, verde, rosa e cromado', st.k);
    ok(st.first === 'ferrari' && st.k.slice(1, 5).join() === 'azul,verde,rosa,cromado', 'as quatro aparecem logo no começo da fileira (sem rolar)', st.k);
    await c.p.close();
    for (const frame of ['azul', 'verde', 'rosa', 'cromado']) {
      const c2 = await session({ ...SAVE, 'grau80-look': JSON.stringify({ model: 'caicara', frame, bag: 'rango69' }) }, { dpr: 2 });
      ok(await c2.p.evaluate(f => __t.pick.frame === f, frame), 'cor ' + frame + ' selecionável e salva');
      await c2.p.screenshot({ path: path.join(OUT, 'cor-' + frame + '.png') });
      await c2.p.close();
    }
  }
  {
    const c = await session({ ...SAVE, 'grau80-ach': JSON.stringify({ grau30: 1, grau100: 1, grau200: 1, grau300: 1, grau500: 1, grau700: 1, grau2000: 1 }) });
    const st = await c.p.evaluate(() => ({ order: Object.keys(__t.LOOKS.model.opts), main: ['bruno', 'pop2', 'gs'].map(k => [].concat(__t.LOOKS.model.opts[k].lock)[0]) }));
    ok(st.main.join() === 'grau700,grau2000,grau3000', 'metragens novas: Titânica 1.000 m, Pó-pop 2.000 m, Robozão 3.000 m', st.main);
    ok(st.order.join() === 'caicara,monark,xr,bikelete,bruno,pop2,gs', 'motos novas vêm depois da Titânica na garagem', st.order);
    await c.p.close();
  }
  // quem já tinha liberado alguma moto continua com ela; e cada metragem libera a moto certa
  for (const [ach, esperado] of [
    [{ grau700: 1 }, { bruno: false, pop2: true, gs: true }],
    [{ grau2000: 1 }, { bruno: false, pop2: false, gs: true }],   // liberou a Titânica com 2.000 m (regra antiga): continua
    [{ grau2000: 1, grau3000: 1 }, { bruno: false, pop2: false, gs: false }],
    [{ grau5000: 1 }, { bruno: true, pop2: true, gs: false }],    // tinha o Robozão pela regra antiga (5.000 m): continua
    [{ grau500: 1 }, { bruno: true, pop2: true, gs: true }]
  ]) {
    const c = await session({ ...SAVE, 'grau80-ach': JSON.stringify(ach) });
    const st = await c.p.evaluate(() => ({ bruno: __t.isLocked('model', __t.LOOKS.model.opts.bruno), pop2: __t.isLocked('model', __t.LOOKS.model.opts.pop2), gs: __t.isLocked('model', __t.LOOKS.model.opts.gs),
      tip: (document.getElementById('look-model-bruno') || {}).title || '' }));
    const okk = st.bruno === esperado.bruno && st.pop2 === esperado.pop2 && st.gs === esperado.gs;
    ok(okk, 'bloqueios com ' + Object.keys(ach).join('+') + ' (true = bloqueada)', { bruno: st.bruno, pop2: st.pop2, gs: st.gs });
    if (st.bruno) ok(/1\.000 m de grau/.test(st.tip), 'a dica da Titânica bloqueada mostra a metragem', st.tip);
    await c.p.close();
  }
  {
    const c = await session(SAVE);
    await c.p.close();
  }
  for (const lang of ['en', 'es']) {
    const c = await session(SAVE, { lang });
    const n = await c.p.evaluate(() => [...document.querySelectorAll('#garage *')].map(e => e.textContent).find(t => /Rocket red|Rojo cohete/.test(t)) || '');
    ok(/Rocket red|Rojo cohete/.test(n), `cor "Vermelho Foguete" traduzida (${lang})`);
    await c.p.close();
  }

  console.log('\nE. Na rua: Uno do racha, Bravona dos ladrões e Guaranazinho');
  {
    const c = await session({ ...SAVE, 'grau80-look': JSON.stringify({ bag: 'rango69' }) });
    await c.p.screenshot({ path: path.join(OUT, 'guaranazinho-menu.png') });
    
    await c.p.evaluate(() => __t.begin('motoca')); await c.tick(5); await c.p.keyboard.type('agenor'); await c.tick(60);
    for (const [name, at] of [['uno', 735], ['uno-fundiu', 806], ['bravona-ladroes', 935], ['bravona-fuga', 604]]) {
      if (name === 'bravona-fuga') { await c.p.close(); break; }
      await c.p.evaluate(at => { __t.s.wStart -= at - 40 - __t.s.wDist; }, at);
      for (let i = 0; i < 900 && (await c.p.evaluate(() => __t.s.wDist)) < at; i++) await c.tick(5);
      await c.tick(10);
      await c.p.screenshot({ path: path.join(OUT, name + '.png') });
    }
    const c2 = await session(SAVE);
    await c2.p.evaluate(() => __t.begin('motoca')); await c2.tick(5); await c2.p.keyboard.type('agenor'); await c2.tick(60);
    await c2.p.evaluate(() => { __t.s.wStart -= 563 - __t.s.wDist; });
    for (let i = 0; i < 900 && (await c2.p.evaluate(() => __t.s.wDist)) < 603; i++) await c2.tick(5);
    await c2.tick(8); await c2.p.screenshot({ path: path.join(OUT, 'bravona-fuga.png') });
    // fim da volta perdendo o racha pro Uno (a frase é do jogo, fica em português)
    await c2.p.close();
    const c3 = await session(SAVE);
    await c3.p.evaluate(() => __t.begin('motoca')); await c3.tick(5); await c3.p.keyboard.type('agenor'); await c3.tick(60);
    await c3.p.evaluate(() => { __t.s.wStart -= 700 - __t.s.wDist; });
    for (let i = 0; i < 900 && (await c3.p.evaluate(() => __t.s.wDist)) < 745; i++) await c3.tick(5);
    await c3.p.evaluate(() => { if (__t.cheat) __t.toggleCheat(); __t.s.th = 1.7; });
    for (let i = 0; i < 600 && !(await c3.p.evaluate(() => __t.s.mode === 'over')); i++) await c3.tick(5);
    await wait(1500); await c3.tick(10);
    const fim = await c3.p.evaluate(() => [document.getElementById('endEyebrow').textContent, document.getElementById('endTitle').textContent]);
    ok(fim[0] === 'O Uno ganhou o racha', 'fim da volta no racha: "O Uno ganhou o racha"', fim);
    await c3.p.screenshot({ path: path.join(OUT, 'fim-uno.png') });
    ok(!c3.errs.length, 'sem erro de JavaScript na rua', c3.errs);
    await c3.p.close();
  }

  console.log('\nF. Nenhum nome de marca real visível no texto da página');
  {
    const c = await session({ ...SAVE, 'grau80-ach': JSON.stringify({ grau30: 1, grau100: 1, grau200: 1, grau300: 1, grau500: 1, grau700: 1, grau1000: 1, grau2000: 1 }) });
    const txt = await c.p.evaluate(() => document.body.innerText + ' ' + [...document.querySelectorAll('[title],[aria-label]')].map(e => (e.title || '') + ' ' + (e.getAttribute('aria-label') || '')).join(' '));
    const achou = (txt.match(/Monark|Bikelete|Caiçara|Titan|CB 99|CG 160|Motorizada XR|Ferrari|Dolly|Pol[ií]cia|PMSC|Rocam|ROCAM|viatura/g) || []);
    ok(!achou.length, 'texto visível da tela inicial (garagem completa) sem marcas reais', achou);
    await c.p.close();
  }
  console.log(`\n${pass} ok, ${fail} falha(s)   capturas em ${OUT}`);
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
