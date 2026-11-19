-- Grau 80cc · OPCIONAL, NÃO EXECUTADO. Precisa de aprovação própria (instala uma extensão no banco real).
-- Problema: a fase 1 só apaga bilhetes com mais de 6 h (e o hash do IP junto) quando alguém chama grau_iniciar.
-- Se ninguém jogar por dias, os últimos bilhetes ficam no banco por dias. Não existe outra rotina de limpeza.
-- Solução: pg_cron (disponível no plano grátis, versão 1.6.4, hoje NÃO instalado) roda a limpeza de hora em hora,
-- independente de partidas. Custo: nenhum. Também dá pra ligar pelo painel: Integrations › Cron.

create extension if not exists pg_cron;
select cron.schedule('grau-limpeza-bilhetes', '17 * * * *',
  $$delete from public.grau_corridas where criado_em < now() - interval '6 hours'$$);

-- conferir: select jobname, schedule, active from cron.job;
-- histórico: select status, start_time from cron.job_run_details order by start_time desc limit 5;
-- DESFAZER: select cron.unschedule('grau-limpeza-bilhetes');  (e, se quiser, drop extension pg_cron;)
