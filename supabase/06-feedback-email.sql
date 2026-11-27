-- Grau 80cc · e-mail a cada feedback novo (via Resend), pro grau80ccgame@gmail.com
-- ADITIVA e idempotente: só cria uma função e um gatilho na tabela grau_feedback (05-feedback.sql).
--
-- Como funciona: depois de gravar um feedback, o gatilho chama a API do Resend pelo pg_net (assíncrono: o envio do
-- jogador não espera o e-mail). Se der qualquer erro (sem chave, Resend fora, limite), o feedback continua gravado.
--
-- ANTES de rodar, uma vez só (feito pelo Julio, a chave nunca passa pelo código nem pelo git):
--   1. criar a conta no resend.com COM o e-mail grau80ccgame@gmail.com (sem domínio próprio, o Resend só manda
--      pro e-mail da própria conta, usando o remetente onboarding@resend.dev);
--   2. criar uma API key (permissão "Sending access");
--   3. no SQL Editor do Supabase:  select vault.create_secret('COLE_A_CHAVE_AQUI', 'resend_api_key', 'Resend: e-mail de feedback');
-- Sem a chave no Vault o gatilho não faz nada (o feedback segue só na tabela).
--
-- Limite: no máximo 90 e-mails por dia (o grátis do Resend é 100/dia e 3.000/mês); passou disso, fica só na tabela.
-- Desfazer: ver "ROLLBACK" no fim.

begin;

create extension if not exists pg_net with schema extensions;

create or replace function public.grau_feedback_email() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  k text;
begin
  begin
    select decrypted_secret into k from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
    if k is null or btrim(k) = '' then return new; end if;
    if (select count(*) from public.grau_feedback where criado_em > now() - interval '1 day') > 90 then return new; end if;
    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || btrim(k), 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', 'Grau 80cc <onboarding@resend.dev>',
        'to', jsonb_build_array('grau80ccgame@gmail.com'),
        'subject', '[Grau 80cc] Feedback: ' || new.categoria,
        -- só texto puro (sem HTML): a mensagem do jogador nunca vira código no e-mail
        'text', 'Assunto: ' || new.categoria
          || E'\nQuando: ' || to_char(new.criado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
          || E'\nInfo técnica: ' || coalesce(new.info, '(não enviada)')
          || E'\n\n' || new.mensagem
          || E'\n\n— feedback nº ' || new.id || ' (tabela grau_feedback no Supabase)'
      )
    );
  exception when others then
    null; -- o e-mail nunca derruba o feedback
  end;
  return new;
end $$;
revoke all on function public.grau_feedback_email() from public, anon, authenticated;

drop trigger if exists grau_feedback_email on public.grau_feedback;
create trigger grau_feedback_email after insert on public.grau_feedback
  for each row execute function public.grau_feedback_email();

commit;

-- ROLLBACK (só se precisar desfazer; o feedback continua funcionando, só para o e-mail):
-- drop trigger if exists grau_feedback_email on public.grau_feedback;
-- drop function if exists public.grau_feedback_email();
-- e, se quiser apagar a chave:  delete from vault.secrets where name = 'resend_api_key';
