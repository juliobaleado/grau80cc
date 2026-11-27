// Testa supabase/06-feedback-email.sql num Postgres isolado (PGlite), com o Vault e o pg_net simulados.
// Confere: sem chave não chama nada; com chave chama o Resend com destinatário, assunto e texto certos; passa de 90
// por dia, para; erro no envio não derruba o feedback; o anon não executa a função do gatilho.
// Uso: PGLITE=<node_modules com pglite> node testes/sql-feedback-email.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.PGLITE || 'node_modules';
const { PGlite } = await import(pathToFileURL(path.join(base, '@electric-sql/pglite/dist/index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(base, '@electric-sql/pglite/dist/contrib/pgcrypto.js')).href);
const rd = f => fs.readFileSync(path.join(DIR, '..', 'supabase', f), 'utf8');
process.env.PERFIL = 'real';
const t = fs.readFileSync(path.join(DIR, 'sql-fase1.mjs'), 'utf8'); const i0 = t.indexOf('const PROD = `') + 14;
const PROD = eval('`' + t.slice(i0, t.indexOf('\n`;', i0)) + '\n`');
let pass = 0, fail = 0; const ok = (c, n, x) => { c ? pass++ : fail++; console.log((c ? '  ok    ' : '  FALHA ') + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); };
const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(PROD); await db.exec(rd('01-placar-seguro.sql')); await db.exec(rd('05-feedback.sql'));
// simulação do Supabase: Vault (decrypted_secrets) e pg_net (net.http_post grava a chamada)
await db.exec(`create schema if not exists vault; create table vault.decrypted_secrets (name text, decrypted_secret text);
  create schema if not exists net; create table net.chamadas (url text, headers jsonb, body jsonb); create table net.falha (on_ boolean);
  create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint
  language plpgsql as $f$ begin if exists (select 1 from net.falha) then raise exception 'resend fora'; end if; insert into net.chamadas values (url, headers, body); return 1; end $f$;`);
await db.exec(rd('06-feedback-email.sql').replace(/create extension if not exists pg_net[^\n]*\n/, ''));
await db.exec(rd('06-feedback-email.sql').replace(/create extension if not exists pg_net[^\n]*\n/, ''));
ok(true, 'roda duas vezes sem erro (idempotente)');
const fb = async (m, i = null) => (await db.query(`select grau_feedback('moto', $1, $2) r`, [m, i])).rows[0].r;
const n = async () => +(await db.query(`select count(*) c from net.chamadas`)).rows[0].c;
await db.exec(`select set_config('request.headers', '{"x-real-ip":"9.9.9.1"}', false)`);
ok(await fb('sem chave ainda') === 'ok' && await n() === 0, 'sem chave no Vault: grava e não chama o Resend');
await db.exec(`insert into vault.decrypted_secrets values ('resend_api_key', 're_teste_123')`);
ok(await fb('faz uma Biz 125 <b>turbo</b>', 'v9 · navegador') === 'ok' && await n() === 1, 'com chave: chama o Resend');
const c = (await db.query(`select url, headers, body from net.chamadas`)).rows[0];
ok(c.url === 'https://api.resend.com/emails' && c.headers.Authorization === 'Bearer re_teste_123', 'URL e autorização certas');
ok(JSON.stringify(c.body.to) === '["grau80ccgame@gmail.com"]' && c.body.subject === '[Grau 80cc] Feedback: moto' && c.body.from.includes('onboarding@resend.dev'), 'pra grau80ccgame@gmail.com com assunto', c.body.subject);
ok(c.body.text.includes('faz uma Biz 125 <b>turbo</b>') && c.body.text.includes('v9 · navegador') && !('html' in c.body), 'mensagem em texto puro, com a info técnica', c.body.text.split('\n').slice(0, 3));
await db.exec(`insert into net.falha values (true)`);
await db.exec(`select set_config('request.headers', '{"x-real-ip":"9.9.9.2"}', false)`);
ok(await fb('resend caiu') === 'ok' && +(await db.query(`select count(*) c from grau_feedback`)).rows[0].c === 3, 'Resend fora: o feedback grava mesmo assim');
await db.exec(`delete from net.falha; insert into grau_feedback (categoria, mensagem, ip_hash) select 'outro', 'lote ' || g, 'lote' || g from generate_series(1, 90) g`);
const antes = await n();
await db.exec(`select set_config('request.headers', '{"x-real-ip":"9.9.9.3"}', false)`);
ok(await fb('passou do limite do dia') === 'ok' && await n() === antes, 'mais de 90 no dia: não manda e-mail (fica só na tabela)');
await db.exec(`set role anon`);
let ex = true; try { await db.query(`select grau_feedback_email()`); } catch (e) { ex = false; }
await db.exec(`reset role`);
ok(!ex, 'anon não executa a função do gatilho');
console.log(`\n${pass} ok, ${fail} falha(s)`); process.exit(fail ? 1 : 0);
