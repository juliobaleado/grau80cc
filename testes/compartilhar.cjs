// Compartilhamento (27/11/2026): imagens de recorde, conquista, coleção e convite (quadrado e stories), compartilhar do
// navegador (Web Share) e do app (plugin GrauShare), WhatsApp, salvar, copiar link/código e o convite por link (?sala=).
// Sem rede. Uso: node testes/compartilhar.cjs [pasta-das-capturas]
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'play-store', 'compartilhar');
fs.mkdirSync(OUT, { recursive: true });
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const j = html.lastIndexOf('})();');
html = html.slice(0, j) + 'window.__t={get s(){return s},begin,finish,room,TUT,get KID(){return KID},get rideShot(){return rideShot},get shSnap(){return shSnap}};\n' + html.slice(j);
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; if (u.startsWith('/img/') && fs.existsSync(path.join(__dirname, '..', u))) { r.writeHead(200, { 'content-type': 'image/webp' }); return r.end(fs.readFileSync(path.join(__dirname, '..', u))); } r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html); }).listen(8858);
let pass = 0, fail = 0;
const ok = (c, n, x) => { c ? pass++ : fail++; console.log((c ? '  ok    ' : '  FALHA ') + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const BASE = { 'grau80-nasc': '1990', 'grau80-nome': 'Zezinho', 'grau80-instrucoes': 'fechado', 'grau80-nome-pedido': '1', 'grau80-novidades': 'welcome-1', 'grau80-tutorial': '{"menuTutorialVersion":2,"gameplayTutorialVersion":1}',
  'grau80-ach': JSON.stringify({ grau30: true, w_azeitona: true }), 'grau80-best': '312.40', 'grau80-best-livre': '50.00', 'grau80-stats': '{"runs":40}' };
const saveImg = (url, f) => fs.writeFileSync(path.join(OUT, f), Buffer.from(url.split(',')[1], 'base64'));

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio'] });
  async function session(save, { vw = 1280, vh = 720, touch = false, native = false, url = '' } = {}) {
    const p = await (await b.createBrowserContext()).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', q => q.url().startsWith('http://127.0.0.1') ? q.continue() : q.respond({ status: 404, body: '' }));
    await p.setViewport({ width: vw, height: vh, hasTouch: touch, isMobile: touch });
    await p.evaluateOnNewDocument((save, native) => {
      window.WebSocket = class { send() {} close() {} };
      window.__log = { share: null, open: null, clip: null, nat: null };
      navigator.canShare = () => true; navigator.share = async d => { window.__log.share = { files: (d.files || []).length, text: d.text, noToque: !!window.__toque }; };
      document.addEventListener('click', () => { window.__toque = true; setTimeout(() => { window.__toque = false; }, 0); }, true);
      try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__log.clip = t; } } }); } catch (e) {}
      window.open = u => { window.__log.open = u; return null; };
      if (native) window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', registerPlugin: n => n === 'GrauShare'
        ? { share: async d => { window.__log.nat = { len: (d.data || '').length, text: d.text }; } }
        : { getProducts: async () => ({ products: [] }), getPurchases: async () => ({ purchases: [] }) } };
      for (const [k, v] of Object.entries(save)) localStorage.setItem(k, v);
    }, save, native);
    await p.goto('http://127.0.0.1:8858/' + url); await wait(1400);
    return { p, errs };
  }
  const log = p => p.evaluate(() => window.__log);
  const dims = p => p.evaluate(() => new Promise(r => { const i = new Image(); i.onload = () => r([i.width, i.height]); i.src = document.getElementById('shImg').src; }));

  console.log('— recorde (navegador)');
  const { p, errs } = await session(BASE);
  await p.evaluate(async () => { __t.begin('motoca'); __t.s.active = true; __t.s.wDist = 120; __t.finish('landed'); await new Promise(r => setTimeout(r, 1000)); });
  ok(await p.$eval('#goShare', e => !e.hidden), 'fim de volta tem Compartilhar');
  await p.click('#goShare'); await wait(600);
  ok(await p.$eval('#shModal', e => !e.hidden) && JSON.stringify(await dims(p)) === '[1080,1080]', 'prévia quadrada 1080×1080');
  saveImg(await p.$eval('#shImg', e => e.src), 'recorde-quadrado.png');
  await p.click('#shFmt button[data-f="st"]'); await wait(300);
  ok(JSON.stringify(await dims(p)) === '[1080,1920]', 'formato stories 1080×1920');
  saveImg(await p.$eval('#shImg', e => e.src), 'recorde-stories.png');
  await p.click('#shShare'); await wait(300);
  let L = await log(p);
  ok(L.share && L.share.noToque, 'abre a janela de compartilhar do Android direto no toque (sem espera antes)', L.share);
  ok(L.share && L.share.files === 1 && /312.4 m/.test(L.share.text) && L.share.text.includes('juliobaleado.github.io/grau80cc') && !L.share.text.includes('Zezinho'), 'compartilha imagem + texto (recorde e link, sem o apelido no texto)', L.share);
  await p.click('#shWa'); await wait(100); L = await log(p);
  ok(L.open && L.open.startsWith('https://wa.me/?text=') && !L.open.includes('Zezinho'), 'WhatsApp com a mensagem pronta, sem dado pessoal na URL', L.open && L.open.slice(0, 60));
  await p.click('#shLink'); await wait(100); L = await log(p);
  ok(L.clip === 'https://juliobaleado.github.io/grau80cc/' && /copiado/.test(await p.$eval('#shMsg', e => e.textContent)), 'copiar link');
  await p.click('#shSave'); await wait(200);
  ok(/salva/.test(await p.$eval('#shMsg', e => e.textContent)), 'salvar imagem (download)');
  await p.keyboard.press('Escape'); await wait(200);
  ok(await p.$eval('#shModal', e => e.hidden), 'Esc fecha');
  await p.click('#goGarage'); await wait(300);

  // foto do recorde: o quadro guardado enquanto ainda empinava (não a queda)
  const foto = await p.evaluate(async () => { __t.begin('livre'); __t.s.active = true; __t.s.th = 0.9; __t.s.om = 0;
    await new Promise(r => setTimeout(r, 700)); const tinha = !!(__t.rideShot && __t.rideShot.ok);
    __t.s.th = 1.7; __t.finish('flip'); await new Promise(r => setTimeout(r, 1300)); document.getElementById('goShare').click(); await new Promise(r => setTimeout(r, 500));
    return { tinha, usou: __t.shSnap === __t.rideShot }; });
  ok(foto.tinha && foto.usou, 'compartilhar recorde usa o quadro de quando ainda estava empinando', foto);
  const pics = await p.evaluate(() => [...document.querySelectorAll('#shPic button')].filter(b => !b.hidden).map(b => b.textContent + (b.getAttribute('aria-selected') === 'true' ? '*' : '')));
  ok(JSON.stringify(pics) === '["Empinando*","Caindo","Caramelo"]', 'escolhe a foto: empinando (padrão), caindo ou o Caramelo', pics);
  const src0 = await p.$eval('#shImg', e => e.src);
  await p.click('#shPic button[data-p="caramelo"]'); await wait(300);
  const src1 = await p.$eval('#shImg', e => e.src);
  ok(src1 !== src0 && await p.$eval('#shPic button[data-p="caramelo"]', b => b.getAttribute('aria-selected') === 'true'), 'foto do Caramelo troca a imagem');
  saveImg(src1, 'recorde-caramelo.png');
  await p.click('#shPic button[data-p="cena"]'); await wait(300);
  ok(await p.evaluate(() => __t.shSnap !== __t.rideShot), 'foto "Caindo" usa a cena da queda');
  saveImg(await p.$eval('#shImg', e => e.src), 'recorde-caindo.png');
  await p.click('#shShare'); await wait(300);
  ok((await log(p)).share.files === 1, 'compartilha a foto escolhida');
  await p.keyboard.press('Escape'); await p.evaluate(() => document.getElementById('goGarage').click()); await wait(300);
  console.log('— conquista e coleção');
  await p.click('#goAch'); await wait(300);
  await p.click('.achc.got .ashare'); await wait(600);
  ok(await p.$eval('#shTitle', e => e.textContent) === 'Compartilhar conquista', 'compartilhar uma conquista liberada pelo modal');
  saveImg(await p.$eval('#shImg', e => e.src), 'conquista.png');
  await p.keyboard.press('Escape'); await wait(200);
  ok(await p.evaluate(() => document.querySelectorAll('.achc:not(.got) .ashare').length === 0), 'bloqueada não tem botão de compartilhar');
  await p.click('#achShareAll'); await wait(600);
  await p.click('#shShare'); await wait(200); L = await log(p);
  ok(/2 de 21 conquistas/.test(L.share.text), 'coleção com os números reais', L.share.text);
  saveImg(await p.$eval('#shImg', e => e.src), 'colecao.png');
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await wait(200);

  console.log('— convite');
  await p.evaluate(() => { __t.room.code = 'QWER'; document.getElementById('mpInvite').click(); }); await wait(600);
  ok(await p.$eval('#shCode', e => !e.hidden), 'convite tem Copiar código');
  await p.click('#shCode'); await wait(100); L = await log(p);
  ok(L.clip === 'QWER', 'copia o código da sala');
  await p.click('#shLink'); await wait(100); L = await log(p);
  ok(L.clip === 'https://juliobaleado.github.io/grau80cc/?sala=QWER', 'link de convite com a sala', L.clip);
  saveImg(await p.$eval('#shImg', e => e.src), 'convite.png');
  await p.evaluate(() => { __t.room.code = ''; });
  ok(!errs.length, 'sem erro de página', errs);
  await p.close();

  console.log('— app (plugin nativo)');
  const n = await session(BASE, { native: true });
  await n.p.evaluate(async () => { __t.begin('motoca'); __t.s.active = true; __t.s.wDist = 120; __t.finish('landed'); await new Promise(r => setTimeout(r, 1000)); document.getElementById('goShare').click(); });
  await wait(600);
  ok(await n.p.$eval('#shSave', e => e.hidden), 'no app o Salvar some (o menu do Android já salva)');
  await n.p.click('#shShare'); await wait(200); L = await log(n.p);
  ok(L.nat && L.nat.len > 10000 && /312.4 m/.test(L.nat.text), 'manda o PNG pro menu de compartilhar do Android', L.nat && L.nat.len);
  ok(!n.errs.length, 'sem erro de página', n.errs);
  await n.p.close();

  console.log('— convite por link');
  const v = await session(BASE, { url: '?sala=wxyz' });
  let st = await v.p.evaluate(() => ({ mp: !document.getElementById('mpModal').hidden, code: document.getElementById('mpCode').value, msg: document.getElementById('mpMsg').textContent, url: location.search, tut: __t.TUT.on }));
  ok(st.mp && st.code === 'WXYZ' && /WXYZ/.test(st.msg) && st.url === '' && !st.tut, 'abre o Multiplayer com o código, limpa a URL e não abre o tour junto', st);
  await v.p.close();
  const nv = await session({}, { url: '?sala=ABCD' });
  st = await nv.p.evaluate(() => ({ age: !document.getElementById('ageModal').hidden, mp: !document.getElementById('mpModal').hidden }));
  ok(st.age && !st.mp, 'jogador novo: tela de idade primeiro', st);
  await nv.p.select('#ageYear', '1995'); await nv.p.type('#ageName', 'Novato'); await nv.p.click('#ageOk'); await wait(700);
  st = await nv.p.evaluate(() => ({ mp: !document.getElementById('mpModal').hidden, code: document.getElementById('mpCode').value, nome: document.getElementById('mpName').value }));
  ok(st.mp && st.code === 'ABCD' && st.nome === 'Novato', 'depois da idade: Multiplayer com o código e o apelido', st);
  await nv.p.close();
  const bad = await session(BASE, { url: '?sala=<script>' });
  ok(await bad.p.$eval('#mpModal', e => e.hidden), 'código inválido no link é ignorado');
  await bad.p.close();

  console.log('— celular');
  const c = await session(BASE, { vw: 740, vh: 360, touch: true });
  await c.p.evaluate(async () => { __t.begin('motoca'); __t.s.active = true; __t.s.wDist = 120; __t.finish('landed'); await new Promise(r => setTimeout(r, 1000)); document.getElementById('goShare').click(); });
  await wait(700);
  const r = await c.p.evaluate(() => { const k = document.querySelector('.shcard').getBoundingClientRect(), b = document.getElementById('shShare').getBoundingClientRect();
    return { cabe: k.top >= 0 && k.bottom <= innerHeight + 1 && k.right <= innerWidth + 1, botao: b.bottom <= innerHeight && b.right <= innerWidth }; });
  ok(r.cabe && r.botao, '740×360: prévia e botões cabem', r);
  await c.p.screenshot({ path: path.join(OUT, 'modal-740x360.png') });
  await c.p.close();
  console.log(`\n${pass} ok, ${fail} falha(s)   capturas em ${OUT}`);
  await b.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
