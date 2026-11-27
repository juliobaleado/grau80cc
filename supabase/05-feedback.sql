-- Grau 80cc · feedback dentro do jogo (ADITIVA: não apaga nem muda nada que já existe)
-- Roda no SQL Editor do Supabase. Pode rodar de novo sem problema (idempotente).
--
-- O que cria:
--   * tabela grau_feedback (privada: RLS ligada e nenhum acesso direto pra anon/authenticated);
--   * função grau_feedback(categoria, mensagem, info) que valida e grava. Devolve 'ok' ou o motivo da recusa.
-- Limites: mensagem de 3 a 1.000 caracteres, info técnica até 300 caracteres, 5 envios por IP a cada 10 minutos,
-- 30 por IP por dia e 400 no total por hora (contra spam e flood). O IP nunca é guardado: só o hash com sal (grau_ip()).
-- Nada é publicado: as mensagens só aparecem pra quem acessa o painel do Supabase (Table editor › grau_feedback).
--
-- Desfazer tudo: ver o bloco "ROLLBACK" no fim do arquivo.

begin;

create table if not exists public.grau_feedback (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  categoria text not null check (categoria in ('bug', 'melhoria', 'moto', 'opiniao', 'outro')),
  mensagem text not null check (char_length(mensagem) between 3 and 1000),
  info text check (info is null or char_length(info) <= 300),
  ip_hash text not null,
  lido boolean not null default false
);
alter table public.grau_feedback enable row level security;
revoke all on public.grau_feedback from anon, authenticated;
create index if not exists grau_feedback_ip_idx on public.grau_feedback (ip_hash, criado_em);
create index if not exists grau_feedback_criado_idx on public.grau_feedback (criado_em);

create or replace function public.grau_feedback(p_categoria text, p_mensagem text, p_info text default null) returns text
language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare
  ip text := grau_ip();
  msg text := btrim(coalesce(p_mensagem, ''));
  inf text := nullif(btrim(coalesce(p_info, '')), '');
begin
  if p_categoria is null or p_categoria not in ('bug', 'melhoria', 'moto', 'opiniao', 'outro') then return 'categoria_invalida'; end if;
  if char_length(msg) < 3 or char_length(msg) > 1000 then return 'mensagem_invalida'; end if;
  if inf is not null and char_length(inf) > 300 then inf := left(inf, 300); end if;
  -- tira caracteres de controle (menos quebra de linha) pra não poluir o painel
  msg := regexp_replace(msg, '[\x00-\x09\x0B-\x1F\x7F]', '', 'g');
  if ip <> 'sem-ip' and (
       (select count(*) from grau_feedback where ip_hash = ip and criado_em > now() - interval '10 minutes') >= 5
    or (select count(*) from grau_feedback where ip_hash = ip and criado_em > now() - interval '1 day') >= 30) then
    return 'muitos_envios';
  end if;
  if (select count(*) from grau_feedback where criado_em > now() - interval '1 hour') >= 400 then return 'servidor_ocupado'; end if;
  insert into grau_feedback (categoria, mensagem, info, ip_hash) values (p_categoria, msg, inf, ip);
  return 'ok';
end $$;
revoke all on function public.grau_feedback(text, text, text) from public;
grant execute on function public.grau_feedback(text, text, text) to anon, authenticated;

commit;

-- ROLLBACK (só se precisar desfazer):
-- drop function if exists public.grau_feedback(text, text, text);
-- drop table if exists public.grau_feedback;
