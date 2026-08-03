/**
 * Querys — Dashboard (leituras agregadas)
 * Usadas pelo Bot Render (firebase-admin SDK)
 *
 * Agrega dados de: banco, distribuicao_mensal, contas_casa, patrimonio, dividas,
 * focus (tipo:'abastecimento'), face (tipo:'abastecimento')
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
  const snap = await db.collection('dividas').where('status', '==', 'Aberta').get();
  let totalDevo  = 0;
  let totalDevem = 0;
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.tipo === 'Devo')  totalDevo  += parseFloat(data.valor) || 0;
    if (data.tipo === 'Devem') totalDevem += parseFloat(data.valor) || 0;
  });
  return { totalDevo, totalDevem };
}

async function getConsumoCarro(db, colecao, limite = 100) {
  const snap = await db.collection(colecao).where('tipo', '==', 'abastecimento').get();
  const itensRecentes = snap.docs
    .map(d => d.data())
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
    .slice(0, limite);

  const kmLValores  = [];
  const rsKmValores = [];
  itensRecentes.forEach(item => {
    const correcao  = parseFloat(item.correcao) || 0;
    const kmEfetivo = (parseFloat(item.km) || 0) * (1 - correcao / 100);
    const litros    = parseFloat(item.litros) || 0;
    if (litros > 0 && kmEfetivo > 0)     kmLValores.push(kmEfetivo / litros);
    if (item.valorPago && kmEfetivo > 0) rsKmValores.push((parseFloat(item.valorPago) * litros) / kmEfetivo);
  });

  return {
    mediaKmPorLitro: kmLValores.length  ? kmLValores.reduce((s, v) => s + v, 0) / kmLValores.length   : null,
    mediaRsPorKm:    rsKmValores.length ? rsKmValores.reduce((s, v) => s + v, 0) / rsKmValores.length : null,
    amostras: itensRecentes.length
  };
}

module.exports = {
  getUltimasTransacoes,
  getOrcamentoMensal,
  getContasCasaMes,
  getTotalInvestimentos,
  getTotalDividas,
  getConsumoCarro,
};
