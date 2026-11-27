// Grava o som real de cada moto (saída do áudio do jogo, sem placa de som) num roteiro igual pra todas:
// 0–5 s acelerando até o corte de giro, 5–8 s velocidade constante (meio acelerador), 8–11 s soltando (desaceleração com
// estouros), 11–14 s três aceleradas curtas. Salva um WAV por moto e um comparativo com todas em sequência.
// Sem rede (WebSocket falso, requisições externas respondem 404). Uso: node testes/sons-motos.cjs [pasta]
const puppeteer = require(process.env.PUPPETEER || 'C:/web/figma-site/node_modules/puppeteer');
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'play-store', 'duro', 'sons');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const j = html.lastIndexOf('})();');
html = html.slice(0, j) + 'window.__t={get s(){return s},begin,input};\n' + html.slice(j);
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html); }).listen(8854);
const MOTOS = [['caicara', 'bicicleta-motorizada'], ['bruno', 'titanica-99'], ['pop2', 'po-pop-bicilindrica'], ['gs', 'robozao']];
const wait = ms => new Promise(r => setTimeout(r, ms));
// WAV PCM 16 bits mono a partir das amostras
const wav = (samples, sr) => {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return b;
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
  const all = [], resumo = [];
  for (const [model, nome] of MOTOS) {
    const p = await (await b.createBrowserContext()).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', q => q.url().startsWith('http://127.0.0.1') ? q.continue() : q.respond({ status: 404, body: '' }));
    await p.evaluateOnNewDocument(model => {
      window.WebSocket = class { constructor() { this.readyState = 0; } send() {} close() {} };
      localStorage.setItem('grau80-nasc', '1990'); localStorage.setItem('grau80-instrucoes', 'fechado'); localStorage.setItem('grau80-tutorial', '{"menuTutorialVersion":1,"gameplayTutorialVersion":1}'); localStorage.setItem('grau80-nome-pedido', '1'); localStorage.setItem('grau80-novidades', 'welcome-1'); localStorage.setItem('grau80-musica', 'off');
      localStorage.setItem('grau80-ach', JSON.stringify({ grau30: 1, grau100: 1, grau200: 1, grau300: 1, grau500: 1, grau700: 1, grau2000: 1, grau3000: 1, grau5000: 1 }));
      localStorage.setItem('grau80-look', JSON.stringify({ model }));
      const orig = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (dst, ...a) {
        if (dst instanceof AudioDestinationNode) {
          const ctx = dst.context;
          if (!ctx.__tap) {
            ctx.__tap = ctx.createMediaStreamDestination();
            const rec = new MediaRecorder(ctx.__tap.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 });
            window.__ach = []; rec.ondataavailable = e => e.data.size && window.__ach.push(e.data); window.__arec = rec;
          }
          orig.call(this, ctx.__tap);
        }
        return orig.call(this, dst, ...a);
      };
    }, model);
    await p.setViewport({ width: 1280, height: 720 });
    await p.goto('http://127.0.0.1:8854/', { waitUntil: 'load' });
    await p.mouse.click(640, 300); await wait(300);
    await p.evaluate(() => __t.begin('livre')); await wait(300);
    await p.keyboard.type('agenor'); await wait(800); // modo teste: o piloto automático segura o grau
    await p.evaluate(() => window.__arec.start(250));
    await p.keyboard.down('Space'); await wait(5000);           // aceleração até o corte de giro
    await p.keyboard.up('Space');
    for (let i = 0; i < 12; i++) { await p.keyboard.down('Space'); await wait(140); await p.keyboard.up('Space'); await wait(110); } // ~meio acelerador
    await wait(3000);                                            // desaceleração com estouros
    for (let i = 0; i < 3; i++) { await p.keyboard.down('Space'); await wait(450); await p.keyboard.up('Space'); await wait(550); } // aceleradas curtas
    const b64 = await p.evaluate(async () => {
      window.__arec.stop(); await new Promise(r => setTimeout(r, 600));
      const u = new Uint8Array(await new Blob(window.__ach, { type: 'audio/webm' }).arrayBuffer()); let s = '';
      for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return btoa(s);
    });
    // decodifica no navegador e devolve as amostras (pra gerar o WAV e medir pico/clipping)
    const dec = await p.evaluate(async b64 => {
      const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const ctx = new OfflineAudioContext(1, 44100, 44100); const ab = await ctx.decodeAudioData(u.buffer);
      const d = ab.getChannelData(0); let pk = 0, clip = 0; for (const x of d) { const a = Math.abs(x); if (a > pk) pk = a; if (a >= 0.999) clip++; }
      return { sr: ab.sampleRate, pk, clip, data: Array.from(d, x => Math.round(x * 10000) / 10000) };
    }, b64);
    fs.writeFileSync(path.join(OUT, nome + '.wav'), wav(dec.data, dec.sr));
    for (const x of dec.data) all.push(x); for (let i = 0; i < Math.round(dec.sr * 0.8); i++) all.push(0);
    resumo.push({ nome, s: +(dec.data.length / dec.sr).toFixed(1), pico: +dec.pk.toFixed(3), clipping: dec.clip, erros: errs.length });
    console.log(nome.padEnd(22), (dec.data.length / dec.sr).toFixed(1) + ' s', 'pico', dec.pk.toFixed(3), 'amostras no limite', dec.clip, errs.length ? errs : '');
    var SR = dec.sr;
    await p.close();
  }
  fs.writeFileSync(path.join(OUT, 'comparativo-todas.wav'), wav(all, SR));
  fs.writeFileSync(path.join(OUT, 'resumo.json'), JSON.stringify(resumo, null, 1));
  console.log('ok ·', OUT);
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
