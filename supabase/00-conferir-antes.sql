-- Grau 80cc · conferência ANTES da fase 1. SÓ LEITURA: nenhum comando aqui muda o banco.
-- Confirma que o banco real está igual ao que foi testado no Postgres isolado (PGlite).

-- 1. colunas do placar (esperado: id, nome, metros, segundos, bike, criado_em; ainda sem "via")
select column_name, data_type, column_default from information_schema.columns
where table_schema = 'public' and table_name = 'placar' order by ordinal_position;

-- 2. o que anon/authenticated podem fazer no placar e nas denúncias
--    (esperado no placar: SELECT na tabela e INSERT só nas colunas nome, metros, segundos, bike)
select grantee, table_name, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('placar', 'denuncias') and grantee in ('anon', 'authenticated') order by 1, 2, 3;
select grantee, column_name, privilege_type from information_schema.column_privileges
where table_schema = 'public' and table_name = 'placar' and grantee in ('anon', 'authenticated') and privilege_type = 'INSERT' order by 1, 2;

-- 3. políticas (esperado: "placar: todos enviam", "placar: todos leem", "jogo envia denuncia"; nenhuma usa auth.uid())
select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2;

-- 4. nada com nome grau_* ainda (esperado: zero linhas)
select 'tabela' tipo, tablename nome from pg_tables where schemaname = 'public' and tablename like 'grau%'
union all select 'função', proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname like 'grau%'
union all select 'gatilho', tgname from pg_trigger where tgname like 'grau%';

-- 5. pgcrypto disponível no schema extensions (esperado: 1 linha)
select extname, n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where extname = 'pgcrypto';

-- 6. contagem pra comparar depois (esperado: igual antes e depois da fase 1)
select (select count(*) from public.placar) recordes, (select count(*) from public.denuncias) denuncias,
       (select max(id) from public.placar) ultimo_id;

-- 7. autenticação: ninguém depende dela (esperado: 0 usuários)
select count(*) usuarios from auth.users;
