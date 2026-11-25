// Comparação controlada do multiplayer: roda testes/multiplayer.cjs (Realtime de verdade, sala com código aleatório,
// sem gravar no banco) alternando a versão anterior e a nova, uma logo depois da outra, na mesma máquina e rede.
// Não altera o jogo nem o teste: cada rodada usa uma cópia temporária do teste com o index.html da versão escolhida.
// Os clientes usam um saguão exclusivo por rodada (testes/isolar-saguao.cjs) e salas com código aleatório.
// Uso: node testes/mp-comparacao.cjs [pares=5] [ref-antiga=pre-descaracterizacao-2026-11-25] [ref-nova=HEAD]
const fs = require('fs'), path = require('path'), os = require('os'), { execSync, spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const PARES = +(process.argv[2] || 5), REF = { antiga: process.argv[3] || 'pre-descaracterizacao-2026-11-25', nova: process.argv[4] || 'HEAD' };
const teste = fs.readFileSync(path.join(__dirname, 'multiplayer.cjs'), 'utf8');
const isolar = fs.readFileSync(path.join(__dirname, 'isolar-saguao.cjs'), 'utf8'); // saguão exclusivo: nunca entra no público
const res = { antiga: [], nova: [] };
for (let i = 0; i < PARES; i++) {
  for (const v of i % 2 ? ['nova', 'antiga'] : ['antiga', 'nova']) { // alterna quem vai primeiro
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-')); fs.mkdirSync(path.join(d, 'testes'));
    fs.writeFileSync(path.join(d, 'index.html'), execSync(`git show ${REF[v]}:index.html`, { cwd: ROOT, maxBuffer: 1 << 26 }));
    fs.writeFileSync(path.join(d, 'testes', 'multiplayer.cjs'), teste);
    fs.writeFileSync(path.join(d, 'testes', 'isolar-saguao.cjs'), isolar);
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [path.join(d, 'testes', 'multiplayer.cjs')], { encoding: 'utf8', timeout: 300000 });
    const out = (r.stdout || '') + (r.stderr || '');
    const m = out.match(/(\d+) ok, (\d+) falha/), falhas = (out.match(/FALHA .*/g) || []).map(s => s.replace(/\s+→.*/, '').replace('FALHA ', '').trim());
    res[v].push({ ok: m ? +m[1] : 0, falha: m ? +m[2] : -1, falhas, s: Math.round((Date.now() - t0) / 1000) });
    console.log(`par ${i + 1} · ${v.padEnd(6)} · ${m ? m[0] : 'sem resultado'} ${falhas.length ? '· ' + falhas.join(' | ') : ''}`);
    fs.rmSync(d, { recursive: true, force: true });
  }
}
for (const v of ['antiga', 'nova']) {
  const r = res[v], limpas = r.filter(x => x.falha === 0).length;
  const cont = {}; r.forEach(x => x.falhas.forEach(f => cont[f] = (cont[f] || 0) + 1));
  console.log(`\n${v} (${REF[v]}): ${limpas}/${r.length} rodadas sem falha`, JSON.stringify(cont));
}
