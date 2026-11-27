# Grau 80cc — UI/UX Evolution V1 (lobby, garagem e experiência do jogador)

Branch: `feature/lobby-ui-ux-v1` · 27/11/2026 · Não mergeado, não publicado, nada enviado à Play.

## 1. Diagnóstico inicial (verified)
Uma coluna só à direita misturava: frase de apresentação, logo em texto, música + idiomas, recorde, lista textual de
conquistas, 8 linhas de personalização com setas, 7 botões (modos, controles, conquistas), instruções longas, 5 botões
de tutorial/novidades/feedback/dicas e o aviso de ficção. No celular deitado, os modos ficavam abaixo da garagem.
O problema era a arquitetura da informação, não a falta de recurso. O placar, o Pix e o chat ocupavam o cenário à esquerda.

## 2. Contrato de funcionalidades (nada sumiu)
| Funcionalidade | Antes | Agora | Validação |
|---|---|---|---|
| Modo Motoca / Livre / Multiplayer | botões na lista | cards na aba Jogar (Motoca dominante) | lobby.cjs: à vista sem rolar em 10 telas |
| Bora / Sair da sala | botões | iguais, dentro dos cards | multiplayer.cjs |
| Recorde pessoal | linha no cartão | faixa do perfil, com o apelido | lobby.cjs |
| Personalização (8 linhas) | lista com setas | aba Garagem com 5 categorias e grade | lobby.cjs, marcas-compat.cjs |
| Item bloqueado | desabilitado, só tooltip | clicável: mostra o requisito + "Ver conquistas"; não equipa | lobby.cjs |
| Conquistas | botão + lista textual | aba Conquistas (contador) → modal; lista textual removida | conquistas.cjs |
| Placar global | painel à esquerda | igual, compacto (top 5) + "Ver top 10" → modal Ranking com o Rei do Grau | lobby.cjs, offline.cjs |
| Chat global | coluna fixa | recolhível (preferência salva), online e não lidas | lobby.cjs, seguranca.cjs |
| Música, idioma | topo do cartão | Configurações | lobby.cjs |
| Som (efeitos) | só no HUD | também em Configurações (mesma preferência) | lobby.cjs |
| Apelido | só no Multiplayer/placar | também em Configurações (mesma validação) | lobby.cjs |
| Controles | botão | Configurações → painel de controles | lobby.cjs |
| Dicas do Agenor (ligar/desligar) | botão | Configurações | dicas.cjs |
| Tutoriais, instruções, aviso de ficção | cartão | Ajuda | onboarding.cjs, lobby.cjs |
| Novidades | botão | ícone ★ no cabeçalho (pontinho se não lida) + Ajuda | novidades-feedback.cjs |
| Feedback | botão | Ajuda | novidades-feedback.cjs |
| Apoio (Pix / pastéis da Play) | cartão à esquerda | Pastel do Agenor (botão no Jogar ou a placa no cenário) | lobby.cjs |
| Caramelos especiais | linha da garagem | Garagem › Caramelo (atalho no Pastel do Agenor) | lobby.cjs |
| Modo teste (5 toques no título) | h1 | h1 do logo | — |

## 3. Arquitetura da informação
Cabeçalho (logo, ★ novidades, ? ajuda, ⚙ configurações) → perfil (apelido + recordes) → abas **Jogar · Garagem ·
Conquistas · Ranking**. Jogar e Garagem trocam o conteúdo do painel; Conquistas e Ranking abrem as áreas dedicadas.
Secundário: Configurações, Ajuda e Pastel do Agenor. O cenário vivo (pastelaria, piloto, motor, caramelo, gato) continua
atrás e serve de prévia da garagem.

## 4. Direção artística
"Arcade urbano brasileiro — o lobby vivo do Pastel do Agenor". Logo oficial no cabeçalho; faixa racing
(vermelho→caramelo→dourado→lilás) no topo do painel; card do Modo Motoca em dourado/laranja com quadriculado de largada;
Livre com borda verde e Multiplayer com borda lilás; Pastel do Agenor com toldo vermelho e branco e o Caramelo;
Ranking com a logo da coroa e o Rei do Grau em dourado. Tipografia: Bowlby One nos títulos, modos e recordes;
Barlow Condensed no resto.

## 5. Tokens e componentes
Novos tokens: `--surface #16252d`, `--surface2 #1d313b`, `--gold #ffd763`, `--lilac #913775`, `--racing #f00020`,
`--caramel #ff9810`, `--line`, `--r-sm 6px`, `--r-md 10px`, `--ease`. Mantidos: `--night`, `--sodium`, `--ink`,
`--muted`, `--ok`, `--danger`, `--display`, `--hud`.
Componentes: `.ibtn` (botão de ícone com foco), `.lnav` (abas), `.mode`/`.mmain` (cards de modo), `.lagenor`,
`.gcats` (categorias), `.sw.locked` + `.greq` (bloqueado e requisito), `.lmodal`/`.srow` (configurações),
`.agcard`/`.awning`, `.rankcard`/`.rking`/`.rlist`, `.chattab`/`.badge`.
**Pendente:** prancha de componentes separada (G2 parcial).

## 6. Decisões de UX
- Jogar está a um toque: os três modos aparecem sem rolar em todas as telas testadas.
- A garagem é a própria cena: equipar troca o piloto e a motoca na hora, sem segundo renderizador.
- Item bloqueado explica como liberar, em vez de só ficar cinza.
- Menos coisa competindo com os modos: o que é configuração foi pra ⚙, o que é aprendizado foi pra ?.
- Chat recolhido por padrão, porque libera o cenário; quem abrir continua com ele aberto.
- O tour dos menus foi pra v2 (a interface mudou); o tutorial de como jogar continua na v1.

## 7. Ativos utilizados (identidade-visual/ → img/, WebP)
`logo-grau80cc.webp` (565 px, 22 KB), `logo-coroa.webp` (420 px, 31 KB), `caramelo.webp` (360 px, 46 KB),
`caramelo-patinete.webp` (300 px, 34 KB, ainda sem uso). Feitos a partir dos PNGs transparentes aprovados. Os SVGs não
foram usados (vetorização automática), e os wallpapers também não, porque o cenário vivo continua.

## 8. Funcionalidades preservadas
Ver o contrato acima. Física, regras, ranking (em metros), compras, conquistas e dados salvos não mudaram.

## 9 e 10. Arquivos e commits
`index.html` (lobby), `img/*.webp`, `.gitignore` (libera `img/` e `docs/`), `testes/lobby.cjs` e
`testes/lobby-capturas.cjs` (novos), testes antigos ajustados (tour v2 e botões que agora ficam dentro da Ajuda), este
documento. Commits na branch `feature/lobby-ui-ux-v1`.

## 11. Evidências
Capturas em `play-store/lobby/antes` (main) e `play-store/lobby/depois` (branch), em resolução original, geradas por
`node testes/lobby-capturas.cjs`.

## 12. Matriz de responsividade (lobby.cjs)
1920×1080, 1440×900, 1366×768, 1280×720, 1024×768, 768×1024, 844×390 (toque), 667×375 (toque), 390×844 e 360×800 (janela
estreita): modos, abas e recorde à vista sem rolar, sem rolagem horizontal. Celular e tablet em pé com toque mostram o aviso
"Deita o celular" (orientação do app não mudou).

## 13. Testes
lobby 34, onboarding 81, frases 20, conquistas 28, compartilhar 23, dicas 13, novidades/feedback 26, marcas 44,
multiplayer 15, D.U.R.O. 9, segurança 23, offline 6: **322 ok, 0 falha**. Defeito achado e corrigido: o Esc não fechava
modal com o foco num campo de texto.

## 14. Performance
Nenhum loop, timer ou listener novo durante a partida; os modais só existem no DOM. As imagens somam ~133 KB. FPS e
memória: **não medidos** nesta rodada.

## 15. Rubrica artística (autoavaliação, não independente)
| Dimensão | Peso | Nota | Evidência |
|---|---:|---:|---|
| Identidade própria | 15% | 8 | logo oficial, faixa racing, quadriculado, toldo do Agenor, coroa |
| Hierarquia visual | 15% | 8 | Motoca dominante, Livre/Multi secundários, ações de apoio discretas |
| Composição e equilíbrio | 15% | 7 | painel à direita + cena; em telas grandes sobra vazio em volta do painel |
| Tipografia | 10% | 8 | display só em títulos, modos e recordes |
| Coerência dos componentes | 10% | 7 | modais novos coerentes; Multiplayer, Controles e Pix ainda no estilo antigo |
| Integração com o cenário | 15% | 7 | cena intacta e prévia ao vivo; o painel ainda é uma camada separada |
| Acabamento | 10% | 7 | foco, estados e responsividade ok; faltam ícones próprios nas categorias |
| Microinterações | 10% | 6 | troca de aba, hover, pulso de novidade; sem animação de equipar |
| **Média ponderada** | | **7,3** | |

## 16. Rubrica de UX (autoavaliação)
Iniciar partida 9 · descobrir modos 9 · personalizar 8 · bloqueados claros 8 · conquistas 8 · ranking 8 ·
configurações 8 · ajuda 8 · legibilidade 8 · consistência 7 · responsividade 8 · sem etapas desnecessárias 9.
Problemas: os modais antigos (Multiplayer, Controles, Pix) destoam um pouco; em telas grandes o painel poderia crescer.

## 17. Gates
G0 baseline: passed (Git, inventário, testes, capturas antes em 1280×720 e 844×390) · G1 arquitetura: passed ·
G2 direção artística: partial (sem prancha de componentes) · G3 lobby: passed · G4 áreas: passed ·
G5 responsividade: passed no navegador, Android real not_verified · G6 integração: passed (analytics só como pontos de
integração) · G7 qualidade artística: partial (autoavaliação, sem avaliação independente) · G8 handoff: passed.

## 18 e 19. Limitações e pendências
Prancha de componentes; restyle dos modais antigos (Multiplayer, Controles, Pix/pastéis); ícones próprios nas categorias
da garagem; animação de equipar; medir FPS; testar no Android real; avaliação artística independente; **no build do
APK, copiar a pasta `img/` pra `app/www/`**.

## 20. Validação manual
`git checkout feature/lobby-ui-ux-v1` e abrir o `index.html` por um servidor local (ex.: `npx serve .`), ou pedir pra
publicar uma prévia. Conferir: jogar pelos três cards; Garagem (categorias, equipar, tocar num item com cadeado);
Conquistas; Ranking; ⚙ (apelido, efeitos, idioma, controles, dicas); ? (tutoriais, instruções, feedback); Pastel do Agenor
(botão e placa no cenário); chat (abrir/fechar, reabrir o jogo); celular deitado.

---

# V1.1 · refinamento após avaliação visual independente (27/11/2026)

**Escopo:** só acabamento, responsividade, integração com o cenário e pendências. Mesma estrutura, mesma branch, sem merge nem APK enviado.

## Correções P0
| Problema (avaliação externa, 667×375 e 844×390) | Correção | Evidência |
|---|---|---|
| Chat expandido cobrindo o lobby | em tela baixa vira um painel próprio na área livre à esquerda (largura calculada pelo painel); o placar some enquanto o chat está aberto | `lobby.cjs`: sem interseção chat × painel, campo à vista com teclado simulado |
| Garagem escondendo a moto | enquadramento só do lobby: a moto vai pro meio da área livre à esquerda do painel (sem mexer em física nem coordenadas; volta ao normal na partida) | `lobby.cjs`: piloto e moto inteiros fora do painel em 667, 844, 1024, 1366 |
| "Jogar" flutuante por cima da garagem | rodapé fixo "▶ Jogar" reservado dentro da garagem; botão flutuante some com a garagem aberta | `lobby.cjs`: último item alcançável acima do rodapé |

## Refinamentos
- **Garagem como coleção:** cards com estado equipado (borda e brilho dourados + ✓), disponível, bloqueado (tracejado, cadeado), especial (★ dourado: caramelos de apoio e de testador), cores em grade maior com anel na selecionada, microinteração curta ao equipar.
- **Modais unificados:** mesma superfície, raio, borda, fechar redondo fixo no topo da rolagem, campos e seleção com o mesmo estilo, indicação de continuidade quando tem mais conteúdo embaixo, coluna única em tela baixa (Multiplayer, Controles, Pix, Conquistas, Ajuda, Configurações, Ranking).
- **Tipografia:** textos secundários com mínimo de 11–12 px em tela baixa; reorganização (perfil some na garagem em tela baixa) em vez de encolher fonte.
- **Pastel do Agenor:** ilustração nova "Caramelo saboreando pastel" (`img/caramelo-pastel.webp`, 42 KB).
- **Prancha de componentes:** `docs/componentes.html` (CSS real do jogo) e `play-store/lobby/prancha.png`, gerados por `node testes/prancha.cjs`.

## Testes
lobby 76 (eram 34: +42 verificações geométricas de tela baixa), onboarding 81, frases 20, conquistas 28, compartilhar 23, dicas 13,
novidades/feedback 26, marcas 44, multiplayer 15, D.U.R.O. 9, segurança 23, offline 6: **364 ok, 0 falha**. Defeitos que os testes novos
acharam e que foram corrigidos: rodapé da garagem fora da tela em 667/844; card do Rei do Grau com rolagem lateral (largura + padding).

## Performance (Chrome de computador, NÃO é aparelho real)
`node testes/performance.cjs <index da main>`: lobby 75 FPS, p95 13,5 ms, memória 24,2 MB (main: 75 / 13,4 ms / 23,8 MB); volta 75 FPS,
p95 13,5 ms (igual). Um quadro longo isolado na largada aparece nas duas versões, de forma intermitente: não é regressão.

## Rubrica artística (autoavaliação; a externa estimou 7,1–7,2)
Identidade 8 · hierarquia 8 · composição 7,5 · tipografia 8 · coerência 8 (+1: modais unificados) · integração com o cenário 8 (+1: moto
enquadrada na área livre) · acabamento 7,5 · microinterações 6,5. **Média ponderada ≈ 7,7.** Ainda é autoavaliação.

## Rubrica de UX
Iniciar 9 · modos 9 · personalizar 8,5 · bloqueados 8,5 · conquistas 8 · ranking 8,5 · configurações 8 · ajuda 8 · legibilidade 8 ·
consistência 8,5 · responsividade 8,5 · sem etapas desnecessárias 9.

## Gates V1.1
G3 lobby: passed · G4 áreas: passed · G5 responsividade: passed no navegador; **Android real: not_verified** · G2 direção artística: passed
(prancha pronta) · G6 integração/regressão: passed · G7 qualidade artística: partial (autoavaliação; precisa de nova avaliação externa) ·
Performance: partial (só navegador de computador).

## Checklist pro Android real (validação humana)
[ ] instalar o APK de teste local · [ ] lobby deitado: modos à vista, nada cortado · [ ] garagem: moto visível, "Jogar" no rodapé ·
[ ] chat aberto com teclado: campo à vista, digitar não acelera · [ ] cada modal: fechar à vista, rolar até o fim · [ ] Pastel do Agenor com a
ilustração nova · [ ] minimizar no lobby e na corrida: pausa e silêncio · [ ] FPS percebido numa volta longa · [ ] tour dos menus v2 do começo ao fim.

## Pendências
Sprites reais em miniatura na garagem (exigiria desenhar fora do canvas principal: o desenho usa um contexto fixo; ficou de fora para não
criar um segundo renderizador); avaliação artística externa nova; teste no Android real; medir FPS no aparelho.
