// Trailer V2 · passo 2: monta os quadros 2x (captura-v2.cjs) com câmera que acompanha a ação, legendas,
// destaque da transformação e a música do projeto. Gera grau80cc-trailer-v2-16x9.mp4 e grau80cc-trailer-v2-9x16.mp4.
// Os V1 não são tocados. Pra editar: PLANO (ordem e trechos das cenas), LEGENDAS e as funções de câmera alvoH/alvoV.
// Uso: node trailer/monta-v2.cjs [pasta-dos-quadros] [pasta-de-saída]
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = path.join(__dirname, '..');
const FR = process.argv[2] || path.join(ROOT, 'play-store', 'trailer', 'v2', 'quadros');
const OUT = process.argv[3] || path.join(ROOT, 'play-store', 'trailer', 'v2');
const FPS = 30;
const meta = s => JSON.parse(fs.readFileSync(path.join(FR, s, 'meta.json'), 'utf8'));
const M = { A: meta('A'), B: meta('B'), C: meta('C'), D: meta('D'), E: meta('E'), F: meta('F') };
const SWAP = M.D.findIndex(x => x.m === 'dog');                 // quadro em que o jogador vira caramelo (troca real do jogo)
const FLIP = M.D.findIndex(x => x.flip);
const CUT = M.D.findIndex(x => x.cut);
const BACK = M.D.findIndex((x, i) => i > CUT && x.m === 'ride');
if (SWAP < 0 || CUT < 0 || BACK < 0) throw new Error('a cena D não tem troca/corte/volta: recapture com SEG=D');

// ---------------- plano: cada item é um quadro de saída ----------------
const plan = [];
const push = (seg, from, to, tag) => { for (let i = from; i <= to; i++) plan.push({ seg, i, tag, m: M[seg][i] }); };
push('A', 0, 71, 'A');                      // 0–2,4 s  galera no grau
push('D', SWAP - 6, SWAP + 11, 'G');        // 2,4–3 s  vislumbre da transformação (câmera lenta real)
push('B', 0, 149, 'B');                     // 3–8 s    grau + Caravana da D.U.R.O.
push('C', 0, 149, 'C');                     // 8–13 s   multiplayer
push('D', 14, SWAP, 'D');                   // 13 s…    a transformação
for (let k = 0; k < 9; k++) plan.push({ seg: 'D', i: SWAP, tag: 'D', hold: true, m: M.D[SWAP] }); // congela 0,3 s no "peraí"
push('D', SWAP + 1, 249, 'D');
push('E', 0, 119, 'E');                     // garagem
push('F', 0, 44, 'F');                      // caramelos especiais
push('F', 45, 149, 'Z');                    // encerramento
const at = (seg, i, tag) => plan.findIndex(p => p.seg === seg && p.i === i && (!tag || p.tag === tag) && !p.hold);
const T = f => f / FPS;
const tA = 0, tG = at('D', SWAP - 6, 'G'), tB = at('B', 0), tC = at('C', 0), tD = at('D', 14, 'D'), tSwap = at('D', SWAP, 'D'),
  tCut = at('D', CUT, 'D'), tBack = at('D', BACK, 'D'), tE = at('E', 0), tF = at('F', 0), tZ = at('F', 45, 'Z');
const N = plan.length;

// ---------------- legendas (em quadros de saída) ----------------
const LEG = [
  { f0: 3, f1: tB - 1, hook: ['EMPINA A BIKE.', 'DESAFIA A GALERA.', 'VIRA CARAMELO.'], at: [3, 30, tG] },
  { f0: tB + 6, f1: tC - 4, k: 'Modo Motoca', t: 'SEGURA O GRAU', s: 'cada metro conta · foge do D.U.R.O.' },
  { f0: tC + 6, f1: tD - 4, k: 'Multiplayer', t: 'JOGA COM A GALERA', s: 'até 7 na mesma rua' },
  { f0: tSwap, f1: tSwap + 62, k: 'Caiu no multiplayer?', t: 'PERAÍ… VIROU CARAMELO?!', big: true },
  { f0: tSwap + 66, f1: tCut - 2, k: 'Agora tu é o caramelo', t: 'CORRE ATRÁS DA GALERA' },
  { f0: tCut + 3, f1: tE - 3, k: 'Passou no Agenor?', t: 'VOLTA PRA BIKE!' },
  { f0: tE + 5, f1: tF - 3, k: 'Garagem', t: 'MONTA TEU VISUAL', s: 'bikes novas liberam com conquistas' },
  // versão pra Google Play: sem chamada de doação, só o que o item é (compra opcional, só visual)
  { f0: tF + 3, f1: tZ - 2, k: 'Na garagem', t: 'CARAMELOS ESPECIAIS', s: 'compra opcional no app · só visual' },
  { f0: tZ, f1: N, end: true }
];
// marcador "TU" em cima do jogador: antes da queda, logo depois da troca e na volta pra bike
const MARK = [[tD, at('D', FLIP + 6, 'D')], [tSwap + 9, tSwap + 60], [tBack + 4, tE - 6]];
const BOOMS = [tB, tC, tD, tCut, tE, tF, tZ].map(T);
const POF = [tG + 6, tSwap].map(T); // som da transformação (no vislumbre e na hora)

// ---------------- câmera (px CSS do quadro 1920x1080) ----------------
const span = (m, near) => { const xs = [m.me[0], ...m.others.filter(o => !near || Math.abs(o[0] - m.me[0]) < near).map(o => o[0])]; return [Math.min(...xs), Math.max(...xs)]; };
const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = x => x * x * (3 - 2 * x);
function alvoH(p, k) {
  const m = p.m, me = m.me;
  switch (p.tag) {
    case 'A': return { cx: 960, cy: 540, w: 1920 - 140 * (p.i / 71) };
    case 'G': return { cx: me[0] + 40, cy: me[1] - 30, w: 980 };
    case 'B': return { cx: me[0] + 300, cy: 560, w: 1800 };
    case 'C': { const [a, b] = span(m); return { cx: (a + b) / 2, cy: 560, w: clamp(b - a + 760, 1300, 1920) }; }
    case 'D': {
      if (p.i < FLIP) return { cx: me[0] + 260, cy: me[1] - 60, w: lerp(1920, 1380, ease(clamp((p.i - 14) / (FLIP - 14), 0, 1))) };
      if (p.i < SWAP && !m.slow) return { cx: me[0] + 160, cy: me[1] - 40, w: 1300 };
      if (p.i <= SWAP) return { cx: me[0] + 60, cy: me[1] - 20, w: p.hold ? 860 : 1000 };
      if (p.i < CUT) { const [a, b] = span(m, 700); return { cx: (a + b) / 2 + 80, cy: me[1] - 60, w: clamp(b - a + 820, 1100, 1700) }; }
      return { cx: me[0] + 220, cy: 600, w: 1560 };
    }
    default: return { cx: 960, cy: 540, w: 1920 };
  }
}
// vertical: L1 = tela cheia 9:16; L2 = janela alta (1080x1200) com título em cima; L3 = garagem
function alvoV(p) {
  const m = p.m, me = m.me;
  switch (p.tag) {
    case 'A': { const [a, b] = span(m, 620); return { L: 'L2b', cx: (a + b) / 2, cy: 720, w: 780 }; }
    case 'G': return { L: 'L1', cx: me[0] + 20, cy: me[1] - 40, w: 470 };
    case 'B': return { L: 'L2', cx: me[0] - 120, w: 972 };
    case 'C': { const [a, b] = span(m, 620); return { L: 'L2b', cx: (a + b) / 2, cy: 720, w: 780 }; }
    case 'D': {
      if (p.i < FLIP) return { L: 'L1', cx: me[0] + 40, cy: me[1] - 120, w: lerp(607, 520, ease(clamp((p.i - 14) / (FLIP - 14), 0, 1))) };
      if (p.i < SWAP && !m.slow) return { L: 'L1', cx: me[0] + 30, cy: me[1] - 90, w: 540 };
      if (p.i <= SWAP) return { L: 'L1', cx: me[0] + 10, cy: me[1] - 60, w: p.hold ? 380 : 440 };
      if (p.i < CUT) { const [a, b] = span(m, 420); return { L: 'L1', cx: (a + b) / 2 + 30, cy: me[1] - 120, w: clamp(b - a + 300, 470, 607) }; }
      return { L: 'L1', cx: me[0] - 90, cy: 540, w: 607 }; // pastelaria à esquerda no quadro
    }
    case 'E': return { L: 'L3', rect: [1410, 452, 500, 512] };
    case 'F': { const [a, b] = span(m, 700); return { L: 'L2b', cx: (a + b) / 2, cy: 740, w: 820 }; }
    default: return { L: 'L1', cx: 900, cy: 540, w: 607 };
  }
}
const ASPECT = { H: 16 / 9, L1: 9 / 16, L2: 1080 / 1200, L2b: 1080 / 972 }; // L2b: corta o céu vazio e aproxima a galera
function rect(asp, cx, cy, w) {
  let h = w / asp; if (h > 1080) { h = 1080; w = h * asp; } if (w > 1920) { w = 1920; h = w / asp; }
  return [clamp(cx - w / 2, 0, 1920 - w), clamp(cy - h / 2, 0, 1080 - h), w, h];
}
function cameras(fmt) {
  const out = []; let sm = null, last = null;
  plan.forEach((p, n) => {
    const a = fmt === 'H' ? { ...alvoH(p), L: 'H' } : alvoV(p);
    if (a.rect) { out.push({ L: a.L, r: a.rect }); sm = null; last = p.tag; return; }
    a.cy = a.cy ?? 540;
    const snap = !sm || p.tag !== last || (p.tag === 'D' && (p.i === FLIP || p.i === CUT + 1)) || sm.L !== a.L;
    sm = snap ? { ...a } : { L: a.L, cx: lerp(sm.cx, a.cx, 0.16), cy: lerp(sm.cy, a.cy, 0.16), w: lerp(sm.w, a.w, p.hold || (p.tag === 'D' && p.i === SWAP) ? 0.5 : 0.14) };
    last = p.tag;
    out.push({ L: a.L, r: rect(ASPECT[a.L], sm.cx, sm.cy, sm.w) });
  });
  return out;
}
const CAM = { H: cameras('H'), V: cameras('V') };
const fontCss = (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/@font-face\s*\{[^}]*\}/g) || []).join('\n');
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/q/')) { const f = path.join(FR, decodeURIComponent(q.url.slice(3))); if (fs.existsSync(f)) { r.writeHead(200, { 'content-type': 'image/jpeg' }); return r.end(fs.readFileSync(f)); } r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  r.end(`<!doctype html><style>${fontCss}</style><body style="margin:0;background:#000"><canvas id="c"></canvas><span style="font-family:'Bowlby One'">a</span><span style="font-family:'Barlow Condensed';font-weight:700">a</span></body>`);
}).listen(8834);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const info = { segundos: +(N / FPS).toFixed(2), quadros: N, troca_em: +T(tSwap).toFixed(2), cortes: BOOMS.map(x => +x.toFixed(2)) };
  console.log('plano:', JSON.stringify(info));
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const fmt of (process.env.FMT || 'H,V').split(',')) {
    const e = await b.newPage();
    const errs = []; e.on('pageerror', x => errs.push(x.message)); e.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    const chunks = [], wav = [];
    await e.exposeFunction('saveChunk', b64 => { chunks.push(Buffer.from(b64, 'base64')); });
    await e.exposeFunction('saveWav', b64 => { wav.push(Buffer.from(b64, 'base64')); });
    await e.goto('http://127.0.0.1:8834/');
    const frames = plan.map((p, n) => ({ f: p.seg + '/' + String(p.i).padStart(4, '0') + '.jpg', tag: p.tag, m: p.m, cam: CAM[fmt][n] }));
    const res = await e.evaluate(async (frames, fmt, FPS, LEG, MARK, BOOMS, POF, tSwap, tCut, tG, wantWav) => {
      await document.fonts.ready;
      await Promise.all([document.fonts.load("400 40px 'Bowlby One'"), document.fonts.load("700 40px 'Barlow Condensed'")]);
      const H = fmt === 'H', W = H ? 1920 : 1080, HH = H ? 1080 : 1920, SRC = 2; // quadros em 2x
      const c = document.getElementById('c'); c.width = W; c.height = HH; let g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      const DUR = frames.length / FPS, SR = 44100;

      // ---------------- música do projeto (mesma composição), batidas nos cortes, som da transformação ----------------
      const oc = new OfflineAudioContext(2, Math.ceil((DUR + 0.5) * SR), SR);
      const master = oc.createGain(); master.gain.value = 0.42;
      const comp = oc.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.12;
      const out = oc.createGain(); out.gain.value = 1.9;
      const lim = oc.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
      const trim = oc.createGain(); trim.gain.value = 0.89;
      master.connect(comp); comp.connect(out); out.connect(lim); lim.connect(trim); trim.connect(oc.destination);
      master.gain.setValueAtTime(0.42, DUR - 1.4); master.gain.linearRampToValueAtTime(0.0001, DUR);
      const noiseBuf = oc.createBuffer(1, SR, SR); { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const BPM = 130, STEP = 60 / BPM / 4, BAR = STEP * 16;
      const env = (gn, t, a, v, d) => { gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(v, t + a); gn.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
      const kick = (t, v = 1) => { const o = oc.createOscillator(), gn = oc.createGain(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); env(gn, t, 0.002, 0.95 * v, 0.32); o.connect(gn); gn.connect(master); o.start(t); o.stop(t + 0.4); };
      const bass = (t, f, len, v = 0.55) => { const o = oc.createOscillator(), gn = oc.createGain(), sh = oc.createWaveShaper(); const cv = new Float32Array(257); for (let i = 0; i < 257; i++) cv[i] = Math.tanh((i / 128 - 1) * 2.2); sh.curve = cv; o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05); env(gn, t, 0.004, v, len); o.connect(sh); sh.connect(gn); gn.connect(master); o.start(t); o.stop(t + len + 0.1); };
      const noise = (t, type, freq, q, v, d) => { const s = oc.createBufferSource(); s.buffer = noiseBuf; const f = oc.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const gn = oc.createGain(); env(gn, t, 0.001, v, d); s.connect(f); f.connect(gn); gn.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05); };
      const clap = (t, v = 1) => { for (let k = 0; k < 3; k++) noise(t + k * 0.011, 'bandpass', 1400, 1.2, 0.5 * v, 0.06 + (k === 2 ? 0.12 : 0)); };
      const hat = (t, v = 1) => noise(t, 'highpass', 7500, 0.7, 0.16 * v, 0.035);
      const tamb = (t, f, v = 1) => { const o = oc.createOscillator(), gn = oc.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(f * 1.8, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.03); env(gn, t, 0.001, 0.42 * v, 0.14); o.connect(gn); gn.connect(master); o.start(t); o.stop(t + 0.2); noise(t, 'bandpass', f * 4, 2, 0.12 * v, 0.04); };
      const apito = (t, n = 2) => { for (let k = 0; k < n; k++) { const s = t + k * STEP * 1.5, o = oc.createOscillator(), gn = oc.createGain(), lfo = oc.createOscillator(), lg = oc.createGain(); o.frequency.value = 2850; lfo.frequency.value = 38; lg.gain.value = 120; lfo.connect(lg); lg.connect(o.frequency); env(gn, s, 0.005, 0.13, STEP * 1.1); o.connect(gn); gn.connect(master); o.start(s); o.stop(s + STEP * 1.3); lfo.start(s); lfo.stop(s + STEP * 1.3); } };
      const stab = (t, f, v = 0.12) => { for (const m of [1, 1.189, 1.498]) { const o = oc.createOscillator(), gn = oc.createGain(), fl = oc.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = f * m; fl.type = 'lowpass'; fl.frequency.setValueAtTime(2400, t); fl.frequency.exponentialRampToValueAtTime(500, t + 0.18); env(gn, t, 0.003, v, 0.16); o.connect(fl); fl.connect(gn); gn.connect(master); o.start(t); o.stop(t + 0.25); } };
      const boom = t => { kick(t, 1.2); bass(t, 41.2, 1.2, 0.7); noise(t, 'highpass', 4000, 0.5, 0.35, 1.4); };
      // "pof + au": queda de tom curta e um latidinho sintetizado (discreto, por cima da música)
      const pof = t => {
        const o = oc.createOscillator(), gn = oc.createGain(); o.type = 'square'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.18); env(gn, t, 0.003, 0.18, 0.2); o.connect(gn); gn.connect(master); o.start(t); o.stop(t + 0.25);
        noise(t, 'bandpass', 2500, 0.8, 0.25, 0.12);
        for (const [dt, f0, f1] of [[0.28, 720, 430], [0.46, 680, 400]]) { const b = oc.createOscillator(), bg = oc.createGain(), bf = oc.createBiquadFilter(); b.type = 'sawtooth'; b.frequency.setValueAtTime(f0, t + dt); b.frequency.exponentialRampToValueAtTime(f1, t + dt + 0.1); bf.type = 'bandpass'; bf.frequency.value = 1100; bf.Q.value = 2.5; env(bg, t + dt, 0.006, 0.22, 0.1); b.connect(bf); bf.connect(bg); bg.connect(master); b.start(t + dt); b.stop(t + dt + 0.14); }
      };
      const KICK = [0, 3, 6, 10], CLAP = [4, 12], GHOST = [7, 15], TAMB = { 2: 196, 5: 147, 8: 220, 11: 165, 14: 196 }, ROOT = [41.2, 41.2, 32.7, 36.7];
      for (let bi = 0; bi < Math.ceil(DUR / BAR); bi++) {
        const t0 = bi * BAR, end = t0 > DUR - 3.4, root = ROOT[Math.floor(bi / 2) % 4];
        for (let st = 0; st < 16; st++) {
          const t = t0 + st * STEP + (st % 2 ? STEP * 0.08 : 0); if (t > DUR - 0.2) break;
          // no "peraí" a batida respira (some o bumbo meio segundo) pra o pof aparecer
          const breathe = Math.abs(t - POF[1] - 0.15) < 0.35;
          if (KICK.includes(st) && !breathe) { kick(t, st === 0 ? 1 : 0.85); if (!end) bass(t, root * (st === 10 ? 1.5 : 1), st === 0 ? 0.34 : 0.22); }
          if (CLAP.includes(st)) clap(t); if (GHOST.includes(st)) clap(t, 0.35);
          if (TAMB[st] && !end && !breathe) tamb(t, TAMB[st], st === 8 ? 1 : 0.8);
          hat(t, st % 4 === 2 ? 1 : 0.55);
          if (bi % 4 >= 2 && !end && (st === 0 || st === 3 || st === 6)) stab(t, root * 8);
        }
        if (bi % 4 === 1 && !end) apito(t0 + STEP * 12, 2);
      }
      for (const t of BOOMS) boom(t);
      for (const t of POF) pof(t);
      apito(DUR - 3.2, 3);
      const buf = await oc.startRendering();
      if (wantWav) {
        const ch = [buf.getChannelData(0), buf.getChannelData(1)], n = Math.floor(DUR * SR), dv = new DataView(new ArrayBuffer(44 + n * 4));
        const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
        ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, SR, true); dv.setUint32(28, SR * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * 4, true);
        for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) dv.setInt16(44 + i * 4 + k * 2, Math.max(-1, Math.min(1, ch[k][i])) * 32767, true);
        const u = new Uint8Array(dv.buffer); for (let i = 0; i < u.length; i += 0x30000) { let s = ''; const sub = u.subarray(i, i + 0x30000); for (let k = 0; k < sub.length; k += 0x8000) s += String.fromCharCode.apply(null, sub.subarray(k, k + 0x8000)); await window.saveWav(btoa(s)); }
      }

      // ---------------- desenho ----------------
      const easeO = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
      const shadowText = (txt, x, y, font, fill, depth, align = 'center') => {
        g.font = font; g.textAlign = align; g.textBaseline = 'alphabetic';
        g.save(); g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 24; g.fillStyle = 'rgba(0,0,0,.01)'; g.fillText(txt, x, y); g.restore();
        if (depth) { g.fillStyle = '#a3321f'; g.fillText(txt, x, y + depth); }
        g.fillStyle = fill; g.fillText(txt, x, y);
      };
      const fit = (txt, font, size, maxW) => { let s = size; g.font = font.replace('$', s); while (g.measureText(txt).width > maxW && s > 20) { s -= 2; g.font = font.replace('$', s); } return s; };
      const cache = new Map();
      const layer = (key, w, h, paint) => { if (cache.has(key)) return cache.get(key); const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const keep = g; g = cv.getContext('2d'); paint(w, h); g = keep; cache.set(key, cv); return cv; };
      const stamp = (cv, cx, cy, alpha, scale = 1) => { if (alpha <= 0) return; g.save(); g.globalAlpha = Math.min(1, alpha); g.translate(cx, cy); g.scale(scale, scale); g.drawImage(cv, -cv.width / 2, -cv.height / 2); g.restore(); };
      // texto pequeno ganha uma faixa escura atrás (legibilidade no celular)
      const pill = (txt, cx, y, size, col) => {
        g.font = `700 ${size}px 'Barlow Condensed'`; const w = g.measureText(txt).width + size * 0.9, h = size * 1.3;
        g.fillStyle = 'rgba(8,19,24,.72)'; g.beginPath(); g.roundRect(cx - w / 2, y - h * 0.78, w, h, h / 2); g.fill();
        g.fillStyle = col; g.textAlign = 'center'; g.fillText(txt, cx, y);
      };
      const TW = H ? 1500 : 860; // largura máxima do título (vertical: fora da faixa direita de botões)
      function caption(l, f, cx, cy) {
        const a = Math.min(easeO((f - l.f0) / 7), easeO((l.f1 - f) / 5));
        const pop = l.big ? 1 + 0.18 * (1 - easeO((f - l.f0) / 6)) : 1;
        const rise = (1 - easeO((f - l.f0) / 8)) * (l.big ? 0 : 22);
        const cv = layer('cap' + l.f0, W, 460, (w, h) => {
          const ts = fit(l.t, "400 $px 'Bowlby One'", l.big ? (H ? 118 : 104) : (H ? 104 : 96), TW), y = 250;
          pill(l.k.toUpperCase(), w / 2, y - ts * 0.98, H ? 40 : 44, '#f3efe6');
          shadowText(l.t, w / 2, y, `400 ${ts}px 'Bowlby One'`, '#ffb547', Math.round(ts * 0.07));
          if (l.s) pill(l.s, w / 2, y + ts * 0.72, H ? 44 : 46, '#f3efe6');
        });
        stamp(cv, cx, cy + rise, a, pop);
      }
      function hook(l, f, cx, y0, gap, size) {
        l.hook.forEach((line, k) => {
          const p = easeO((f - l.at[k]) / 6); if (p <= 0) return;
          const cv = layer('hook' + k, W, Math.round(size * 1.8), (w, h) => { const s = fit(line, "400 $px 'Bowlby One'", size, TW); shadowText(line, w / 2, h * 0.68, `400 ${s}px 'Bowlby One'`, k === 2 ? '#ffb547' : '#f3efe6', Math.round(s * 0.07)); });
          stamp(cv, cx, y0 + k * gap - size * 0.32, Math.min(p, easeO((l.f1 - f) / 4)), 1.22 - 0.22 * p);
        });
      }
      function marker(x, y, f, s) { // "TU" com setinha, balançando de leve
        const bob = Math.sin(f / 4) * 6 * s;
        g.save(); g.translate(x, y - 40 * s + bob);
        g.fillStyle = '#ffb547'; g.strokeStyle = '#0b1a22'; g.lineWidth = 4 * s;
        g.beginPath(); g.roundRect(-46 * s, -78 * s, 92 * s, 56 * s, 12 * s); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(-14 * s, -24 * s); g.lineTo(14 * s, -24 * s); g.lineTo(0, -4 * s); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#0b1a22'; g.font = `400 ${36 * s}px 'Bowlby One'`; g.textAlign = 'center'; g.fillText('TU', 0, -36 * s);
        g.restore();
      }
      function endCard(l, f) {
        const p = easeO((f - l.f0) / 12);
        g.fillStyle = `rgba(11,26,34,${0.78 * p})`; g.fillRect(0, 0, W, HH);
        const cy = H ? 470 : 800;
        const logo = layer('logo', W, H ? 560 : 900, (w, h) => {
          shadowText('MOTOR 2 TEMPOS · 80 CC', w / 2, H ? 90 : 120, `700 ${H ? 38 : 48}px 'Barlow Condensed'`, '#8fa3ad', 0);
          shadowText('Grau', w / 2, H ? 260 : 400, `400 ${H ? 190 : 270}px 'Bowlby One'`, '#ffb547', H ? 13 : 18);
          shadowText('80cc', w / 2, H ? 440 : 660, `400 ${H ? 190 : 270}px 'Bowlby One'`, '#ffb547', H ? 13 : 18);
        });
        stamp(logo, W / 2, cy, p, 1.1 - 0.1 * p);
        const line = (txt, col) => layer(txt, W, 130, (w, h) => { const s = fit(txt, "400 $px 'Bowlby One'", H ? 58 : 66, TW); shadowText(txt, w / 2, 86, `400 ${s}px 'Bowlby One'`, col, 4); });
        stamp(line('SOZINHO OU COM A GALERA.', '#f3efe6'), W / 2, H ? 860 : 1330, p * easeO((f - l.f0 - 14) / 8));
        stamp(line('EM BREVE NA GOOGLE PLAY.', '#ffb547'), W / 2, H ? 950 : 1430, p * easeO((f - l.f0 - 26) / 8));
      }
      const WIN = { H: [0, 0, 1920, 1080], L1: [0, 0, 1080, 1920], L2: [0, 520, 1080, 1200], L2b: [0, 560, 1080, 972], L3: [0, 560, 1080, 1103] };
      function draw(im, fr, f) {
        const cam = fr.cam, [rx, ry, rw, rh] = cam.r, win = WIN[cam.L];
        const toCanvas = (x, y) => [win[0] + (x - rx) * win[2] / rw, win[1] + (y - ry) * win[3] / rh];
        if (!H) { const bg = g.createLinearGradient(0, 0, 0, HH); bg.addColorStop(0, '#13303b'); bg.addColorStop(0.5, '#0b1a22'); bg.addColorStop(1, '#081318'); g.fillStyle = bg; g.fillRect(0, 0, W, HH); }
        g.drawImage(im, rx * SRC, ry * SRC, rw * SRC, rh * SRC, win[0], win[1], win[2], win[3]);
        if (!H && cam.L !== 'L1') { g.fillStyle = '#ffb547'; g.fillRect(0, win[1] - 6, W, 6); g.fillRect(0, win[1] + win[3], W, 6); }
        const l = LEG.find(x => f >= x.f0 && f < x.f1);
        // faixa escura suave atrás dos títulos quando eles ficam por cima do jogo
        if (l && !l.end && (H || cam.L === 'L1')) { const y0 = H ? 110 : 250, y1 = H ? 560 : 780; const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, 'rgba(11,26,34,0)'); gr.addColorStop(0.5, 'rgba(11,26,34,.5)'); gr.addColorStop(1, 'rgba(11,26,34,0)'); g.fillStyle = gr; g.fillRect(0, y0, W, y1 - y0); }
        // destaque da troca: flash curto e anel em volta do jogador (sincronizado com a troca real do jogo)
        const k = f - tSwap, kg = f - (tG + 6);
        for (const kk of [k, kg]) if (kk >= 0 && kk < 16) {
          const [mx, my] = toCanvas(fr.m.me[0], fr.m.me[1]);
          if (kk < 5) { g.fillStyle = `rgba(255,246,220,${0.5 * (1 - kk / 5)})`; g.fillRect(0, 0, W, HH); }
          g.strokeStyle = `rgba(255,181,71,${1 - kk / 16})`; g.lineWidth = 14 * (1 - kk / 16) + 3;
          g.beginPath(); g.arc(mx, my, 40 + kk * 22 * (win[2] / rw), 0, Math.PI * 2); g.stroke();
        }
        // corte pro Agenor: flash claro de 3 quadros (nada de tela escura)
        const kc = f - tCut; if (kc >= 0 && kc < 3) { g.fillStyle = `rgba(255,246,220,${0.35 * (1 - kc / 3)})`; g.fillRect(0, 0, W, HH); }
        if (MARK.some(([a, b]) => f >= a && f <= b)) { const [mx, my] = toCanvas(fr.m.me[0], fr.m.me[1] - (fr.m.m === 'dog' ? 40 : 110)); marker(mx, my, f, Math.min(1.6, Math.max(0.9, win[2] / rw * 0.8))); }
        if (!H && !l) { // logo discreto durante o jogo (canto superior esquerdo, fora das bordas); some quando há título
          const lg = layer('mini', 420, 80, (w, h) => { shadowText('Grau 80cc', 0, 54, "400 44px 'Bowlby One'", '#ffb547', 3, 'left'); });
          stamp(lg, 60 + 210, 250, 0.92);
        }
        // vertical: centro em x=500 (margem de 70 px à esquerda; a faixa direita fica livre pros botões do app)
        if (l && l.hook) H ? hook(l, f, W / 2, 300, 122, 108) : hook(l, f, 500, cam.L === 'L1' ? 380 : 300, 100, 86);
        else if (l && l.k) H ? caption(l, f, W / 2, 320) : caption(l, f, 500, cam.L === 'L1' ? 430 : 310);
        if (l && l.end) endCard(l, f);
      }

      // ---------------- grava ----------------
      const ac = new AudioContext({ sampleRate: SR }); await ac.resume();
      const dest = ac.createMediaStreamDestination(); const src = ac.createBufferSource(); src.buffer = buf; src.connect(dest);
      const vt = c.captureStream(0).getVideoTracks()[0];
      const mime = 'video/mp4;codecs=avc1.640028,mp4a.40.2';
      if (!MediaRecorder.isTypeSupported(mime)) return 'sem suporte a ' + mime;
      const rec = new MediaRecorder(new MediaStream([vt, dest.stream.getAudioTracks()[0]]), { mimeType: mime, videoBitsPerSecond: H ? 10e6 : 9e6, audioBitsPerSecond: 192000 });
      rec.ondataavailable = async ev => { if (ev.data.size) { const u = new Uint8Array(await ev.data.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); await window.saveChunk(btoa(s)); } };
      // passada 1 (sem pressa): compõe cada quadro a partir do 4K e guarda já no tamanho final
      const done = [];
      const src4k = i => fetch('/q/' + frames[i].f).then(r => r.blob()).then(createImageBitmap).catch(() => null);
      let nx = src4k(0);
      for (let i = 0; i < frames.length; i++) {
        const im = await nx; nx = i + 1 < frames.length ? src4k(i + 1) : null;
        if (im) { draw(im, frames[i], i); im.close && im.close(); }
        done.push(await new Promise(r => c.toBlob(r, 'image/jpeg', 0.93)));
      }
      // passada 2 (tempo real): grava a partir dos quadros prontos
      const load = i => i >= frames.length ? Promise.resolve(null) : createImageBitmap(done[i]).catch(() => null);
      const AHEAD = 10, q = []; for (let i = 0; i < AHEAD; i++) q.push(load(i));
      g.drawImage(await q[0], 0, 0);
      rec.start(1000);
      const t0 = performance.now(); src.start();
      let late = 0;
      for (let i = 0; i < frames.length; i++) {
        const im = await q[i]; q.push(load(i + AHEAD));
        const wait = t0 + i * 1000 / FPS - performance.now();
        if (wait > 0) await new Promise(r => setTimeout(r, wait)); else if (wait < -20) late++;
        if (im) { g.drawImage(im, 0, 0); vt.requestFrame(); im.close && im.close(); }
      }
      await new Promise(r => setTimeout(r, 400));
      await new Promise(r => { rec.onstop = r; rec.stop(); });
      await new Promise(r => setTimeout(r, 800));
      return 'ok · quadros atrasados: ' + late;
    }, frames, fmt, FPS, LEG, MARK, BOOMS, POF, tSwap, tCut, tG, fmt === 'H');
    const name = fmt === 'H' ? '16x9' : '9x16';
    const file = path.join(OUT, `grau80cc-trailer-v2-${name}.mp4`);
    fs.writeFileSync(file, Buffer.concat(chunks));
    if (wav.length) fs.writeFileSync(path.join(OUT, 'grau80cc-trailer-v2-musica.wav'), Buffer.concat(wav));
    console.log(name, res, '|', (fs.statSync(file).size / 1e6).toFixed(1), 'MB', errs.length ? errs.slice(0, 3) : '');
    await e.close();
  }
  await b.close(); srv.close();
})().catch(x => { console.error('FALHOU', x); srv.close(); process.exit(1); });
