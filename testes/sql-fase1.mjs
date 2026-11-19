// Testes adversariais das migrações do placar num Postgres ISOLADO (PGlite, em memória). Nunca toca a produção.
// Recria o esquema de produção (lido do banco real em 19/11/2026: tabelas, constraints, políticas e grants),
// os papéis anon/authenticated e os privilégios padrão do Supabase, copia o placar público e ataca.
// Uso: PGLITE=<pasta node_modules com @electric-sql/pglite> node testes/sql-fase1.mjs [placar.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.PGLITE || 'node_modules';
const { PGlite } = await import(pathToFileURL(path.join(base, '@electric-sql/pglite/dist/index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(base, '@electric-sql/pglite/dist/contrib/pgcrypto.js')).href);
const F1 = fs.readFileSync(path.join(DIR, '..', 'supabase', '01-placar-seguro.sql'), 'utf8');
const F2 = fs.readFileSync(path.join(DIR, '..', 'supabase', '02-fechar-insert-direto.sql'), 'utf8');
const undo = (sql, marker) => sql.slice(sql.indexOf(marker)).split('\n').filter(l => /^-- (drop|grant|create|alter)/.test(l)).map(l => l.slice(3)).join('\n');
const REAL = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : [];

let pass = 0, fail = 0;
const ok = (c, n, x) => { c ? pass++ : fail++; console.log((c ? '  ok    ' : '  FALHA ') + n + (x !== undefined ? '  → ' + (typeof x === 'string' ? x : JSON.stringify(x)) : '')); };

// esquema de produção (como estava antes da fase 1)
const PROD = `
create role anon nologin; create role authenticated nologin;
create schema if not exists extensions;
grant usage on schema public to anon, authenticated; grant usage on schema extensions to anon, authenticated;
-- privilégios padrão do Supabase: toda tabela/função nova nasce com tudo liberado pra anon e authenticated
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
create table public.placar (
  id bigint generated always as identity primary key, nome text, metros numeric, segundos numeric,
  bike text default 'monark', criado_em timestamptz default now(),
  constraint placar_bike_check check (char_length(bike) <= 20),
  constraint placar_media_possivel check ((metros / segundos) <= 25::numeric),
  constraint placar_metros_check check (metros >= 3::numeric and metros <= 20000::numeric),
  constraint placar_nome_check check (char_length(btrim(nome)) >= 1 and char_length(btrim(nome)) <= 16),
  constraint placar_segundos_check check (segundos > 0::numeric));
create index placar_metros_idx on public.placar (metros desc);
alter table public.placar enable row level security;
create policy "placar: todos enviam" on public.placar for insert to anon, authenticated with check (true);
create policy "placar: todos leem" on public.placar for select to anon, authenticated using (true);
revoke all on public.placar from anon, authenticated;
grant select on public.placar to anon, authenticated;
grant insert (nome, metros, segundos, bike) on public.placar to anon, authenticated;
create table public.denuncias (
  id bigint generated always as identity primary key, criado_em timestamptz not null default now(),
  alvo_id text not null check (char_length(alvo_id) between 1 and 24), alvo_nome text not null check (char_length(alvo_nome) between 1 and 16),
  texto text not null check (char_length(texto) between 1 and 140), onde text not null check (char_length(onde) between 1 and 20),
  autor_id text not null check (char_length(autor_id) between 1 and 24), autor_nome text not null check (char_length(autor_nome) between 1 and 16));
alter table public.denuncias enable row level security;
create policy "jogo envia denuncia" on public.denuncias for insert to anon with check (true);
revoke all on public.denuncias from anon, authenticated;
grant insert, truncate, trigger, references on public.denuncias to anon;
grant truncate, trigger, references on public.denuncias to authenticated;
`;

async function fresh() {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(PROD);
  for (const r of REAL) await db.query('insert into placar (id, nome, metros, segundos, bike, criado_em) overriding system value values ($1,$2,$3,$4,$5,$6)', [r.id, r.nome, r.metros, r.segundos, r.bike, r.criado_em]);
  if (REAL.length) await db.query(`select setval(pg_get_serial_sequence('placar','id'), (select max(id) from placar))`);
  return db;
}
const sum = async db => (await db.query(`select count(*)::int n, md5(coalesce(string_agg(id||'|'||nome||'|'||metros||'|'||segundos||'|'||bike||'|'||criado_em, ';' order by id), '')) h from placar where id <= 1000000`)).rows[0];
// executa como cliente da API (papel + cabeçalhos do PostgREST); sempre numa transação
async function api(db, sql, params = [], { role = 'anon', ip = '200.1.2.3', headers, keep = true } = {}) {
  const h = headers || { 'cf-connecting-ip': ip, 'x-forwarded-for': ip };
  try {
    return await db.transaction(async tx => {
      await tx.query(`select set_config('role', $1, true), set_config('request.headers', $2, true)`, [role, JSON.stringify(h)]);
      const r = await tx.query(sql, params);
      if (!keep) await tx.rollback();
      return { ok: true, rows: r.rows };
    });
  } catch (e) { return { ok: false, code: e.code, msg: e.message }; }
}
const ticket = async (db, o) => (await api(db, 'select grau_iniciar() t', [], o)).rows?.[0]?.t;
const send = async (db, t, nome, m, s, bike = 'monark', dono = 'a'.repeat(32), o, teste = false) =>
  (await api(db, 'select grau_enviar($1,$2,$3,$4,$5,$6,$7) r', [t, nome, m, s, bike, dono, teste], o)).rows?.[0]?.r ?? 'ERRO';
const age = (db, t, sec) => db.query(`update grau_corridas set criado_em = now() - make_interval(secs => $2) where token = $1`, [t, sec]);

console.log('\nA. Migração não mexe nos recordes');
const db = await fresh();
const s0 = await sum(db);
await db.exec(F1);
const s1 = await sum(db);
ok(s0.n === REAL.length && s1.n === s0.n && s1.h === s0.h, `fase 1: ${s0.n} recordes intactos (mesmo hash)`, s1.h.slice(0, 12));
await db.exec(F1);
ok((await sum(db)).h === s0.h, 'rodar a fase 1 de novo (idempotente) não muda nada');

console.log('\nB. SECURITY DEFINER: dono, search_path e quem executa');
const defs = (await db.query(`select p.proname, pg_get_userbyid(p.proowner) dono, p.proconfig cfg,
  has_function_privilege('anon', p.oid, 'execute') anon_exec from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef order by 1`)).rows;
for (const d of defs) ok((d.cfg || []).some(c => /search_path=.*pg_temp$/.test(c)), `${d.proname}: dono ${d.dono}, search_path fixo com pg_temp no fim, anon executa: ${d.anon_exec}`, (d.cfg || []).join(' '));
const expected = { grau_enviar: true, grau_iniciar: true, grau_ip: false, grau_denuncia_limite: true };
ok(defs.every(d => d.anon_exec === expected[d.proname]), 'anon só executa grau_iniciar/grau_enviar (o trigger não roda fora de trigger)');
ok(!(await api(db, `select grau_nome_proibido('x')`)).ok, 'grau_nome_proibido não é chamável pela API');
ok(!(await api(db, `select grau_ip()`)).ok, 'grau_ip não é chamável pela API');

console.log('\nC. Tabelas novas fechadas pra API (mesmo com o privilégio padrão do Supabase)');
for (const [sql, n] of [
  ['select * from grau_corridas', 'ler bilhetes'], ['select * from grau_nomes', 'ler donos de nome'], ['select * from grau_config', 'ler o sal do IP'],
  [`insert into grau_corridas (token, criado_em, ip_hash) values (gen_random_uuid(), now() - interval '1 hour', 'x')`, 'forjar bilhete "antigo"'],
  [`update grau_corridas set usado_em = null`, 'reusar bilhete'], [`delete from grau_nomes`, 'apagar donos de nome'],
  [`update placar set metros = 19999`, 'alterar recorde'], [`delete from placar`, 'apagar recorde'], ['select * from denuncias', 'ler denúncias']])
  for (const role of ['anon', 'authenticated']) { const r = await api(db, sql, [], { role }); ok(!r.ok || (r.rows && r.rows.length === 0 && /update|delete/.test(sql)), `${role} não consegue ${n}`, r.ok ? 'sem efeito (RLS)' : r.code); }

console.log('\nD. A pergunta: dá pra falsificar recorde mandando requisição direto?');
const direto = await api(db, `insert into placar (nome, metros, segundos, bike) values ('Forjado', 19000, 800, 'bruno') returning id`, [], { keep: false });
ok(direto.ok, 'SÓ COM A FASE 1: SIM, o insert direto continua aberto (de propósito, pra versão 1.4 não quebrar)', direto.ok ? 'gravaria 19.000 m' : direto.code);
const t0 = await ticket(db);
ok(await send(db, t0, 'Forjado', 19000, 800, 'bruno') === 'tempo_impossivel', 'pela função: 19.000 m logo depois de pedir o bilhete é recusado');
ok(await send(db, crypto.randomUUID(), 'Forjado', 500, 30) === 'partida_invalida', 'bilhete inventado é recusado');
await age(db, t0, 60);
ok(await send(db, t0, 'Forjado', 1400, 58, 'monark') === 'rapido_demais', 'média de 24 m/s numa bike de 20 m/s é recusada');
ok(await send(db, t0, 'Forjado', 1600, 58, 'bruno') === 'rapido_demais', 'média acima de 25 m/s na Titan é recusada');
for (const [m, s, n] of [['NaN', 50, 'metros NaN'], [500, 'NaN', 'segundos NaN'], [500, 'Infinity', 'segundos infinito'], ['Infinity', 50, 'metros infinito'], [20001, 900, 'mais de 20 km'], [-5, 10, 'negativo'], [2, 1, 'menos de 3 m']])
  ok((await send(db, t0, 'Forjado', m, s)) !== 'ok', `valor inválido recusado (${n})`, await send(db, t0, 'Forjado', m, s));
ok(await send(db, t0, 'Forjado', 500, 30, 'helicoptero') === 'bike_invalida', 'bike que não existe é recusada');
ok(await send(db, t0, 'Teste', 500, 30, 'monark', 'a'.repeat(32), undefined, true) === 'ok_teste' && (await db.query(`select count(*)::int n from placar where nome = 'Teste'`)).rows[0].n === 0, 'modo teste confere sem gravar e sem gastar o bilhete');
ok(await send(db, t0, 'Plausivel', 1100, 57, 'bruno') === 'ok', 'O QUE CONTINUA POSSÍVEL: pedir bilhete, esperar o tempo real e mandar um valor plausível');
ok(await send(db, t0, 'Plausivel', 1100, 57, 'bruno') === 'partida_usada', 'o mesmo bilhete não vale duas vezes');
const t1 = await ticket(db); await age(db, t1, 14 * 60);
ok(await send(db, t1, 'Paciente', 19500, 800, 'bruno') === 'ok', '…e com 14 min de espera dá até o teto (19.500 m): a barreira é tempo, não prova de jogo');

console.log('\nD2. Evidência pra fase 2 (coluna via)');
{ const r = await api(db, "insert into placar (nome, metros, segundos, bike, via) values ('Espertinho', 500, 40, 'monark', 'bilhete')", [], { keep: false });
  ok(!r.ok, 'a API não consegue marcar um insert direto como "bilhete"', r.code); }
{ const r = await api(db, "insert into placar (nome, metros, segundos, bike) values ('Antigo14', 500, 40, 'monark')");
  const v = (await db.query("select via from placar where nome = 'Antigo14'")).rows[0]?.via;
  ok(r.ok && v === 'direto', 'insert direto (versão 1.4) fica marcado como "direto"', v); }
{ const v = (await db.query("select via from placar where nome = 'Plausivel'")).rows[0]?.via; ok(v === 'bilhete', 'recorde pelo grau_enviar fica marcado como "bilhete"', v); }
{ const mx = REAL.length ? Math.max(...REAL.map(r => r.id)) : 0; const v = (await db.query("select count(*)::int n from placar where via <> 'direto' and id <= " + mx)).rows[0].n; ok(v === 0, 'os recordes antigos ficam como "direto"', v); }
await db.query("delete from placar where nome = 'Antigo14'");

console.log('\nE. Nomes');
for (const n of ['C4R4LH0', 'Admin', 'Suporte Grau', 'p.o.r.r.a', 'filho da puta', 'grau80cc'])
  { const t = await ticket(db); await age(db, t, 120); ok(await send(db, t, n, 500, 40) === 'nome_proibido', `"${n}" recusado`); }
{ const t = await ticket(db); await age(db, t, 120); ok(await send(db, t, 'Zezinho', 500, 40, 'monark', 'b'.repeat(32)) === 'ok', 'primeiro aparelho fica dono de "Zezinho"'); }
for (const n of ['Zezinho', 'zezinho', ' ZEZINHO ', 'Zezinho\u0007'])
  { const t = await ticket(db); await age(db, t, 120); ok(await send(db, t, n, 500, 40, 'monark', 'c'.repeat(32)) === 'nome_em_uso', `outro aparelho não usa ${JSON.stringify(n)}`); }
{ const t = await ticket(db); await age(db, t, 120); ok(await send(db, t, 'Zezinho', 520, 40, 'monark', 'b'.repeat(32)) === 'ok', 'o dono continua usando'); }
{ const t = await ticket(db); await age(db, t, 120); const rr = await send(db, t, 'Rafa Computador', 500, 40, 'monark', 'd'.repeat(32), { ip: '61.0.0.1' }); ok(rr === 'ok', 'nome comum não é barrado ("Rafa Computador")', rr); }

console.log('\nF. Limites e cabeçalhos forjados');
{
  const fresh2 = await fresh(); await fresh2.exec(F1);
  // atacante sem Cloudflare na frente: troca o PRIMEIRO item do X-Forwarded-For a cada pedido
  const spoof = i => ({ headers: { 'x-forwarded-for': `10.0.${i % 250}.${i % 7}, 177.55.1.9` } });
  let last;
  for (let i = 0; i < 21; i++) { const t = await ticket(fresh2, spoof(i)); await age(fresh2, t, 120); last = await send(fresh2, t, 'Spam' + i, 500, 40, 'monark', String(i).padStart(32, 'e'), spoof(i)); }
  ok(last === 'muitos_envios', 'trocar o 1º item do X-Forwarded-For não fura o limite por IP (21º envio barrado)', last);
  const cf = await api(fresh2, 'select grau_iniciar()', [], { headers: { 'cf-connecting-ip': '8.8.8.8', 'x-forwarded-for': '177.55.1.9' } });
  const ips = (await fresh2.query(`select count(distinct ip_hash)::int n from grau_corridas`)).rows[0].n;
  ok(cf.ok && ips === 2, 'cf-connecting-ip tem prioridade sobre o X-Forwarded-For', ips);
  let r;
  for (let i = 0; i < 301; i++) r = await api(fresh2, 'select grau_iniciar()', [], { ip: '9.9.9.9' });
  ok(!r.ok && /muitas_partidas/.test(r.msg), '301º bilhete do mesmo IP em 10 min é barrado');
  let d;
  for (let i = 0; i < 21; i++) d = await api(fresh2, `insert into denuncias (alvo_id, alvo_nome, texto, onde, autor_id, autor_nome) values ('x','x','x','x','y','y')`);
  ok(!d.ok && /muitas_denuncias/.test(d.msg), '21ª denúncia no mesmo minuto é barrada (flood)');
  // limite global do placar: 30 por minuto, mesmo vindo de 31 IPs diferentes
  const db3 = await fresh(); await db3.exec(F1);
  for (let i = 0; i < 31; i++) { const o = { ip: '50.0.0.' + i }; const t = await ticket(db3, o); await age(db3, t, 120); r = await send(db3, t, 'Ip' + i, 500, 40, 'monark', String(i).padStart(32, 'f'), o); }
  ok(r === 'placar_ocupado', '31º envio no mesmo minuto (IPs diferentes) é barrado pelo limite global', r);
}

{
  const db4 = await fresh(); await db4.exec(F1);
  let r4; for (let i = 0; i < 305; i++) r4 = await api(db4, 'select grau_iniciar()', [], { headers: {} });
  const h4 = (await db4.query('select distinct ip_hash from grau_corridas')).rows.map(x => x.ip_hash);
  ok(r4.ok && h4.length === 1 && h4[0] === 'sem-ip', 'sem cabeçalho de IP: não trava todo mundo (só os limites globais valem)', h4);
}
console.log('\nG. Fase 2');
const tr = await api(db, 'truncate denuncias', [], { keep: false });
ok(tr.ok, 'antes da fase 2: anon ainda tem TRUNCATE em denuncias no SQL (a API não expõe, mas existe)', tr.ok ? 'truncaria' : tr.code);
await db.exec(F2);
const d2 = await api(db, `insert into placar (nome, metros, segundos, bike) values ('Forjado', 19000, 800, 'bruno')`);
ok(!d2.ok && d2.code === '42501', 'DEPOIS DA FASE 2: insert direto no placar é negado', d2.code);
ok(!(await api(db, 'truncate denuncias', [], { keep: false })).ok, 'TRUNCATE em denuncias negado');
{ await db.query("update placar set criado_em = criado_em - interval '2 minutes' where criado_em > now() - interval '1 minute'"); const o = { ip: '62.0.0.1' }; const t = await ticket(db, o); await age(db, t, 120); const r2 = await send(db, t, 'Depois', 600, 40, 'xr', '1'.repeat(32), o); ok(r2 === 'ok', 'o envio pela função continua funcionando', r2); }
ok((await api(db, 'select count(*) from placar')).ok, 'ler o placar continua liberado');
const sAfter = (await db.query(`select md5(string_agg(id||'|'||nome||'|'||metros||'|'||segundos||'|'||bike||'|'||criado_em, ';' order by id)) h from placar where id <= $1`, [REAL.length ? Math.max(...REAL.map(r => r.id)) : 0])).rows[0].h;
ok(!REAL.length || sAfter === s0.h, 'recordes originais seguem idênticos depois das duas fases');

console.log('\nH. Recuperação (rollback testado)');
{
  const dbr = await fresh(); const h0 = (await sum(dbr)).h;
  await dbr.exec(F1); await dbr.exec(F2);
  await dbr.exec(undo(F2, '-- Desfazer')); // reabre o insert direto
  ok((await api(dbr, `insert into placar (nome, metros, segundos, bike) values ('Volta', 10, 5, 'monark')`, [], { keep: false })).ok, 'desfazer a fase 2 reabre o envio da versão 1.4');
  await dbr.exec(undo(F1, '-- ROLLBACK'));
  const left = (await dbr.query(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'grau%'`)).rows[0].n
    + (await dbr.query(`select count(*)::int n from pg_tables where schemaname='public' and tablename like 'grau%'`)).rows[0].n
    + (await dbr.query(`select count(*)::int n from information_schema.columns where table_name='placar' and column_name='via'`)).rows[0].n;
  ok(left === 0 && (await sum(dbr)).h === h0, 'desfazer a fase 1 remove tudo e o placar fica igual ao original', left);
}

console.log(`\n${pass} ok, ${fail} falha(s)`);
process.exit(fail ? 1 : 0);
