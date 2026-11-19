// Uso: PGLITE=<node_modules com pglite> node testes/restaurar-backup.mjs <placar.csv> <denuncias.csv> <placar-ref.json>
// Restaura os CSVs num Postgres isolado com o esquema real e confere. Não imprime nenhum valor dos registros.
import fs from 'node:fs'; import { pathToFileURL } from 'node:url';
const base = process.env.PGLITE; const [pCsv, dCsv, ref] = process.argv.slice(2);
const { PGlite } = await import(pathToFileURL(base + '/@electric-sql/pglite/dist/index.js').href);
const { pgcrypto } = await import(pathToFileURL(base + '/@electric-sql/pglite/dist/contrib/pgcrypto.js').href);
process.env.PERFIL = 'real';
const t = fs.readFileSync('testes/sql-fase1.mjs', 'utf8');
const i0 = t.indexOf('const PROD = `') + 14;
const PROD = eval('`' + t.slice(i0, t.indexOf('\n`;', i0)) + '\n`');
function csv(s) { const rows = []; let row = [], f = '', q = false; if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  for (let i = 0; i < s.length; i++) { const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c; }
  if (f !== '' || row.length) { row.push(f); rows.push(row); } return rows.filter(r => !(r.length === 1 && r[0] === '')); }
const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(PROD);
let falhas = 0; const ok = (c, n, x) => { if (!c) falhas++; console.log((c ? '  ok    ' : '  FALHA ') + n + (x !== undefined ? '  → ' + x : '')); };
for (const [tab, arq] of [['placar', pCsv], ['denuncias', dCsv]]) {
  const [cab, ...dados] = csv(fs.readFileSync(arq, 'utf8'));
  const cols = cab.map(c => '"' + c + '"').join(', '), ph = cab.map((_, i) => '$' + (i + 1)).join(', ');
  let erros = 0;
  for (const r of dados) { try { await db.query(`insert into public.${tab} (${cols}) overriding system value values (${ph})`, r.map(v => v === '' ? null : v)); } catch (e) { erros++; } }
  const n = (await db.query(`select count(*)::int n, max(id)::int m from public.${tab}`)).rows[0];
  ok(erros === 0, `${tab}: todas as linhas entram no esquema real, respeitando todas as regras do banco`, erros + ' erro(s)');
  ok(n.n === dados.length, `${tab}: ${n.n} registros restaurados, maior id ${n.m}`);
  await db.query(`select setval(pg_get_serial_sequence('public.${tab}','id'), (select max(id) from public.${tab}))`);
  if (tab === 'placar') { const r = await db.query(`insert into public.placar (nome, metros, segundos) values ('x', 10, 5) returning id`); ok(r.rows[0].id === n.m + 1, 'placar: sequência dos ids continua certa depois da restauração (próximo id = maior + 1)'); await db.query('delete from public.placar where id = $1', [r.rows[0].id]); }
}
// compara com a cópia pública do placar lida pela API em 19/11 (mesmos 61 registros?)
const REF = JSON.parse(fs.readFileSync(ref, 'utf8'));
const h = async () => (await db.query(`select md5(string_agg(id||'|'||nome||'|'||metros::float8||'|'||segundos::float8||'|'||bike||'|'||extract(epoch from criado_em)::numeric(20,3), ';' order by id)) h from public.placar`)).rows[0].h;
const db2 = await PGlite.create({ extensions: { pgcrypto } }); await db2.exec(PROD);
for (const r of REF) await db2.query('insert into placar (id, nome, metros, segundos, bike, criado_em) overriding system value values ($1,$2,$3,$4,$5,$6)', [r.id, r.nome, r.metros, r.segundos, r.bike, r.criado_em]);
const h2 = (await db2.query(`select md5(string_agg(id||'|'||nome||'|'||metros::float8||'|'||segundos::float8||'|'||bike||'|'||extract(epoch from criado_em)::numeric(20,3), ';' order by id)) h from public.placar`)).rows[0].h;
ok(await h() === h2, 'placar restaurado é idêntico, registro a registro, à cópia lida pela API (impressão digital igual)');
// a fase 1 em cima dos dados restaurados: recordes intactos e desfazer devolve o original
const antes = await h();
await db.exec(fs.readFileSync('supabase/01-placar-seguro.sql', 'utf8'));
ok(await h() === antes, 'fase 1 aplicada sobre o backup restaurado: recordes intactos');
console.log('\n' + (falhas ? falhas + ' falha(s)' : 'restauração confirmada'));
