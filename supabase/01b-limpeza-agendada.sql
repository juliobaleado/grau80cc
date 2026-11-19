-- Grau 80cc · limpeza agendada dos bilhetes de partida (dados temporários de prevenção de fraude).
-- Problema: a fase 1 só apaga bilhetes com mais de 6 h (e o hash do IP junto) quando alguém chama grau_iniciar.
-- Se ninguém jogar por dias, os últimos bilhetes ficariam no banco por dias. Não existe outra rotina de limpeza.
-- Solução: pg_cron (disponível no plano grátis) roda a limpeza de hora em hora, no minuto 17,
-- independente de partidas. Prazo real de exclusão: até ~7 h depois do bilhete ser criado. Custo: nenhum.
--
-- Efeitos: instala a extensão pg_cron (schema "cron") e cria UM job. O job só apaga linhas de
-- public.grau_corridas com mais de 6 h. Não toca placar, denuncias, grau_nomes nem grau_config.
-- Bilhete com mais de 6 h já é recusado pelo grau_enviar ('partida_expirada'), então nenhuma partida válida é afetada.

begin;

create extension if not exists pg_cron;

-- trava: se já existir um job com esse nome, para tudo (cron.schedule com nome repetido sobrescreveria o job)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'grau-limpeza-bilhetes') then
    raise exception 'job grau-limpeza-bilhetes já existe; nada foi alterado';
  end if;
end $$;

select cron.schedule('grau-limpeza-bilhetes', '17 * * * *',
  $$delete from public.grau_corridas where criado_em < now() - interval '6 hours'$$);

commit;

-- conferir:   select jobid, jobname, schedule, active, command from cron.job;
-- histórico:  select status, return_message, start_time, end_time from cron.job_run_details order by start_time desc limit 5;
-- PAUSAR (sem apagar):  select cron.alter_job((select jobid from cron.job where jobname = 'grau-limpeza-bilhetes'), active := false);
-- DESFAZER:   select cron.unschedule('grau-limpeza-bilhetes');
--   (opcional, só se nenhum outro job usar: drop extension pg_cron;)
-- Pausar ou desfazer não afeta placar, denúncias nem as funções da fase 1: só volta a limpeza a depender de grau_iniciar.
