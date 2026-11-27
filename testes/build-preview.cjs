// Gera a prévia isolada do lobby em lobby/ (servida em /grau80cc/lobby/ pelo GitHub Pages) a partir do index.html atual.
// Isolamento: dados do aparelho num espaço próprio (prefixo "previa:"; copia o save real só na primeira vez, nunca grava
// de volta), chat e salas em canais próprios (grau80p-*), nenhum POST ao Supabase (placar, feedback, denúncia), sem envio
// ao placar, noindex e selo "PRÉVIA". Não mexe no index.html principal.
// Uso: node testes/build-preview.cjs [commit]
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'lobby');
const commit = process.argv[2] || 'local';
let h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n/g, '\n'); // o checkout no Windows pode trazer CRLF
const rep = (a, b) => { const n = h.split(a).length - 1; if (n !== 1) throw new Error(`gancho ${n}x: ${a.slice(0, 70)}`); h = h.replace(a, () => b); };
const SHIM = `<script>
// ===== PRÉVIA ISOLADA (commit ${commit}) =====
(function () {
  window.GRAU_PREVIEW = true;
  // 1) dados do aparelho separados: tudo vai pra "previa:<chave>"; na 1ª abertura copia o save real (só leitura)
  try {
    var raw = window.localStorage, P = 'previa:';
    if (!raw.getItem(P + '__copiado')) {
      var ks = []; for (var i = 0; i < raw.length; i++) { var k = raw.key(i); if (k && k.indexOf('grau80-') === 0) ks.push(k); } // lista antes: copiar no meio muda os índices
      ks.forEach(function (k) { raw.setItem(P + k, raw.getItem(k)); });
      raw.setItem(P + '__copiado', '1');
    }
    var shim = {
      getItem: function (k) { return raw.getItem(P + k); }, setItem: function (k, v) { raw.setItem(P + k, String(v)); },
      removeItem: function (k) { raw.removeItem(P + k); }, clear: function () { for (var j = raw.length - 1; j >= 0; j--) { var kk = raw.key(j); if (kk && kk.indexOf(P) === 0) raw.removeItem(kk); } },
      key: function (n) { var ks = []; for (var j = 0; j < raw.length; j++) { var kk = raw.key(j); if (kk && kk.indexOf(P) === 0) ks.push(kk.slice(P.length)); } return ks[n] || null; },
      get length() { var c = 0; for (var j = 0; j < raw.length; j++) if ((raw.key(j) || '').indexOf(P) === 0) c++; return c; }
    };
    Object.defineProperty(window, 'localStorage', { value: shim, configurable: true });
  } catch (e) {}
  // 2) nenhuma escrita no backend de produção (placar, feedback, denúncia): POST pro Supabase responde 404 aqui mesmo
  var f0 = window.fetch;
  window.fetch = function (u, o) {
    var url = String((u && u.url) || u), m = ((o && o.method) || (u && u.method) || 'GET').toUpperCase();
    if (url.indexOf('supabase.co') >= 0 && m !== 'GET') return Promise.resolve(new Response('', { status: 404 }));
    return f0.apply(this, arguments);
  };
})();
</script>
`;
rep('<script>\n(() => {', SHIM + '<script>\n(() => {');
rep("rtChannel('grau80-saguao', {", "rtChannel('grau80p-saguao', {"); // chat da prévia separado do chat do jogo
rep("rtChannel('grau80-sala-' + code, {", "rtChannel('grau80p-sala-' + code, {"); // salas da prévia separadas
rep("    const canSend = gameMode === 'motoca' &&", "    const canSend = !window.GRAU_PREVIEW && gameMode === 'motoca' &&"); // prévia nunca envia ao placar
rep('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex, nofollow">');
rep('<div class="game" id="game">', `<div style="position:fixed;z-index:70;top:max(6px,env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);pointer-events:none;font:700 11px/1 'Barlow Condensed',sans-serif;letter-spacing:.16em;color:#0b1a22;background:#6fd08c;padding:4px 8px;border-radius:3px">PRÉVIA DO LOBBY · ${commit}</div>\n<div class="game" id="game">`);
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), h);
for (const f of fs.readdirSync(path.join(ROOT, 'img'))) fs.copyFileSync(path.join(ROOT, 'img', f), path.join(OUT, 'img', f));
console.log('prévia gerada em lobby/ (' + commit + ')');
