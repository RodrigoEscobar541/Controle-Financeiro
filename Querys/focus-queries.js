/**
 * Querys — Coleções: focus_afazer, focus_feitos, focus_manutencao, focus_abastecimento
 * Usadas pelo Bot Render (firebase-admin SDK)
 *
 * focus_afazer    { prioridade: Number, descricao: String, valor: Number }
 * focus_feitos    { data: "YYYY-MM-DD", descricao: String, valor: Number }
 * focus_manutencao { descricao: String, data: "YYYY-MM-DD", kmUltimaTroca: String, kmProximaTroca: String, valor: Number }
 * focus_abastecimento { data: "YYYY-MM-DD", km: Number, correcao: Number, litros: Number, valorPago: Number|null, tipoCombustivel: String }
 */

async function getAfazer(db) {
  const snap = await db.collection('focus_afazer').orderBy('prioridade', 'asc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function adicionarAfazer(db, { prioridade, descricao, valor }) {
  return db.collection('focus_afazer').add({ prioridade, descricao, valor });
}

async function atualizarAfazer(db, id, { prioridade, descricao, valor }) {
  return db.collection('focus_afazer').doc(id).update({ prioridade, descricao, valor });
}

async function excluirAfazer(db, id) {
  return db.collection('focus_afazer').doc(id).delete();
}

async function getFeitos(db, limite = 50) {
  const snap = await db.collection('focus_feitos').orderBy('data', 'desc').limit(limite).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function adicionarFeito(db, { data, descricao, valor }) {
  return db.collection('focus_feitos').add({ data, descricao, valor });
}

async function atualizarFeito(db, id, { data, descricao, valor }) {
  return db.collection('focus_feitos').doc(id).update({ data, descricao, valor });
}

async function excluirFeito(db, id) {
  return db.collection('focus_feitos').doc(id).delete();
}

async function getManutencao(db) {
  const snap = await db.collection('focus_manutencao').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function adicionarManutencao(db, { descricao, data, kmUltimaTroca, kmProximaTroca, valor }) {
  return db.collection('focus_manutencao').add({ descricao, data, kmUltimaTroca, kmProximaTroca, valor });
}

async function atualizarManutencao(db, id, { descricao, data, kmUltimaTroca, kmProximaTroca, valor }) {
  return db.collection('focus_manutencao').doc(id).update({ descricao, data, kmUltimaTroca, kmProximaTroca, valor });
}

async function excluirManutencao(db, id) {
  return db.collection('focus_manutencao').doc(id).delete();
}

async function getAbastecimento(db, limite = 50) {
  const snap = await db.collection('focus_abastecimento').orderBy('data', 'desc').limit(limite).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function adicionarAbastecimento(db, { data, km, correcao, litros, valorPago, tipoCombustivel }) {
  return db.collection('focus_abastecimento').add({ data, km, correcao, litros, valorPago, tipoCombustivel });
}

async function atualizarAbastecimento(db, id, { data, km, correcao, litros, valorPago, tipoCombustivel }) {
  return db.collection('focus_abastecimento').doc(id).update({ data, km, correcao, litros, valorPago, tipoCombustivel });
}

async function excluirAbastecimento(db, id) {
  return db.collection('focus_abastecimento').doc(id).delete();
}

module.exports = {
  getAfazer, adicionarAfazer, atualizarAfazer, excluirAfazer,
  getFeitos, adicionarFeito, atualizarFeito, excluirFeito,
  getManutencao, adicionarManutencao, atualizarManutencao, excluirManutencao,
  getAbastecimento, adicionarAbastecimento, atualizarAbastecimento, excluirAbastecimento,
};
