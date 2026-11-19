-- Grau 80cc · conferência ANTES da fase 1. SÓ LEITURA: é um único SELECT, não muda nada no banco.
-- Confirma que o banco real está igual ao que foi testado no Postgres isolado (PGlite).
-- Cada linha do resultado é um item (esperado no comentário ao lado).
select item, valor from (
  -- colunas do placar (esperado: id, nome, metros, segundos, bike, criado_em; sem "via")
  select 1 o, 'placar.colunas' item, string_agg(column_name || ':' || data_type || coalesce('=' || column_default, ''), ' | ' order by ordinal_position) valor
    from information_schema.columns where table_schema = 'public' and table_name = 'placar'
  union all
  select 2, 'denuncias.colunas', string_agg(column_name || ':' || data_type, ' | ' order by ordinal_position)
    from information_schema.columns where table_schema = 'public' and table_name = 'denuncias'
  union all
  -- permissões de tabela (esperado: placar SELECT; denuncias INSERT + TRUNCATE/TRIGGER/REFERENCES sobrando)
  select 3, 'grants.tabela', string_agg(grantee || ' ' || table_name || ' ' || privilege_type, ' | ' order by grantee, table_name, privilege_type)
    from information_schema.role_table_grants
    where table_schema = 'public' and table_name in ('placar', 'denuncias') and grantee in ('anon', 'authenticated')
  union all
  -- permissões por coluna (esperado: INSERT só em nome, metros, segundos, bike)
  select 4, 'grants.coluna.placar', string_agg(grantee || ' ' || privilege_type || ' ' || column_name, ' | ' order by grantee, privilege_type, column_name)
    from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'placar' and grantee in ('anon', 'authenticated') and privilege_type in ('INSERT', 'UPDATE')
  union all
  -- RLS ligado (esperado: placar t, denuncias t)
  select 5, 'rls', string_agg(relname || '=' || relrowsecurity::text || '/force=' || relforcerowsecurity::text, ' | ' order by relname)
    from pg_class where relnamespace = 'public'::regnamespace and relname in ('placar', 'denuncias')
  union all
  -- políticas (esperado: 3, nenhuma com auth.uid())
  select 6, 'politicas', string_agg(tablename || ' "' || policyname || '" ' || cmd || ' ' || roles::text || ' using=' || coalesce(qual, '-') || ' check=' || coalesce(with_check, '-'), ' | ' order by tablename, policyname)
    from pg_policies where schemaname = 'public'
  union all
  select 7, 'politicas.usam_auth', count(*)::text from pg_policies
    where schemaname = 'public' and (coalesce(qual, '') ~ 'auth\.' or coalesce(with_check, '') ~ 'auth\.')
  union all
  -- constraints do placar (esperado: as 5 do teste)
  select 8, 'placar.constraints', string_agg(conname || ': ' || pg_get_constraintdef(oid), ' | ' order by conname)
    from pg_constraint where conrelid = 'public.placar'::regclass
  union all
  select 9, 'denuncias.constraints', count(*)::text from pg_constraint where conrelid = 'public.denuncias'::regclass
  union all
  -- índices (esperado: sem placar_criado_idx / denuncias_criado_idx ainda)
  select 10, 'indices', string_agg(indexname, ' | ' order by indexname)
    from pg_indexes where schemaname = 'public' and tablename in ('placar', 'denuncias')
  union all
  -- gatilhos existentes nessas tabelas (esperado: nenhum)
  select 11, 'gatilhos', coalesce(string_agg(tgrelid::regclass::text || '.' || tgname, ' | '), 'nenhum')
    from pg_trigger where not tgisinternal and tgrelid in ('public.placar'::regclass, 'public.denuncias'::regclass)
  union all
  -- nada com nome grau_* (esperado: nenhum)
  select 12, 'objetos.grau', coalesce(string_agg(t || ' ' || n, ' | '), 'nenhum') from (
    select 'tabela' t, tablename::text n from pg_tables where schemaname = 'public' and tablename like 'grau%'
    union all select 'funcao', proname::text from pg_proc where pronamespace = 'public'::regnamespace and proname like 'grau%'
    union all select 'gatilho', tgname::text from pg_trigger where tgname like 'grau%') x
  union all
  -- todas as tabelas e funções do schema public (pra ver se há algo além do placar/denúncias)
  select 13, 'public.tabelas', string_agg(tablename, ' | ' order by tablename) from pg_tables where schemaname = 'public'
  union all
  select 14, 'public.funcoes', coalesce(string_agg(proname, ' | ' order by proname), 'nenhuma') from pg_proc where pronamespace = 'public'::regnamespace
  union all
  -- privilégios padrão (o teste assume: tudo novo nasce liberado pra anon/authenticated; a fase 1 revoga)
  select 15, 'default_acl', string_agg(pg_get_userbyid(defaclrole) || ' ' || defaclobjtype::text || ' ' || defaclacl::text, ' | ')
    from pg_default_acl where defaclnamespace = 'public'::regnamespace
  union all
  -- pgcrypto (esperado: no schema extensions) e digest acessível
  select 16, 'pgcrypto', coalesce((select extversion || ' em ' || extnamespace::regnamespace::text from pg_extension where extname = 'pgcrypto'), 'AUSENTE')
  union all
  -- limpeza independente: pg_cron disponível/instalado?
  select 17, 'pg_cron', coalesce((select 'disponivel ' || default_version || coalesce(' instalado ' || installed_version, ' (nao instalado)') from pg_available_extensions where name = 'pg_cron'), 'indisponivel')
  union all
  -- contagens pra comparar com o CSV e depois da fase 1
  select 18, 'contagens', 'placar=' || (select count(*) from public.placar) || ' max_id=' || coalesce((select max(id) from public.placar)::text, '-')
    || ' denuncias=' || (select count(*) from public.denuncias) || ' max_id=' || coalesce((select max(id) from public.denuncias)::text, '-')
  union all
  select 19, 'placar.periodo', (select min(criado_em) || ' a ' || max(criado_em) from public.placar)
  union all
  -- autenticação (esperado: 0 usuários)
  select 20, 'auth.usuarios', (select count(*)::text from auth.users)
  union all
  select 21, 'versao_postgres', current_setting('server_version')
) r order by o;
