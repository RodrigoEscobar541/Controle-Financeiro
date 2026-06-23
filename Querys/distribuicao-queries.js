/**
 * Querys — Coleção: distribuicao_mensal
 * Usadas pelo Bot Railway (firebase-admin SDK)
 *
 * Documento por mês (ID = "YYYY-MM"):
 *   { dataMes: "MM-YYYY", colunas: { [nome]: { valor, status } } }
 */

/**
 * Retorna o total do mês informado (soma de todos os valores das colunas).
 */
async function getTotalMes(db, mesId) {
  const snap = await db.collection('distribuicao_mensal').doc(mesId).get();
  if (!snap.exists) return 0;

  const cols = snap.data().colunas || {};
  return Object.values(cols).reduce((s, c) => s + (parseFloat(c.valor) || 0), 0);
}

/**
 * Retorna o resumo do mês atual.
 */
async function getResumoMesAtual(db) {
  const now = new Date();
  const mesId = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const snap  = await db.collection('distribuicao_mensal').doc(mesId).get();

  if (!snap.exists) return { mesId, colunas: {}, total: 0 };

  const data  = snap.data();
  const cols  = data.colunas || {};
  const total = Object.values(cols).reduce((s, c) => s + (parseFloat(c.valor) || 0), 0);
  return { mesId, colunas: cols, total };
}

module.exports = { getTotalMes, getResumoMesAtual };
