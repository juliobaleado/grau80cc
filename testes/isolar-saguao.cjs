// Isolamento dos testes que usam o Supabase Realtime de verdade: o jogo entra sozinho no saguão público
// ("realtime:grau80-saguao") ao abrir. Nos testes, este gancho troca esse canal por um saguão exclusivo da execução
// ("realtime:grau80-saguao-teste-<id>"), dentro do navegador do teste. Assim nenhum jogador real vê os clientes de
// teste na lista "Online" e os testes não veem jogadores reais. O jogo e o sistema de rede não são alterados:
// só o WebSocket da página de teste é embrulhado. As salas já são isoladas (código aleatório por execução).
// Uso: const isolar = require('./isolar-saguao.cjs'); await isolar(page, idDaExecucao);
//      e, no fim, isolar.conferir(page) devolve quantas mensagens tentaram ir pro saguão público (tem que ser 0).
const PUB = 'realtime:grau80-saguao';
async function isolar(page, id) {
  await page.evaluateOnNewDocument((PUB, PRIV) => {
    const Nat = window.WebSocket;
    window.__saguao = { trocadas: 0, vazou: 0 };
    class WS extends Nat {
      send(d) {
        if (typeof d === 'string' && d.includes('"' + PUB + '"')) {
          try { const m = JSON.parse(d); if (m.topic === PUB) { m.topic = PRIV; window.__saguao.trocadas++; d = JSON.stringify(m); } } catch (e) {}
          if (d.includes('"' + PUB + '"')) { window.__saguao.vazou++; return; } // nunca manda nada pro saguão público
        }
        return super.send(d);
      }
      set onmessage(fn) {
        super.onmessage = ev => {
          if (typeof ev.data === 'string' && ev.data.includes('"' + PRIV + '"')) {
            try { const m = JSON.parse(ev.data); if (m.topic === PRIV) m.topic = PUB; ev = new MessageEvent('message', { data: JSON.stringify(m) }); } catch (e) {}
          }
          return fn && fn.call(this, ev);
        };
      }
      get onmessage() { return super.onmessage; }
    }
    window.WebSocket = WS;
  }, PUB, PUB + '-teste-' + id);
}
isolar.conferir = page => page.evaluate(() => window.__saguao || { trocadas: 0, vazou: -1 });
module.exports = isolar;
