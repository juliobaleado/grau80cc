// Onboarding (27/11/2026): apelido na tela de idade, tour dos menus e demonstração de como jogar com o piloto automático.
// Confere jogador novo, antigo com e sem apelido, menor de 13, pular, rever, fechar no meio, minimizar, idioma, controles
// trocados, celular deitado, sala de multiplayer e que a demonstração não grava recorde, conquista nem pede bilhete do placar.
// Sem rede: o WebSocket é falso e toda requisição externa responde 404 (as tentativas de bilhete do placar são contadas).
// Uso: node testes/onboarding.cjs [pasta-das-capturas]
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'play-store', 'onboarding');
fs.mkdirSync(OUT, { recursive: true });
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const j = html.lastIndexOf('})();');
html = html.slice(0, j) + 'window.__t={get s(){return s},TUT,BT,input,get gameMode(){return gameMode},get best(){return best},get paused(){return paused},room,recordWheelie,get KID(){return KID},get myName(){return myName},get LANG(){return LANG},tutSeen};\n' + html.slice(j);
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html); }).listen(8853);
let pass = 0, fail = 0;
const ok = (c, n, x) => { c ? pass++ : fail++; console.log((c ? '  ok    ' : '  FALHA ') + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const DONE = '{"menuTutorialVersion":1,"gameplayTutorialVersion":1}';
const OLD = { 'grau80-novidades': 'welcome-1', 'grau80-nasc': '1990', 'grau80-nome': 'Veterano', 'grau80-instrucoes': 'fechado', 'grau80-best': '412.30', 'grau80-best-livre': '88.10',
  'grau80-ach': JSON.stringify({ grau30: 1, grau100: 1 }), 'grau80-look': JSON.stringify({ model: 'monark', frame: 'ferrari', dog: 'patinete' }), 'grau80-testador': '1' };

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--mute-audio'] });
  async function session(save, { vw = 1280, vh = 720, touch = false, keep = null } = {}) {
    const ctx = keep || await b.createBrowserContext();
    const p = await ctx.newPage();
    const errs = [], tickets = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', q => { if (q.url().includes('grau_iniciar')) tickets.push(q.url()); q.url().startsWith('http://127.0.0.1') ? q.continue() : q.respond({ status: 404, body: '' }); });
    await p.setViewport({ width: vw, height: vh, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
    if (save) await p.evaluateOnNewDocument(save => {
      window.WebSocket = class { constructor() { this.readyState = 0; } send() {} close() {} };
      if (!sessionStorage.getItem('semeado')) { sessionStorage.setItem('semeado', '1'); localStorage.clear(); for (const [k, v] of Object.entries(save)) localStorage.setItem(k, v); }
    }, save);
    else await p.evaluateOnNewDocument(() => { window.WebSocket = class { constructor() { this.readyState = 0; } send() {} close() {} }; });
    await p.goto('http://127.0.0.1:8853/'); await wait(1300);
    return { p, ctx, errs, tickets };
  }
  const st = p => p.evaluate(() => ({ tut: !document.getElementById('tut').hidden, jogo: document.getElementById('tut').classList.contains('jogo'), on: __t.TUT.on, kind: __t.TUT.kind, i: __t.TUT.i, n: __t.TUT.steps.length,
    title: document.getElementById('tutTitle').textContent, next: document.getElementById('tutNext').textContent, age: !document.getElementById('ageModal').hidden,
    yearF: !document.getElementById('ageYearF').hidden, nameF: !document.getElementById('ageNameF').hidden, mode: __t.s.mode, gm: __t.gameMode,
    store: localStorage.getItem('grau80-tutorial'), start: !document.getElementById('startScreen').hidden }));
  const inView = p => p.evaluate(() => { const c = document.getElementById('tutCard').getBoundingClientRect(), hl = document.getElementById('tutHole');
    const hr = hl.classList.contains('none') ? null : hl.getBoundingClientRect();
    const inside = r => r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
    return { card: inside(c), hole: !hr || inside(hr) }; });

  // 1. jogador novo: ano + apelido, palavrão barrado, tour completo
  {
    console.log('— jogador novo (sem nada salvo)');
    const { p, errs } = await session({});
    let s = await st(p);
    ok(s.age && s.yearF && !s.nameF, 'tela de idade com o ano; apelido só aparece depois do ano', s);
    ok(!s.tut, 'tour espera a tela de idade');
    await p.select('#ageYear', '1995'); await wait(100);
    s = await st(p); ok(s.nameF, 'escolheu o ano: aparece "Como podemos te chamar?"');
    await p.screenshot({ path: path.join(OUT, '01-idade-apelido.png') });
    await p.type('#ageName', 'porra'); await p.click('#ageOk'); await wait(150);
    ok(await p.$eval('#ageNameErr', e => e.textContent.length > 0) && (await st(p)).age, 'apelido proibido é barrado com a validação do placar');
    await p.$eval('#ageName', e => { e.value = ''; }); await p.type('#ageName', 'Zezinho'); await p.click('#ageOk'); await wait(900);
    s = await st(p);
    const ls = await p.evaluate(() => [localStorage.getItem('grau80-nome'), localStorage.getItem('grau80-nasc'), localStorage.getItem('grau80-nome-pedido'), __t.myName]);
    ok(ls[0] === 'Zezinho' && ls[1] === '1995' && ls[2] === '1' && ls[3] === 'Zezinho', 'nome salvo no mesmo grau80-nome do placar/multiplayer', ls);
    ok(s.tut && s.kind === 'menu' && s.n === 10, 'tour dos menus abre sozinho com 10 etapas', s.n);
    const titles = [];
    for (let i = 0; i < s.n; i++) {
      const v = await inView(p); const cur = await st(p); titles.push(cur.title);
      ok(v.card && v.hole, `etapa ${i + 1} "${cur.title}" dentro da tela`, v);
      await p.screenshot({ path: path.join(OUT, `02-menu-${String(i + 1).padStart(2, '0')}.png`) });
      if (i < s.n - 1) { await p.click('#tutNext'); await wait(350); }
    }
    s = await st(p); ok(s.next === 'Bora jogar!', 'última etapa com "Bora jogar!"', s.next);
    await p.click('#tutBack'); await wait(250); ok((await st(p)).i === s.n - 2, 'Voltar funciona');
    await p.keyboard.press('ArrowRight'); await wait(250); ok((await st(p)).i === s.n - 1, 'seta → avança');
    await p.click('#tutNext'); await wait(300);
    s = await st(p);
    ok(!s.tut && !s.on && s.mode === 'ready' && s.start, 'terminou: overlay some, continua na tela inicial (não começa partida)', s);
    ok(s.store === '{"menuTutorialVersion":1,"gameplayTutorialVersion":0}', 'grava só a versão do tour dos menus', s.store);
    ok(!errs.length, 'sem erro de página', errs);
    await p.close();
  }
  // 2. menor de 13: sem campo de apelido e sem a etapa de doação
  {
    console.log('— menor de 13');
    const { p } = await session({});
    await p.select('#ageYear', String(new Date().getFullYear() - 9)); await wait(100);
    ok(!(await st(p)).nameF, 'menor de 13: campo de apelido escondido');
    await p.click('#ageOk'); await wait(900);
    const s = await st(p);
    ok(await p.evaluate(() => __t.KID) && s.on && s.n === 9, 'tour sem a etapa do pastel (9 etapas)', s.n);
    ok(await p.evaluate(() => localStorage.getItem('grau80-nome') === null), 'não grava nome pra criança');
    await p.close();
  }
  // 3. jogador antigo com ano e nome: nada de tela de idade; dados preservados; tour aparece
  {
    console.log('— jogador antigo com ano e apelido');
    const { p, errs } = await session(OLD);
    const s = await st(p);
    ok(!s.age, 'não pergunta ano nem apelido de novo');
    ok(s.on && s.kind === 'menu', 'recebe o tour novo dos menus');
    const keep = await p.evaluate(() => ['grau80-nome', 'grau80-best', 'grau80-best-livre', 'grau80-ach', 'grau80-look', 'grau80-testador'].map(k => localStorage.getItem(k)));
    ok(keep[0] === 'Veterano' && keep[1] === '412.30' && keep[2] === '88.10' && keep[3] === OLD['grau80-ach'] && keep[5] === '1', 'nome, recordes, conquistas e caramelo de patinete preservados', keep);
    // pular com Esc
    await p.keyboard.press('Escape'); await wait(200);
    ok(!(await st(p)).on && (await st(p)).store.includes('"menuTutorialVersion":1'), 'Esc pula o tour e grava como apresentado');
    ok(!errs.length, 'sem erro de página', errs);
    await p.close();
  }
  // 4. antigo sem apelido: só o campo de apelido; vazio é permitido (continua convidado)
  {
    console.log('— jogador antigo sem apelido');
    const { p } = await session({ 'grau80-nasc': '1990', 'grau80-instrucoes': 'fechado', 'grau80-novidades': 'welcome-1' });
    let s = await st(p);
    ok(s.age && !s.yearF && s.nameF, 'pergunta só o apelido (o ano já está salvo)', s);
    await p.click('#ageOk'); await wait(900);
    s = await st(p);
    ok(!s.age && await p.evaluate(() => localStorage.getItem('grau80-nome-pedido') === '1' && !localStorage.getItem('grau80-nome')), 'apelido vazio aceito, não pergunta de novo');
    ok(s.on && s.kind === 'menu', 'e então vem o tour');
    await p.close();
  }
  // 5. fechar no meio não conta; pular conta; reabrir depois de pular não mostra de novo
  {
    console.log('— fechar no meio, pular e reabrir');
    const ctx = await b.createBrowserContext();
    const a = await session(OLD, { keep: ctx });
    await a.p.click('#tutNext'); await wait(200);
    await a.p.reload(); await wait(1300);
    ok((await st(a.p)).on, 'recarregou no meio do tour: aparece de novo (não registrou)');
    await a.p.click('#tutSkip'); await wait(200);
    await a.p.reload(); await wait(1300);
    ok(!(await st(a.p)).on, 'depois de pular, não aparece mais sozinho');
    await a.p.close(); await ctx.close();
  }
  // 6. demonstração de como jogar pela primeira entrada no Modo Motoca
  {
    console.log('— primeira entrada no Modo Motoca: demonstração');
    const { p, errs, tickets } = await session({ ...OLD, 'grau80-tutorial': '{"menuTutorialVersion":1}' });
    const before = await p.evaluate(() => [localStorage.getItem('grau80-best'), localStorage.getItem('grau80-best-livre'), localStorage.getItem('grau80-ach'), localStorage.getItem('grau80-mode')]);
    await p.click('#goStart'); await wait(400);
    let s = await st(p);
    ok(s.on && s.kind === 'jogo' && s.jogo && s.mode === 'ride' && s.n === 8, 'Modo Motoca abre a demonstração (8 etapas) em vez da partida', s);
    ok(await p.$eval('#tutBot', e => !e.hidden) && await p.$eval('#hudMode', e => e.textContent.includes('Tutorial')), 'avisa que é demonstração automática');
    // o jogador aperta acelerador e freio: não muda nada
    await p.keyboard.down('ArrowDown'); await wait(300);
    ok(await p.evaluate(() => __t.input.brake === __t.TUT.brake && __t.input.gas === __t.TUT.gas), 'comandos do jogador ignorados na demonstração');
    await p.keyboard.up('ArrowDown');
    await wait(4500);
    ok(await p.evaluate(() => __t.s.th > 0.4), 'o piloto automático empinou de verdade (física real)', await p.evaluate(() => +(__t.s.th * 57.3).toFixed(0)));
    await p.screenshot({ path: path.join(OUT, '03-jogo-01.png') });
    for (let i = 1; i < 8; i++) {
      await p.click('#tutNext'); await wait(i < 5 ? 4500 : 1500);
      const v = await inView(p);
      ok(v.card && v.hole, `demonstração etapa ${i + 1} "${(await st(p)).title}" dentro da tela`, v);
      await p.screenshot({ path: path.join(OUT, `03-jogo-${String(i + 1).padStart(2, '0')}.png`) });
    }
    const mid = await p.evaluate(() => [localStorage.getItem('grau80-best'), localStorage.getItem('grau80-best-livre'), localStorage.getItem('grau80-ach'), localStorage.getItem('grau80-mode')]);
    ok(JSON.stringify(mid) === JSON.stringify(before), 'demonstração não grava recorde, conquista nem modo', mid);
    ok(tickets.length === 0, 'nenhum bilhete do placar pedido durante a demonstração', tickets.length);
    ok((await st(p)).next === 'Vamos dar grau!', 'última etapa: "Vamos dar grau!"');
    await p.click('#tutNext'); await wait(600);
    s = await st(p);
    ok(!s.on && !s.tut && s.mode === 'ride' && s.gm === 'motoca', 'entrega os controles: partida de verdade no Modo Motoca', s);
    ok(await p.evaluate(() => __t.s.x < 5 && __t.s.wDist === 0), 'moto e contador reiniciados');
    ok(tickets.length === 1, 'agora sim pede o bilhete do placar (partida real)', tickets.length);
    await wait(1500);
    ok(await p.evaluate(() => !__t.input.gas && !__t.input.brake && __t.s.thr < 0.05), 'nenhum comando automático depois da demonstração');
    ok(s.store === DONE, 'grava a versão do tutorial de como jogar', s.store);
    // recorde normal depois do tutorial
    const rec = await p.evaluate(() => { __t.s.active = true; __t.s.wDist = 500; const r = __t.recordWheelie(); return [r && r.rec, localStorage.getItem('grau80-best')]; });
    ok(rec[0] === true && rec[1] === '500.00', 'recorde volta a gravar normalmente', rec);
    ok(!errs.length, 'sem erro de página', errs);
    await p.close();
  }
  // 7. primeira entrada pelo Modo Livre; pular entrega a partida; depois Motoca não repete
  {
    console.log('— primeira entrada no Modo Livre + pular');
    const { p } = await session({ ...OLD, 'grau80-tutorial': '{"menuTutorialVersion":1}' });
    await p.click('#goFree'); await wait(400);
    ok((await st(p)).kind === 'jogo', 'Modo Livre também abre a demonstração');
    await p.click('#tutSkip'); await wait(400);
    let s = await st(p);
    ok(!s.on && s.mode === 'ride' && s.gm === 'livre' && s.store === DONE, 'pular: grava e começa a partida no Modo Livre', s);
    await p.keyboard.press('Escape'); await wait(300);
    await p.click('#goStart'); await wait(400);
    s = await st(p); ok(!s.on && s.gm === 'motoca' && s.mode === 'ride', 'depois Motoca não repete a demonstração');
    await p.close();
  }
  // 8. sair no meio (Esc) não conta; minimizar pausa; voltar continua
  {
    console.log('— sair no meio, minimizar e voltar');
    const { p } = await session({ ...OLD, 'grau80-tutorial': '{"menuTutorialVersion":1}' });
    await p.click('#goStart'); await wait(2500);
    await p.evaluate(() => window.grauAway(true)); await wait(300);
    let pz = await p.evaluate(() => [__t.paused, getComputedStyle(document.getElementById('tut')).display]);
    ok(pz[0] === true && pz[1] === 'none', 'minimizou: demonstração pausa e o cartão sai da frente', pz);
    const th1 = await p.evaluate(() => __t.s.x); await wait(800);
    ok(await p.evaluate(x => __t.s.x === x, th1), 'pausado de verdade (a moto não anda)');
    await p.evaluate(() => window.grauAway(false)); await wait(200);
    await p.click('#goResume'); await wait(800);
    ok(await p.evaluate(() => !__t.paused && __t.TUT.on && getComputedStyle(document.getElementById('tut')).display !== 'none'), 'continuar: a demonstração segue');
    await p.keyboard.press('Escape'); await wait(300);
    const s = await st(p);
    ok(!s.on && s.start && s.gm === 'motoca' && !s.store.includes('gameplay'), 'Esc no meio: volta pro início sem registrar', s);
    await p.click('#goStart'); await wait(300);
    ok((await st(p)).kind === 'jogo', 'próxima entrada mostra a demonstração de novo');
    await p.close();
  }
  // 9. rever pelo menu (Como jogar), sala de multiplayer e preferências intactas
  {
    console.log('— rever, multiplayer e preferências');
    const { p, tickets } = await session({ ...OLD, 'grau80-tutorial': DONE, 'grau80-musica': '0', 'grau80-lang': 'en',
      'grau80-controles': JSON.stringify({ touch: 'tela', side: 'dir', area: 50, size: 100, pull: 'freio', mouse: 'normal', keys: { gas: ['KeyJ', '', ''], brake: ['KeyK', '', ''], pull: ['KeyL', '', ''] }, pad: { gas: [7, 0, 12], brake: [6, 1, 13], pull: [2, 5, -1] } }) });
    ok(!(await st(p)).on, 'quem já viu os dois não recebe nada sozinho');
    await p.click('#tutMenuBtn'); await wait(400);
    let s = await st(p);
    ok(s.on && s.kind === 'menu' && s.title === 'Welcome to Grau 80cc!', 'rever o tour dos menus, em inglês', s.title);
    await p.click('#tutSkip'); await wait(200);
    await p.click('#tutJogoBtn'); await wait(500);
    s = await st(p);
    const chips = await p.evaluate(() => [...document.querySelectorAll('.tut-keys span')].map(e => e.textContent));
    ok(s.kind === 'jogo' && chips[0] === 'Throttle · J' && chips[1].endsWith('· K') && chips[2].endsWith('· L'), 'chips mostram as teclas que o jogador configurou', chips);
    await p.click('#tutSkip'); await wait(400);
    s = await st(p);
    ok(!s.on && s.start && s.mode === 'ready', 'pular ao rever: volta pra tela inicial', s);
    ok(s.store === DONE && await p.evaluate(() => localStorage.getItem('grau80-musica') === '0' && localStorage.getItem('grau80-lang') === 'en'), 'rever não muda o progresso nem as preferências');
    ok(tickets.length === 0, 'rever não pede bilhete do placar');
    // dentro de uma sala o tutorial não abre
    await p.evaluate(() => { __t.room.code = 'ABCD'; }); await p.click('#tutJogoBtn'); await wait(200);
    ok(!(await st(p)).on, 'numa sala o tutorial não abre (não atrapalha o multiplayer)');
    await p.close();
  }
  // 10. celular deitado (toque): tour e demonstração cabem na tela
  {
    console.log('— celular deitado');
    for (const [w, hh] of [[740, 360], [844, 390], [1024, 600]]) {
      const { p, errs } = await session({ ...OLD, 'grau80-tutorial': '{}' }, { vw: w, vh: hh, touch: true });
      let s = await st(p);
      let all = true;
      for (let i = 0; i < s.n; i++) { const v = await inView(p); if (!v.card || !v.hole) all = false; if (i === 1 || i === 5) await p.screenshot({ path: path.join(OUT, `04-cel-${w}-menu-${i + 1}.png`) }); await p.click('#tutNext'); await wait(300); }
      ok(all, `${w}x${hh}: todas as etapas do tour dentro da tela`);
      await p.evaluate(() => document.getElementById('goStart').click()); await wait(3500);
      const chips = await p.evaluate(() => document.getElementById('tkGas').textContent);
      ok((await inView(p)).card && /tela|screen/.test(chips), `${w}x${hh}: demonstração cabe e explica o toque`, chips);
      await p.screenshot({ path: path.join(OUT, `05-cel-${w}-jogo.png`) });
      ok(!errs.length, 'sem erro de página', errs);
      await p.close();
    }
  }
  console.log(`\n${pass} ok, ${fail} falha(s)   capturas em ${OUT}`);
  await b.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
