-- Grau 80cc · evidência pra liberar a fase 2. SÓ LEITURA.
-- Depois da fase 1, cada recorde novo fica marcado: 'bilhete' (1.5 e site novo) ou 'direto' (1.4 ou site em cache).
-- Critério pra fase 2: nenhum 'direto' novo por 7 dias seguidos, com a 1.5 no Alpha e o site publicado.
-- LIMITAÇÃO: zero 'direto' por 7 dias NÃO prova que todo mundo saiu da 1.4. Só mostra que ninguém na 1.4
-- (ou no site em cache) mandou recorde nesse período: quem não jogou, ou jogou sem bater recorde, não aparece.
-- Pra essas pessoas, depois da fase 2, o efeito é só "Não deu pra enviar" no placar; o resto do jogo segue igual.

-- recordes por caminho, por dia, desde a fase 1 (trocar a data pela hora em que a fase 1 rodou)
select date_trunc('day', criado_em) dia, via, count(*) recordes, max(criado_em) ultimo
from public.placar where criado_em >= '2026-11-20 00:00:00-03'
group by 1, 2 order by 1, 2;

-- o IP está chegando de verdade? (esperado: sem_ip = 0; se for tudo sem-ip, o limite por IP não está valendo)
select count(*) bilhetes_6h, count(*) filter (where ip_hash = 'sem-ip') sem_ip,
       count(distinct ip_hash) origens, count(*) filter (where usado_em is not null) usados
from public.grau_corridas;
