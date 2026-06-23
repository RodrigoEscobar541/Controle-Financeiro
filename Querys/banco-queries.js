/**
 * Querys — Coleção: banco
 * Usadas pelo Bot Railway (firebase-admin SDK)
 *
 * Campos do documento:
 *   data: "YYYY-MM-DD", tipo: "Entrada"|"Saida", valor: Number, descricao: String
 */

const { Timestamp } = require('firebase-admin/firestore');

/**
 * Registra uma entrada ou saída no banco.
 */
async function registrarTransacao(db, { tipo, valor, descricao }) {
  const hoje = new Date();
  const data = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;

  return db.collection('banco').add({ data, tipo, valor, descricao });
}

/**
 * Retorna o saldo atual: soma(Entradas) - soma(Saídas).
 */
async function getSaldo(db) {
  const snap = await db.collection('banco').get();
  let entradas = 0, saidas = 0;

  snap.docs.forEach(d => {
    const { tipo, valor } = d.data();
    if (tipo === 'Entrada') entradas += parseFloat(valor) || 0;
    if (tipo === 'Saida')   saidas   += parseFloat(valor) || 0;
  });

  return { entradas, saidas, saldo: entradas - saidas };
}

/**
 * Retorna as últimas N transações do tipo informado.
 */
async function getUltimas(db, tipo, limite = 5) {
  const snap = await db.collection('banco')
    .orderBy('data', 'desc')
    .limit(limite * 3) // busca mais para filtrar por tipo
    .get();

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => r.tipo === tipo)
    .slice(0, limite);
}

/**
 * Exclui um documento pelo ID.
 */
async function excluirTransacao(db, id) {
  return db.collection('banco').doc(id).delete();
}

module.exports = { registrarTransacao, getSaldo, getUltimas, excluirTransacao };
