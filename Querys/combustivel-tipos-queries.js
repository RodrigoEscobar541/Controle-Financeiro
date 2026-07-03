/**
 * Querys — Coleção: combustivel_tipos (compartilhada entre Focus e Face)
 * Usadas pelo Bot Render (firebase-admin SDK)
 *
 * combustivel_tipos { nome: String }
 */

async function getTiposCombustivel(db) {
  const snap = await db.collection('combustivel_tipos').orderBy('nome', 'asc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function adicionarTipoCombustivel(db, { nome }) {
  return db.collection('combustivel_tipos').add({ nome });
}

async function excluirTipoCombustivel(db, id) {
  return db.collection('combustivel_tipos').doc(id).delete();
}

module.exports = {
  getTiposCombustivel, adicionarTipoCombustivel, excluirTipoCombustivel,
};
