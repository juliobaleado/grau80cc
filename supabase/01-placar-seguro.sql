-- Grau 80cc · fase 1 da segurança do placar (ADITIVA: não apaga nem muda nada que já existe)
-- Roda no SQL Editor do Supabase. Pode rodar de novo sem problema (idempotente).
--
-- O que muda:
--   * cada partida do Modo Motoca pede um "bilhete" (grau_iniciar) com a hora do servidor;
--   * o recorde só entra pelo grau_enviar, que confere o bilhete (uso único, validade de 6 h),
--     se o tempo da empinada cabe no tempo real desde o começo da partida, a velocidade média
--     máxima de cada bike, nome proibido, nome já usado por outro aparelho e limites de envio;
--   * denúncias ganham limite de volume (contra flood que encheria o banco).
-- O insert direto na tabela placar continua aberto até a fase 2 (02-fechar-insert-direto.sql),
-- pra versão antiga do jogo (site em cache e APK 1.4) não quebrar antes da hora.
--
-- Desfazer tudo: ver o bloco "ROLLBACK" no fim do arquivo.

create extension if not exists pgcrypto with schema extensions;

-- sal aleatório pra transformar o IP em hash (o IP em si nunca é guardado)
create table if not exists public.grau_config (
  chave text primary key,
  valor text not null
);
alter table public.grau_config enable row level security;
revoke all on public.grau_config from anon, authenticated;
insert into public.grau_config (chave, valor)
  values ('sal_ip', encode(extensions.gen_random_bytes(16), 'hex'))
  on conflict (chave) do nothing;

-- bilhetes de partida (somem sozinhos depois de 6 h)
create table if not exists public.grau_corridas (
  token uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  ip_hash text not null,
  usado_em timestamptz
);
create index if not exists grau_corridas_ip_idx on public.grau_corridas (ip_hash, criado_em);
alter table public.grau_corridas enable row level security;
revoke all on public.grau_corridas from anon, authenticated;

-- dono de cada nome do placar: o primeiro aparelho que envia com um nome fica com ele
-- (guarda só o hash de um código aleatório do aparelho, nada pessoal)
create table if not exists public.grau_nomes (
  nome_chave text primary key,
  dono_hash text not null,
  criado_em timestamptz not null default now()
);
alter table public.grau_nomes enable row level security;
revoke all on public.grau_nomes from anon, authenticated;

-- hash do IP de quem chamou (PostgREST repassa os cabeçalhos da requisição).
-- Ordem de confiança: cf-connecting-ip (a Cloudflare na frente do Supabase sobrescreve, o cliente não forja),
-- x-real-ip, e por último o ÚLTIMO item do x-forwarded-for (o primeiro item é o cliente que escreve).
create or replace function public.grau_ip() returns text
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare
  h json := nullif(current_setting('request.headers', true), '')::json;
  xff text[] := regexp_split_to_array(coalesce(h->>'x-forwarded-for', ''), '\s*,\s*');
  ip text;
begin
  ip := coalesce(
    nullif(btrim(h->>'cf-connecting-ip'), ''),
    nullif(btrim(h->>'x-real-ip'), ''),
    nullif(btrim(xff[array_length(xff, 1)]), ''),
    '');
  -- sem IP identificável: devolve 'sem-ip' e as funções pulam o limite por IP (ficam só os limites globais),
  -- pra não travar todo mundo junto se o Supabase não repassar nenhum desses cabeçalhos
  if ip = '' then return 'sem-ip'; end if;
  return encode(extensions.digest(ip || (select valor from public.grau_config where chave = 'sal_ip'), 'sha256'), 'hex');
end $$;
revoke all on function public.grau_ip() from public, anon, authenticated;

-- nomes proibidos: palavrão/ofensa óbvia e quem tenta se passar pela moderação.
-- A mesma lista está no jogo (NOME_RUIM). Não pega tudo: é uma barreira, não um filtro perfeito.
create or replace function public.grau_nome_proibido(p text) returns boolean
language sql immutable set search_path = pg_catalog, pg_temp as $$
  with n as (
    select translate(lower(coalesce(p, '')),
      'áàâãäéèêëíìîïóòôõöúùûüç0134578@$!|',
      'aaaaaeeeeiiiiooooouuuucoieastbasii') as t
  ), j as (
    select regexp_replace(t, '[^a-z]', '', 'g') as junto,
           regexp_split_to_array(regexp_replace(t, '[^a-z]+', ' ', 'g'), ' ') as palavras
    from n
  )
  select junto ~ '(caralh|bucet|bocet|xoxot|piroc|pirok|punhet|arrombad|filhodaput|fdput|viadinh|viadao|estupr|pedofil|nazis|hitler|retardad|vagabund|nigg|fuck|cunt|bitch|admin|moderad|moderac|suport|grau80|graubo|staff|oficial)'
      or (palavras || array[junto]) && array['puta','putas','puto','cu','fdp','vsf','tnc','pnc','pqp','kct','krl','porra','viado','viados','bixa','bicha','corno','cuzao','merda','buceta','pau','rola']
  from j
$$;

-- começa uma partida do Modo Motoca e devolve o bilhete
create or replace function public.grau_iniciar() returns uuid
language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare
  ip text := grau_ip();
  t uuid;
begin
  delete from grau_corridas where criado_em < now() - interval '6 hours';
  -- generoso porque muita gente no Brasil divide o mesmo IP da operadora (CGNAT)
  if ip <> 'sem-ip' and (select count(*) from grau_corridas where ip_hash = ip and criado_em > now() - interval '10 minutes') >= 300 then
    raise exception 'muitas_partidas' using errcode = 'P0001';
  end if;
  if (select count(*) from grau_corridas) >= 200000 then
    raise exception 'servidor_ocupado' using errcode = 'P0001';
  end if;
  insert into grau_corridas (ip_hash) values (ip) returning token into t;
  return t;
end $$;

-- envia o recorde. Devolve 'ok' ou o motivo da recusa. p_teste = true confere tudo e não grava.
create or replace function public.grau_enviar(
  p_token uuid, p_nome text, p_metros numeric, p_segundos numeric, p_bike text, p_dono text,
  p_teste boolean default false
) returns text
language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare
  c grau_corridas%rowtype;
  ip text := grau_ip();
  nome text := btrim(regexp_replace(coalesce(p_nome, ''), '[[:cntrl:]]', '', 'g'));
  chave text;
  dono text;
  vmax numeric;
  decorrido numeric;
  d grau_nomes%rowtype;
begin
  select * into c from grau_corridas where token = p_token for update;
  if not found then return 'partida_invalida'; end if;
  if c.usado_em is not null then return 'partida_usada'; end if;
  decorrido := extract(epoch from now() - c.criado_em);
  if decorrido > 6 * 3600 then return 'partida_expirada'; end if;

  if char_length(nome) < 1 or char_length(nome) > 16 then return 'nome_invalido'; end if;
  if p_bike is null or p_bike !~ '^(caicara|monark|xr|bikelete|bruno)$' then return 'bike_invalida'; end if;
  if p_metros is null or p_segundos is null or p_metros < 3 or p_metros > 20000 or p_segundos <= 0 then
    return 'valores_invalidos';
  end if;
  -- média máxima possível: a Titan chega perto de 24 m/s, as outras perto de 20 m/s
  vmax := case when p_bike = 'bruno' then 25 else 21 end;
  if p_metros > p_segundos * vmax then return 'rapido_demais'; end if;
  -- a empinada não pode ter durado mais do que o tempo real desde que a partida começou
  if p_segundos > decorrido + 3 then return 'tempo_impossivel'; end if;
  if grau_nome_proibido(nome) then return 'nome_proibido'; end if;
  if p_dono is null or p_dono !~ '^[a-f0-9]{32}$' then return 'dono_invalido'; end if;

  chave := lower(regexp_replace(nome, '\s+', ' ', 'g'));
  dono := encode(extensions.digest(p_dono, 'sha256'), 'hex');
  select * into d from grau_nomes where nome_chave = chave;
  if found and d.dono_hash <> dono then return 'nome_em_uso'; end if;

  if ip <> 'sem-ip' and (select count(*) from grau_corridas where ip_hash = ip and usado_em > now() - interval '10 minutes') >= 20 then
    return 'muitos_envios';
  end if;
  if (select count(*) from placar where criado_em > now() - interval '1 minute') >= 30 then
    return 'placar_ocupado';
  end if;

  if p_teste then return 'ok_teste'; end if;

  update grau_corridas set usado_em = now() where token = p_token;
  insert into grau_nomes (nome_chave, dono_hash) values (chave, dono) on conflict (nome_chave) do nothing;
  insert into placar (nome, metros, segundos, bike) values (nome, round(p_metros, 1), round(p_segundos, 1), p_bike);
  return 'ok';
end $$;

-- o jogo tem a própria cópia da lista; a função do banco não precisa ficar exposta como RPC
revoke all on function public.grau_nome_proibido(text) from public, anon, authenticated;
revoke all on function public.grau_iniciar() from public;
revoke all on function public.grau_enviar(uuid, text, numeric, numeric, text, text, boolean) from public;
grant execute on function public.grau_iniciar() to anon, authenticated;
grant execute on function public.grau_enviar(uuid, text, numeric, numeric, text, text, boolean) to anon, authenticated;

-- denúncias: no máximo 20 por minuto e 300 por hora no total (denúncia de verdade é rara;
-- isso só impede alguém de encher o banco com um script)
create or replace function public.grau_denuncia_limite() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select count(*) from denuncias where criado_em > now() - interval '1 minute') >= 20
     or (select count(*) from denuncias where criado_em > now() - interval '1 hour') >= 300 then
    raise exception 'muitas_denuncias' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists grau_denuncia_limite on public.denuncias;
create trigger grau_denuncia_limite before insert on public.denuncias
  for each row execute function public.grau_denuncia_limite();
create index if not exists denuncias_criado_idx on public.denuncias (criado_em);
create index if not exists placar_criado_idx on public.placar (criado_em);

notify pgrst, 'reload schema';

-- ROLLBACK (só se precisar desfazer a fase 1):
-- drop trigger if exists grau_denuncia_limite on public.denuncias;
-- drop function if exists public.grau_denuncia_limite();
-- drop function if exists public.grau_enviar(uuid, text, numeric, numeric, text, text, boolean);
-- drop function if exists public.grau_iniciar();
-- drop function if exists public.grau_nome_proibido(text);
-- drop function if exists public.grau_ip();
-- drop table if exists public.grau_nomes, public.grau_corridas, public.grau_config;
-- drop index if exists public.denuncias_criado_idx, public.placar_criado_idx;
