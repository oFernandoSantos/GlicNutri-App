/**
 * Evita segundo fetch no primeiro focus após mount (padrão comum em telas RN).
 */
export function criarGuardiaoCarregamentoInicial() {
  let carregouNaSessao = false;

  return {
    marcarCarregado() {
      carregouNaSessao = true;
    },
    deveIgnorarCarregamentoFocus() {
      if (!carregouNaSessao) {
        carregouNaSessao = true;
        return true;
      }
      return false;
    },
    reiniciar() {
      carregouNaSessao = false;
    },
  };
}

/** Executa tarefas em lotes para não saturar a rede no mobile. */
export async function executarEmLotes(itens, tamanhoLote, executor) {
  const resultados = [];
  for (let indice = 0; indice < itens.length; indice += tamanhoLote) {
    const lote = itens.slice(indice, indice + tamanhoLote);
    const parcial = await Promise.all(lote.map(executor));
    resultados.push(...parcial);
  }
  return resultados;
}
