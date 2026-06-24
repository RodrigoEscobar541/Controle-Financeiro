/**
 * Querys — Dashboard (leituras agregadas)
 * Usadas pelo Bot Render (firebase-admin SDK)
 *
 * Agrega dados de: banco, distribuicao_mensal, contas_casa, patrimonio, dividas
 */

async function getUltimasTransacoes(db, tipo, limite = 5) {
  const snap = await db.collection('banco')
    .orderBy('data', 'desc')
    .limit(limite * 3)
    .get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => r.tipo === tipo)
    .slice(0, limite);
}

async function getOrcamentoMensal(db, mesId) {
  const snap = await db.collection('distribuicao_mensal').doc(mesId).get();
  if (!snap.exists) return null;
  const total = Object.values(snap.data().colunas || {})
    .reduce((sum, c) => sum + (parseFloat(c.valor) || 0), 0);
  return { mesId, total };
}

async function getContasCasaMes(db, mesId) {
  const snap = await db.collection('contas_casa').doc(mesId).get();
  if (!snap.exists) return 0;
  return Object.values(snap.data().colunas || {})
    .reduce((sum, c) => sum + (parseFloat(c.valor) || 0), 0);
}

async function getTotalInvestimentos(db) {
  const snap = await db.collection('patrimonio').get();
  return snap.docs.reduce((sum, d) => sum + (parseFloat(d.data().valor) || 0), 0);
}

async function getTotalDividas(db) {
  const snap = await db.collection('dividas').get();
  let totalDevo  = 0;
  let totalDevem = 0;
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.status !== 'Aberta') return;
    if (data.tipo === 'Devo')  totalDevo  += parseFloat(data.valor) || 0;
    if (data.tipo === 'Devem') totalDevem += parseFloat(data.valor) || 0;
  });
  return { totalDevo, totalDevem };
}

module.exports = {
  getUltimasTransacoes,
  getOrcamentoMensal,
  getContasCasaMes,
  getTotalInvestimentos,
  getTotalDividas,
};
