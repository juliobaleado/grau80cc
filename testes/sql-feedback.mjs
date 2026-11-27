// Testa supabase/05-feedback.sql num Postgres isolado (PGlite), em cima da fase 1, com o perfil de privilégios real.
// Confere: grava feedback válido; recusa categoria/mensagem inválidas; limite por IP; anon não lê nem escreve direto
// na tabela; nada muda em placar/denúncias. Uso: PGLITE=<node_modules com pglite> node testes/sql-feedback.mjs
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
await db.exec(PROD); await db.exec(rd('01-placar-seguro.sql'));
const dig = async () => (await db.query(`select (select count(*) from placar) p, (select count(*) from denuncias) d`)).rows[0];
const antes = await dig();
await db.exec(rd('05-feedback.sql')); await db.exec(rd('05-feedback.sql'));
ok(true, 'roda duas vezes sem erro (idempotente)');
const ip = async v => db.exec(`select set_config('request.headers', '{"x-real-ip":"${v}"}', false)`);
const fb = async (c, m, i = null) => (await db.query(`select grau_feedback($1, $2, $3) r`, [c, m, i])).rows[0].r;
await ip('1.1.1.1');
ok(await fb('bug', 'A moto travou no 3º grau') === 'ok', 'feedback válido grava');
ok(await fb('xxx', 'mensagem boa') === 'categoria_invalida', 'categoria inválida recusada');
ok(await fb('outro', 'oi') === 'mensagem_invalida' && await fb('outro', 'x'.repeat(1001)) === 'mensagem_invalida', 'mensagem curta/longa recusada');
for (let i = 0; i < 4; i++) await fb('opiniao', 'massa demais ' + i);
ok(await fb('opiniao', 'sexta seguida') === 'muitos_envios', '5 por IP a cada 10 min');
await ip('2.2.2.2'); ok(await fb('moto', 'faz uma biz', 'v9 · navegador') === 'ok', 'outro IP continua enviando');
const row = (await db.query(`select ip_hash, info from grau_feedback order by id desc limit 1`)).rows[0];
ok(row.ip_hash !== '2.2.2.2' && row.ip_hash.length === 64 && row.info === 'v9 · navegador', 'guarda só o hash do IP');
// anon direto na tabela: sem acesso
await db.exec(`set role anon`);
let lê = true; try { await db.query(`select * from grau_feedback`); } catch (e) { lê = false; }
let grava = true; try { await db.query(`insert into grau_feedback (categoria, mensagem, ip_hash) values ('bug','abc','x')`); } catch (e) { grava = false; }
let rpc = false; try { rpc = (await db.query(`select grau_feedback('bug', 'pelo anon') r`)).rows[0].r === 'ok'; } catch (e) {}
await db.exec(`reset role`);
ok(!lê && !grava && rpc, 'anon não lê nem grava direto; só pela função', { lê, grava, rpc });
ok(JSON.stringify(await dig()) === JSON.stringify(antes), 'placar e denúncias intactos');
console.log(`\n${pass} ok, ${fail} falha(s)`); process.exit(fail ? 1 : 0);
