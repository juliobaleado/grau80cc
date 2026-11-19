-- Grau 80cc · fase 2: fecha o insert direto na tabela placar e tira permissões que sobraram.
-- SÓ RODA DEPOIS QUE:
--   1. a fase 1 (01-placar-seguro.sql) estiver rodada e testada;
--   2. o site com o envio novo estiver no ar (GitHub Pages);
--   3. o APK novo (que usa grau_enviar) estiver no teste fechado.
-- Efeito colateral esperado: a versão antiga do jogo (APK 1.4 e site em cache) deixa de conseguir
-- mandar recorde ("Não deu pra enviar"). Ler o placar continua funcionando pra todo mundo.
-- Nenhum recorde existente é apagado ou alterado.

drop policy if exists "placar: todos enviam" on public.placar;
revoke insert on public.placar from anon, authenticated;

-- privilégios que o jogo nunca usa (o PostgREST nem expõe TRUNCATE, mas não precisa existir)
revoke truncate, trigger, references on public.denuncias from anon, authenticated;
revoke truncate, trigger, references on public.placar from anon, authenticated;

notify pgrst, 'reload schema';

-- Desfazer (reabre o insert direto como era antes):
-- grant insert (nome, metros, segundos, bike) on public.placar to anon, authenticated;
-- create policy "placar: todos enviam" on public.placar for insert to anon, authenticated with check (true);
