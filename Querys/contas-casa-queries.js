/**
 * Querys — Coleção: contas_casa
 * Usadas pelo Bot Railway (firebase-admin SDK)
 *
 * Documento por mês (ID = "YYYY-MM"):
 *   { dataMes: "MM-YYYY", colunas: { [nome]: { valor, status, pagante } } }
 */

/**
 * Retorna o total de contas da casa do mês atual.
 */
async function getTotalContasCasaMes(db, mesId) {
  const snap = await db.collection('contas_casa').doc(mesId).get();
  if (!snap.exists) return { total: 0, bella: 0, digo: 0 };

  const cols = snap.data().colunas || {};
  let total = 0, bella = 0, digo = 0;

  Object.values(cols).forEach(c => {
    const v = parseFloat(c.valor) || 0;
    total += v;
    if (c.pagante === 'Bella') bella += v;
    else                        digo  += v;
  });

  return { total, bella, digo, metade: total / 2 };
}

module.exports = { getTotalContasCasaMes };
