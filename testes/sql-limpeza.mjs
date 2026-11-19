// Testa supabase/01b-limpeza-agendada.sql num Postgres isolado (PGlite), em cima da fase 1 e do placar copiado.
// O PGlite não tem pg_cron: o schema "cron" é simulado (tabela job + função schedule) só pra testar a trava e a transação.
// O comando agendado é extraído do arquivo e executado de verdade, pra conferir o efeito.
// Uso: PGLITE=<node_modules com pglite> node testes/sql-limpeza.mjs [placar.json]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.PGLITE || 'node_modules';
const { PGlite } = await import(pathToFileURL(path.join(base, '@electric-sql/pglite/dist/index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(base, '@electric-sql/pglite/dist/contrib/pgcrypto.js')).href);
const rd = f => fs.readFileSync(path.join(DIR, '..', 'supabase', f), 'utf8');
const F1 = rd('01-placar-seguro.sql'), L = rd('01b-limpeza-agendada.sql');
const REAL = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : [];
process.env.PERFIL = 'real';
const t = fs.readFileSync(path.join(DIR, 'sql-fase1.mjs'), 'utf8'); const i0 = t.indexOf('const PROD = `') + 14;
const PROD = eval('`' + t.slice(i0, t.indexOf('\n`;', i0)) + '\n`');
let pass = 0, fail = 0; const ok = (c, n, x) => { c ? pass++ : fail++; console.log((c ? '  ok    ' : '  FALHA ') + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); };

const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(PROD);
for (const r of REAL) await db.query('insert into placar (id, nome, metros, segundos, bike, criado_em) overriding system value values ($1,$2,$3,$4,$5,$6)', [r.id, r.nome, r.metros, r.segundos, r.bike, r.criado_em]);
await db.query(`insert into denuncias (alvo_id, alvo_nome, texto, onde, autor_id, autor_nome) values ('a','b','c','d','e','f')`);
await db.exec(F1);
// stub do pg_cron (só o que o arquivo usa)
await db.exec(`create schema cron; create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text, active boolean default true);
create function cron.schedule(n text, s text, c text) returns bigint language sql as $$ insert into cron.job (jobname, schedule, command) values (n, s, c) on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid $$;`);
const Lstub = L.replace('create extension if not exists pg_cron;', '-- (pg_cron simulado)');
const dig = async () => (await db.query(`select
  (select md5(string_agg(id||'|'||nome||'|'||metros||'|'||segundos||'|'||bike||'|'||via||'|'||criado_em, ';' order by id)) from placar) p,
  (select md5(string_agg(id||'|'||texto, ';' order by id)) from denuncias) d,
  (select count(*) from grau_nomes) n, (select md5(string_agg(chave||valor, ';')) from grau_config) c`)).rows[0];

console.log('\nA. Trava e transação');
await db.exec(Lstub);
const j = (await db.query(`select jobname, schedule, command from cron.job`)).rows;
ok(j.length === 1 && j[0].jobname === 'grau-limpeza-bilhetes' && j[0].schedule === '17 * * * *', 'cria um job só, de hora em hora no minuto 17', j.map(x => x.schedule));
const cmd = j[0].command;
ok(/^delete from public\.grau_corridas where criado_em < now\(\) - interval '6 hours'$/.test(cmd), 'o comando agendado só apaga grau_corridas com mais de 6 h', cmd);
await db.query(`update cron.job set command = 'MARCA'`);
let err = null; try { await db.exec(Lstub); } catch (e) { err = e.message; }
await db.exec('rollback').catch(() => {});
ok(/já existe/.test(err || '') && (await db.query(`select command from cron.job`)).rows[0].command === 'MARCA', 'rodar de novo com o job existente para e NÃO sobrescreve', err);
await db.query(`update cron.job set command = $1`, [cmd]);

console.log('\nB. Efeito do comando agendado');
const antes = await dig();
// bilhetes de várias idades (em horas); um usado e um em partida ativa
const idades = [0.1, 1, 5.9, 5.99, 6.02, 7, 30, 24 * 5];
for (const h of idades) await db.query(`insert into grau_corridas (criado_em, ip_hash, usado_em) values (now() - make_interval(secs => $1), 'x', case when $2 then now() - make_interval(secs => $1 - 60) end)`, [h * 3600, h === 7]);
const tk = (await db.query(`select token from grau_corridas where criado_em > now() - interval '7 minutes'`)).rows[0].token;
await db.exec(cmd);
const sobra = (await db.query(`select round(extract(epoch from now() - criado_em) / 3600, 2)::float8 h from grau_corridas order by 1`)).rows.map(r => r.h);
ok(sobra.length === 4 && sobra.every(h => h < 6), 'apaga só os bilhetes com mais de 6 h (ficam os de 0,1 h, 1 h, 5,9 h e 5,99 h)', sobra);
const depois = await dig();
ok(antes.p === depois.p, 'placar intacto (todas as colunas, inclusive via)');
ok(antes.d === depois.d, 'denúncias intactas');
ok(antes.n === depois.n && antes.c === depois.c, 'grau_nomes e grau_config intactos');
// partida ativa: o bilhete novo continua valendo depois da limpeza
await db.query(`update grau_corridas set criado_em = now() - interval '2 minutes' where token = $1`, [tk]);
const r = (await db.query(`select grau_enviar($1, 'Ativo', 100, 20, 'monark', $2, true) r`, [tk, 'a'.repeat(32)])).rows[0].r;
ok(r === 'ok_teste', 'partida em andamento continua podendo enviar depois da limpeza', r);
ok(/partida_expirada/.test(F1), 'bilhete com mais de 6 h já seria recusado pelo grau_enviar (a limpeza não tira nada que ainda valia)');

console.log(`\n${pass} ok, ${fail} falha(s)`); process.exit(fail ? 1 : 0);
