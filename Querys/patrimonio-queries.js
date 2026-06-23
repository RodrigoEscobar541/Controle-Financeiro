/**
 * Querys — Coleção: patrimonio
 * Usadas pelo Bot Railway (firebase-admin SDK)
 *
 * Campos do documento:
 *   nomeDoAtivo: String, plataforma: String, valor: Number
 */

/**
 * Retorna todos os ativos e o total.
 */
async function getPatrimonio(db) {
  const snap = await db.collection('patrimonio').get();
  const ativos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const total  = ativos.reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);
  return { ativos, total };
}

/**
 * Adiciona um novo ativo.
 */
async function adicionarAtivo(db, { nomeDoAtivo, plataforma, valor }) {
  return db.collection('patrimonio').add({ nomeDoAtivo, plataforma, valor });
}

/**
 * Atualiza o valor de um ativo pelo ID.
 */
async function atualizarValorAtivo(db, id, novoValor) {
  return db.collection('patrimonio').doc(id).update({ valor: novoValor });
}

/**
 * Remove um ativo pelo ID.
 */
async function removerAtivo(db, id) {
  return db.collection('patrimonio').doc(id).delete();
}

module.exports = { getPatrimonio, adicionarAtivo, atualizarValorAtivo, removerAtivo };
