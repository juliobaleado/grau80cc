// Trailer do Grau 80cc · passo 2: monta os quadros capturados (captura.cjs) com legendas e música e grava
// grau80cc-trailer-16x9.mp4 (1920x1080) e grau80cc-trailer-9x16.mp4 (1080x1920).
// Pra editar: mude TIMELINE (ordem/duração das cenas e recortes) e LEGENDAS (textos e tempos) e rode de novo.
// A música é composta aqui mesmo com Web Audio (funk 130 BPM): obra própria, sem problema de direito de uso.
//
// Uso: node trailer/monta.cjs [pasta-dos-quadros] [pasta-de-saída]
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = path.join(__dirname, '..');
const FR = process.argv[2] || path.join(ROOT, 'play-store', 'trailer', 'quadros');
const OUT = process.argv[3] || path.join(ROOT, 'play-store', 'trailer');
const FPS = 30;

// cenas na ordem do vídeo. crop = recorte do quadro 1920x1080 [x, y, largura, altura] (h = 16:9, v = janela 4:3 do vertical)
const TIMELINE = [
  { seg: 'A', n: 90 },                                                       // 0–3 s   gancho
  { seg: 'B', n: 180 },                                                      // 3–9 s   jogabilidade
  { seg: 'C', n: 180 },                                                      // 9–15 s  multiplayer
  { seg: 'D', n: 210, dip: 120 },                                            // 15–22 s caramelo (cortina no quadro 120)
  { seg: 'E', n: 90, v: [1050, 420, 860, 645] },                             // 22–25 s garagem (16:9 em quadro inteiro, mostra o placar)
  { seg: 'F', n: 180 }                                                       // 25–31 s caramelos especiais + final
];
const V_CROP = [150, 0, 1440, 1080];
// legendas: t0/t1 em segundos do vídeo
const LEGENDAS = [
  { t0: 0.1, t1: 3.0, hook: ['EMPINA A BIKE.', 'DESAFIA A GALERA.', 'VIRA CARAMELO.'], at: [0.1, 1.05, 2.0] },
  { t0: 3.25, t1: 8.8, k: 'Modo Motoca', t: 'SEGURA O GRAU', s: 'cada metro conta · foge da viatura' },
  { t0: 9.25, t1: 14.8, k: 'Multiplayer', t: 'JOGA COM A GALERA', s: 'até 7 na mesma rua · chat e voz' },
  { t0: 15.6, t1: 18.85, k: 'Virou pra trás?', t: 'VIRA CARAMELO', s: 'e corre atrás de quem ainda tá no grau' },
  { t0: 19.25, t1: 21.9, k: 'Passou no Agenor?', t: 'VOLTA PRA BIKE' },
  { t0: 22.2, t1: 24.9, k: 'Garagem', t: 'MONTA TEU VISUAL', s: 'bikes novas liberam com conquistas', hx: 890, hy: 250, hw: 860 }, // no céu, entre o placar e a garagem
  { t0: 25.15, t1: 26.95, k: 'Caramelos especiais', t: 'DOA UM PASTEL', s: 'opcional e só visual · no app da Google Play' },
  { t0: 27.0, t1: 31.0, end: true }
];
const BOOMS = [3.0, 9.0, 15.25, 19.0, 22.0, 25.0, 27.0]; // batidas fortes nos cortes

const frames = [];
for (const c of TIMELINE) for (let i = 0; i < c.n; i++) frames.push({ f: c.seg + '/' + String(i).padStart(4, '0') + '.jpg', c, i });
for (const x of frames) if (!fs.existsSync(path.join(FR, x.f))) throw new Error('falta quadro ' + x.f + ' (rode trailer/captura.cjs)');
const fontCss = (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/@font-face\s*\{[^}]*\}/g) || []).join('\n');

const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/q/')) { const f = path.join(FR, decodeURIComponent(q.url.slice(3))); if (fs.existsSync(f)) { r.writeHead(200, { 'content-type': 'image/jpeg' }); return r.end(fs.readFileSync(f)); } r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  r.end(`<!doctype html><style>${fontCss}</style><body style="margin:0;background:#000"><canvas id="c"></canvas><span style="font-family:'Bowlby One'">a</span><span style="font-family:'Barlow Condensed';font-weight:700">a</span></body>`);
}).listen(8824);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const fmt of ['16x9', '9x16']) {
    const e = await b.newPage();
    const errs = []; e.on('pageerror', x => errs.push(x.message)); e.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    const chunks = [], wav = [];
    await e.exposeFunction('saveChunk', b64 => { chunks.push(Buffer.from(b64, 'base64')); });
    await e.exposeFunction('saveWav', b64 => { wav.push(Buffer.from(b64, 'base64')); });
    await e.goto('http://127.0.0.1:8824/');
    const res = await e.evaluate(async (frames, fmt, FPS, LEG, BOOMS, VCROP, wantWav) => {
      await document.fonts.ready;
      await Promise.all([document.fonts.load("400 40px 'Bowlby One'"), document.fonts.load("700 40px 'Barlow Condensed'")]);
      const H = fmt === '16x9';
      const W = H ? 1920 : 1080, HH = H ? 1080 : 1920;
      const c = document.getElementById('c'); c.width = W; c.height = HH; let g = c.getContext('2d');
      const DUR = frames.length / FPS, SR = 44100;

      // ---------------- música (mesma composição do jogo, com batidas nos cortes) ----------------
      const oc = new OfflineAudioContext(2, Math.ceil((DUR + 0.5) * SR), SR);
      const master = oc.createGain(); master.gain.value = 0.42;
      const comp = oc.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.12;
      const out = oc.createGain(); out.gain.value = 1.9;
      const lim = oc.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
      const trim = oc.createGain(); trim.gain.value = 0.89; // pico perto de -1 dB
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
      const KICK = [0, 3, 6, 10], CLAP = [4, 12], GHOST = [7, 15], TAMB = { 2: 196, 5: 147, 8: 220, 11: 165, 14: 196 }, ROOT = [41.2, 41.2, 32.7, 36.7];
      for (let bi = 0; bi < Math.ceil(DUR / BAR); bi++) {
        const t0 = bi * BAR, end = t0 > DUR - 3.4, root = ROOT[Math.floor(bi / 2) % 4];
        for (let st = 0; st < 16; st++) {
          const t = t0 + st * STEP + (st % 2 ? STEP * 0.08 : 0); if (t > DUR - 0.2) break;
          if (KICK.includes(st)) { kick(t, st === 0 ? 1 : 0.85); if (!end) bass(t, root * (st === 10 ? 1.5 : 1), st === 0 ? 0.34 : 0.22); }
          if (CLAP.includes(st)) clap(t); if (GHOST.includes(st)) clap(t, 0.35);
          if (TAMB[st] && !end) tamb(t, TAMB[st], st === 8 ? 1 : 0.8);
          hat(t, st % 4 === 2 ? 1 : 0.55);
          if (bi % 4 >= 2 && !end && (st === 0 || st === 3 || st === 6)) stab(t, root * 8);
        }
        if (bi % 4 === 1 && !end) apito(t0 + STEP * 12, 2);
      }
      for (const t of BOOMS) boom(t);
      apito(DUR - 3.4, 3);
      const buf = await oc.startRendering();
      if (wantWav) {
        const ch = [buf.getChannelData(0), buf.getChannelData(1)], n = Math.floor(DUR * SR), dv = new DataView(new ArrayBuffer(44 + n * 4));
        const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
        ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, SR, true); dv.setUint32(28, SR * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * 4, true);
        for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) dv.setInt16(44 + i * 4 + k * 2, Math.max(-1, Math.min(1, ch[k][i])) * 32767, true);
        const u = new Uint8Array(dv.buffer); for (let i = 0; i < u.length; i += 0x30000) { let s = ''; const sub = u.subarray(i, i + 0x30000); for (let k = 0; k < sub.length; k += 0x8000) s += String.fromCharCode.apply(null, sub.subarray(k, k + 0x8000)); await window.saveWav(btoa(s)); }
      }

      // ---------------- desenho de cada quadro ----------------
      const ease = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
      const shadowText = (txt, x, y, font, fill, depth, align = 'center') => {
        g.font = font; g.textAlign = align; g.textBaseline = 'alphabetic';
        g.save(); g.shadowColor = 'rgba(0,0,0,.75)'; g.shadowBlur = 26; g.fillStyle = 'rgba(0,0,0,.01)'; g.fillText(txt, x, y); g.restore();
        if (depth) { g.fillStyle = '#a3321f'; g.fillText(txt, x, y + depth); }
        g.fillStyle = fill; g.fillText(txt, x, y);
      };
      const fit = (txt, font, size, maxW) => { let s = size; g.font = font.replace('$', s); while (g.measureText(txt).width > maxW && s > 20) { s -= 2; g.font = font.replace('$', s); } return s; };
      const legAt = t => LEG.find(l => t >= l.t0 && t < l.t1);
      // cada texto vira uma camada pronta (com sombra) uma vez só; por quadro só muda transparência/posição
      const cache = new Map();
      const layer = (key, w, h, paint) => {
        if (cache.has(key)) return cache.get(key);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const keep = g; g = cv.getContext('2d'); paint(w, h); g = keep;
        cache.set(key, cv); return cv;
      };
      const stamp = (cv, cx, cy, alpha, scale = 1) => {
        if (alpha <= 0) return;
        g.save(); g.globalAlpha = alpha; g.translate(cx, cy); g.scale(scale, scale); g.drawImage(cv, -cv.width / 2, -cv.height / 2); g.restore();
      };
      function caption(l, t, cx, cy, big) {
        const a = Math.min(ease((t - l.t0) / 0.25), ease((l.t1 - t) / 0.18));
        const rise = (1 - ease((t - l.t0) / 0.3)) * 24;
        const cv = layer('cap' + l.t0 + fmt, W, 420, (w, h) => {
          const maxW = H && l.hw ? l.hw : W - (H ? 300 : 90), ts = fit(l.t, "400 $px 'Bowlby One'", big ? 104 : 96, maxW), y = 210;
          shadowText(l.k.toUpperCase(), w / 2, y - ts * 0.95, '700 ' + (big ? 34 : 40) + "px 'Barlow Condensed'", '#f3efe6', 0);
          shadowText(l.t, w / 2, y, '400 ' + ts + "px 'Bowlby One'", '#ffb547', Math.round(ts * 0.07));
          if (l.s) shadowText(l.s, w / 2, y + ts * 0.62, '700 ' + (big ? 36 : 42) + "px 'Barlow Condensed'", '#f3efe6', 0);
        });
        stamp(cv, cx, cy + rise, a);
      }
      function hook(l, t, cx, y0, gap, size) {
        l.hook.forEach((line, k) => {
          const p = ease((t - l.at[k]) / 0.22); if (p <= 0) return;
          const cv = layer('hook' + k + fmt, W, Math.round(size * 1.8), (w, h) => {
            const s = fit(line, "400 $px 'Bowlby One'", size, W - 80);
            shadowText(line, w / 2, h * 0.68, '400 ' + s + "px 'Bowlby One'", k === 2 ? '#ffb547' : '#f3efe6', Math.round(s * 0.07));
          });
          stamp(cv, cx, y0 + k * gap - size * 0.32, Math.min(p, ease((l.t1 - t) / 0.15)), 1.25 - 0.25 * p);
        });
      }
      function endCard(l, t) {
        const p = ease((t - l.t0) / 0.5);
        g.fillStyle = 'rgba(11,26,34,' + (0.82 * p) + ')'; g.fillRect(0, 0, W, HH);
        const cy = HH / 2 - (H ? 60 : 120);
        const logo = layer('logo' + fmt, W, 560, (w, h) => {
          shadowText('MOTOR 2 TEMPOS · 80 CC', w / 2, 90, '700 ' + (H ? 34 : 40) + "px 'Barlow Condensed'", '#8fa3ad', 0);
          shadowText('Grau', w / 2, H ? 240 : 270, '400 ' + (H ? 170 : 190) + "px 'Bowlby One'", '#ffb547', 12);
          shadowText('80cc', w / 2, H ? 400 : 470, '400 ' + (H ? 170 : 190) + "px 'Bowlby One'", '#ffb547', 12);
        });
        stamp(logo, W / 2, cy - (H ? 280 : 320) + 280, p);
        const line = (txt, col) => layer(txt + fmt, W, 120, (w, h) => shadowText(txt, w / 2, 80, '400 ' + (H ? 54 : 62) + "px 'Bowlby One'", col, 4));
        stamp(line('SOZINHO OU COM A GALERA.', '#f3efe6'), W / 2, cy + (H ? 240 : 300) - 20, p * ease((t - l.t0 - 0.6) / 0.4));
        stamp(line('EM BREVE NA GOOGLE PLAY.', '#ffb547'), W / 2, cy + (H ? 320 : 390) - 20, p * ease((t - l.t0 - 1.1) / 0.4));
      }
      const brand = () => layer('brand', W, 200, (w, h) => {
        shadowText('Grau 80cc', w / 2, 90, "400 92px 'Bowlby One'", '#ffb547', 7);
        shadowText('EM BREVE NA GOOGLE PLAY', w / 2, 170, "700 40px 'Barlow Condensed'", '#f3efe6', 0);
      });
      function draw(im, fr, i) {
        const t = i / FPS, c = fr.c, l = legAt(t);
        // cortina rápida no pulo de lugar dentro da cena
        const dip = c.dip ? Math.max(0, 1 - Math.abs(fr.i - c.dip) / 7) : 0;
        if (H) {
          const [sx, sy, sw, sh] = c.h || [0, 0, 1920, 1080];
          g.drawImage(im, sx, sy, sw, sh, 0, 0, W, HH);
          if (l && (l.hook || (l.k && !l.hx))) { const gr = g.createLinearGradient(0, 120, 0, 560); gr.addColorStop(0, 'rgba(11,26,34,0)'); gr.addColorStop(0.5, 'rgba(11,26,34,.45)'); gr.addColorStop(1, 'rgba(11,26,34,0)'); g.fillStyle = gr; g.fillRect(0, 120, W, 440); }
          if (dip) { g.fillStyle = `rgba(11,26,34,${dip})`; g.fillRect(0, 0, W, HH); }
          if (l && l.hook) hook(l, t, W / 2, 300, 125, 110);
          else if (l && l.k) caption(l, t, l.hx || W / 2, l.hy || 340, true);
        } else {
          const bg = g.createLinearGradient(0, 0, 0, HH); bg.addColorStop(0, '#13303b'); bg.addColorStop(0.5, '#0b1a22'); bg.addColorStop(1, '#081318'); g.fillStyle = bg; g.fillRect(0, 0, W, HH);
          const [sx, sy, sw, sh] = c.v || VCROP, top = 600, wh = 810;
          g.drawImage(im, sx, sy, sw, sh, 0, top, W, wh);
          g.fillStyle = '#ffb547'; g.fillRect(0, top - 6, W, 6); g.fillRect(0, top + wh, W, 6);
          if (dip) { g.fillStyle = `rgba(11,26,34,${dip})`; g.fillRect(0, top, W, wh); }
          if (!(l && l.end)) {
            stamp(brand(), W / 2, 1600, 1);
          }
          if (l && l.hook) hook(l, t, W / 2, 250, 120, 92);
          else if (l && l.k) caption(l, t, W / 2, 400, false);
        }
        if (l && l.end) endCard(l, t);
      }

      // ---------------- grava ----------------
      const ac = new AudioContext({ sampleRate: SR }); await ac.resume();
      const dest = ac.createMediaStreamDestination(); const src = ac.createBufferSource(); src.buffer = buf; src.connect(dest);
      const vs = c.captureStream(0), vt = vs.getVideoTracks()[0];
      const mime = 'video/mp4;codecs=avc1.640028,mp4a.40.2';
      if (!MediaRecorder.isTypeSupported(mime)) return 'sem suporte a ' + mime;
      const rec = new MediaRecorder(new MediaStream([vt, dest.stream.getAudioTracks()[0]]), { mimeType: mime, videoBitsPerSecond: 14e6, audioBitsPerSecond: 192000 });
      rec.ondataavailable = async ev => { if (ev.data.size) { const u = new Uint8Array(await ev.data.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); await window.saveChunk(btoa(s)); } };
      const load = i => new Promise(r => { if (i >= frames.length) return r(null); const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = '/q/' + frames[i].f; });
      const AHEAD = 6, q = []; for (let i = 0; i < AHEAD; i++) q.push(load(i));
      draw(await q[0], frames[0], 0);
      rec.start(1000);
      const t0 = performance.now(); src.start();
      let late = 0;
      for (let i = 0; i < frames.length; i++) {
        const im = await q[i]; q.push(load(i + AHEAD));
        const wait = t0 + i * 1000 / FPS - performance.now();
        if (wait > 0) await new Promise(r => setTimeout(r, wait)); else if (wait < -20) late++;
        if (im) { draw(im, frames[i], i); vt.requestFrame(); }
      }
      await new Promise(r => setTimeout(r, 400));
      await new Promise(r => { rec.onstop = r; rec.stop(); });
      await new Promise(r => setTimeout(r, 800));
      return 'ok · quadros atrasados: ' + late;
    }, frames, fmt, FPS, LEGENDAS, BOOMS, V_CROP, fmt === '16x9');
    const file = path.join(OUT, `grau80cc-trailer-${fmt}.mp4`);
    fs.writeFileSync(file, Buffer.concat(chunks));
    if (wav.length) fs.writeFileSync(path.join(OUT, 'grau80cc-trailer-musica.wav'), Buffer.concat(wav));
    console.log(fmt, res, '|', (fs.statSync(file).size / 1e6).toFixed(1), 'MB', errs.length ? errs.slice(0, 3) : '');
    await e.close();
  }
  await b.close(); srv.close();
})().catch(x => { console.error('FALHOU', x); srv.close(); process.exit(1); });
