// Confere se os CSVs exportados do Supabase estão completos, SEM imprimir nenhum dado pessoal:
// só nomes de colunas, contagem de linhas, ids, campos obrigatórios vazios, valores fora das regras do banco e SHA-256.
// Uso: node testes/conferir-backup.cjs <placar.csv> <denuncias.csv>
// Esperado (lido do banco em 19/11/2026): placar 61 linhas, maior id 69; denuncias 1 linha, maior id 1.
const fs = require('fs'), crypto = require('crypto');
const ESPERADO = {
  placar: { cols: ['id', 'nome', 'metros', 'segundos', 'bike', 'criado_em'], linhas: 61, maxId: 69 },
  denuncias: { cols: ['id', 'criado_em', 'alvo_id', 'alvo_nome', 'texto', 'onde', 'autor_id', 'autor_nome'], linhas: 1, maxId: 1 }
};
// leitor de CSV (aspas, vírgula e quebra de linha dentro de campo)
function csv(t) {
  const rows = []; let row = [], f = '', q = false;
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}
let falhas = 0;
const ok = (c, n, x) => { if (!c) falhas++; console.log((c ? '  ok    ' : '  FALHA ') + n + (x !== undefined ? '  → ' + x : '')); };
for (const [tab, arq] of [['placar', process.argv[2]], ['denuncias', process.argv[3]]]) {
  console.log('\n' + tab + (arq ? '' : ' (arquivo não informado)'));
  if (!arq) { falhas++; continue; }
  const buf = fs.readFileSync(arq), E = ESPERADO[tab];
  const [cab, ...dados] = csv(buf.toString('utf8'));
  ok(E.cols.every(c => cab.includes(c)), 'todas as colunas presentes', cab.join(', '));
  ok(dados.every(r => r.length === cab.length), 'todas as linhas com o mesmo número de colunas');
  ok(dados.length === E.linhas, `linhas = ${E.linhas}`, dados.length);
  const ix = c => cab.indexOf(c);
  const ids = dados.map(r => Number(r[ix('id')]));
  ok(new Set(ids).size === ids.length && ids.every(Number.isInteger), 'ids inteiros e sem repetição');
  ok(Math.max(...ids) === E.maxId, `maior id = ${E.maxId}`, Math.max(...ids));
  const vazios = dados.filter(r => E.cols.some(c => c !== 'bike' && r[ix(c)] === '')).length;
  ok(vazios === 0, 'nenhum campo obrigatório vazio', vazios);
  ok(dados.every(r => !Number.isNaN(Date.parse(r[ix('criado_em')]))), 'datas legíveis');
  if (tab === 'placar') {
    const ruins = dados.filter(r => { const m = +r[ix('metros')], s = +r[ix('segundos')]; return !(m >= 3 && m <= 20000 && s > 0 && m / s <= 25); }).length;
    ok(ruins === 0, 'metros e segundos dentro das regras do banco (dá pra reimportar)', ruins);
  }
  console.log('  sha256 ' + crypto.createHash('sha256').update(buf).digest('hex') + '  (' + buf.length + ' bytes)');
}
console.log('\n' + (falhas ? falhas + ' falha(s)' : 'backup completo'));
process.exit(falhas ? 1 : 0);
