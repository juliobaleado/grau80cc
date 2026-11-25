-- Grau 80cc · motos novas no placar: Pó-pop Bicilíndrica (pop2) e Robozão (gs)
-- Troca SÓ a função grau_enviar: aceita as duas chaves novas e dá a cada uma a média máxima coerente com o jogo.
-- Não mexe em tabela, dado, permissão, bilhete, nome nem limite de envio. As 5 bikes antigas ficam com o mesmo limite.
-- Sem isto, o jogo responde "O placar não aceitou esse grau" (bike_invalida) para recordes feitos com as motos novas.
-- Roda no SQL Editor do Supabase (transação única). Teste isolado: testes/sql-motos.mjs

begin;

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
  if p_bike is null or p_bike !~ '^(caicara|monark|xr|bikelete|bruno|pop2|gs)$' then return 'bike_invalida'; end if;
  if p_metros is null or p_segundos is null or p_metros < 3 or p_metros > 20000 or p_segundos <= 0 then
    return 'valores_invalidos';
  end if;
  -- média máxima possível: a Titan chega perto de 24 m/s, as outras perto de 20 m/s
  vmax := case p_bike when 'bruno' then 25 when 'pop2' then 27 when 'gs' then 31 else 21 end; -- máxima no jogo + folga: Titânica ~22,4, Pó-pop ~25, Robozão ~28,3 m/s
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
  insert into placar (nome, metros, segundos, bike, via) values (nome, round(p_metros, 1), round(p_segundos, 1), p_bike, 'bilhete');
  return 'ok';
end $$;

-- create or replace mantém as permissões; repetidas aqui só pra deixar explícito
revoke all on function public.grau_enviar(uuid, text, numeric, numeric, text, text, boolean) from public;
grant execute on function public.grau_enviar(uuid, text, numeric, numeric, text, text, boolean) to anon, authenticated;

commit;

-- DESFAZER: rodar de novo o bloco "create or replace function public.grau_enviar" de 01-placar-seguro.sql
-- (lista sem pop2/gs e vmax = case when p_bike = 'bruno' then 25 else 21 end). Recordes já gravados ficam.
