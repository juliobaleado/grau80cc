// Testa supabase/04-motos-novas.sql num Postgres isolado (PGlite), em cima da fase 1, com o perfil de privilégios real.
// Confere: as motos novas (pop2, gs) passam a ser aceitas com o limite de média de cada uma; as 5 antigas continuam
// exatamente com o limite de antes; bike desconhecida continua recusada; nada muda em placar/denúncias.
// Uso: PGLITE=<node_modules com pglite> node testes/sql-motos.mjs
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
await db.exec(PROD);
await db.exec(rd('01-placar-seguro.sql'));
// uma partida que começou há 10 minutos (o tempo da empinada cabe no tempo real)
const novaPartida = async () => {
  const tk = (await db.query(`insert into grau_corridas (criado_em, ip_hash) values (now() - interval '10 minutes', 'x') returning token`)).rows[0].token;
  return tk;
};
const envia = async (bike, metros, segundos) => (await db.query(`select grau_enviar($1, 'Teste', $2, $3, $4, $5, true) r`, [await novaPartida(), metros, segundos, bike, 'a'.repeat(32)])).rows[0].r;
const dig = async () => (await db.query(`select (select md5(coalesce(string_agg(id||'|'||nome||'|'||metros, ';' order by id), '')) from placar) p, (select count(*) from denuncias) d`)).rows[0];

console.log('\nA. Antes do 04 (como está em produção)');
ok(await envia('pop2', 100, 10) === 'bike_invalida', 'pop2 recusada');
ok(await envia('gs', 100, 10) === 'bike_invalida', 'gs recusada');
const antes = {};
for (const b of ['caicara', 'monark', 'xr', 'bikelete', 'bruno']) antes[b] = [await envia(b, 210, 10), await envia(b, 250, 10), await envia(b, 260, 10)];
const d0 = await dig();

console.log('\nB. Depois do 04');
await db.exec(rd('04-motos-novas.sql'));
ok(await envia('pop2', 260, 10) === 'ok_teste', 'Pó-pop aceita a 26 m/s de média (máxima no jogo ~25)');
ok(await envia('pop2', 280, 10) === 'rapido_demais', 'Pó-pop acima de 27 m/s é recusada');
ok(await envia('gs', 350, 10) === 'ok_teste', 'Robozão aceita a 35 m/s de média (máxima no jogo ~33,5)');
ok(await envia('gs', 370, 10) === 'rapido_demais', 'Robozão acima de 36 m/s é recusada');
let iguais = true;
for (const b of Object.keys(antes)) { const agora = [await envia(b, 210, 10), await envia(b, 250, 10), await envia(b, 260, 10)]; if (JSON.stringify(agora) !== JSON.stringify(antes[b])) { iguais = false; console.log('   ', b, antes[b], agora); } }
ok(iguais, 'as 5 bikes antigas respondem igual a antes (mesmos limites)', antes.bruno.concat(antes.caicara));
ok(await envia('moto_falsa', 100, 10) === 'bike_invalida', 'bike desconhecida continua recusada');
ok(await envia('pop2', 100, 1000) === 'tempo_impossivel', 'demais regras continuam valendo (tempo impossível)');
const d1 = await dig();
ok(d0.p === d1.p && d0.d === d1.d, 'placar e denúncias intactos (modo teste não grava)');
const sec = (await db.query(`select prosecdef, array_to_string(proconfig, ',') cfg from pg_proc where proname = 'grau_enviar'`)).rows[0];
ok(sec.prosecdef && /search_path=public, extensions, pg_temp/.test(sec.cfg), 'continua security definer com search_path fixo', sec.cfg);
const priv = (await db.query(`select has_function_privilege('anon', 'public.grau_enviar(uuid, text, numeric, numeric, text, text, boolean)', 'execute') a`)).rows[0].a;
ok(priv === true, 'anon continua podendo chamar grau_enviar');
console.log(`\n${pass} ok, ${fail} falha(s)`); process.exit(fail ? 1 : 0);
