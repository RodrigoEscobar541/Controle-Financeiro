/**
 * Querys — Coleção: face
 * Usadas pelo Bot Render (firebase-admin SDK)
 *
 * Um documento por registro, diferenciado pelo campo `tipo`:
 *   tipo:'afazer'        { prioridade: Number, descricao: String, valor: Number }
 *   tipo:'feito'         { data: "YYYY-MM-DD", descricao: String, valor: Number }
 *   tipo:'manutencao'    { descricao: String, data: "YYYY-MM-DD", kmUltimaTroca: String, kmProximaTroca: String, valor: Number }
 *   tipo:'abastecimento' { data: "YYYY-MM-DD", km: Number, correcao: Number, litros: Number, valorPago: Number|null (preço por litro, não o total), tipoCombustivel: String }
 */

async function getAfazer(db) {
  const snap = await db.collection('face').where('tipo', '==', 'afazer').get();
  const itens = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return itens.sort((a, b) => (parseFloat(a.prioridade) || 0) - (parseFloat(b.prioridade) || 0));
}

async function adicionarAfazer(db, { prioridade, descricao, valor }) {
  return db.collection('face').add({ tipo: 'afazer', prioridade, descricao, valor });
}

async function atualizarAfazer(db, id, { descricao, valor }) {
  return db.collection('face').doc(id).update({ descricao, valor });
}

async function excluirAfazer(db, id) {
  return db.collection('face').doc(id).delete();
}

async function getFeitos(db, limite = 50) {
  const snap = await db.collection('face').where('tipo', '==', 'feito').get();
  const itens = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return itens
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
    .slice(0, limite);
}

async function adicionarFeito(db, { data, descricao, valor }) {
  return db.collection('face').add({ tipo: 'feito', data, descricao, valor });
}

async function atualizarFeito(db, id, { data, descricao, valor }) {
  return db.collection('face').doc(id).update({ data, descricao, valor });
}

async function excluirFeito(db, id) {
  return db.collection('face').doc(id).delete();
}

async function getManutencao(db) {
  const snap = await db.collection('face').where('tipo', '==', 'manutencao').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function adicionarManutencao(db, { descricao, data, kmUltimaTroca, kmProximaTroca, valor }) {
  return db.collection('face').add({ tipo: 'manutencao', descricao, data, kmUltimaTroca, kmProximaTroca, valor });
}

async function atualizarManutencao(db, id, { descricao, data, kmUltimaTroca, kmProximaTroca, valor }) {
  return db.collection('face').doc(id).update({ descricao, data, kmUltimaTroca, kmProximaTroca, valor });
}

async function excluirManutencao(db, id) {
  return db.collection('face').doc(id).delete();
}

async function getAbastecimento(db, limite = 50) {
  const snap = await db.collection('face').where('tipo', '==', 'abastecimento').get();
  const itens = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return itens
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
    .slice(0, limite);
}

async function adicionarAbastecimento(db, { data, km, correcao, litros, valorPago, tipoCombustivel }) {
  return db.collection('face').add({ tipo: 'abastecimento', data, km, correcao, litros, valorPago, tipoCombustivel });
}

async function atualizarAbastecimento(db, id, { data, km, correcao, litros, valorPago, tipoCombustivel }) {
  return db.collection('face').doc(id).update({ data, km, correcao, litros, valorPago, tipoCombustivel });
}

async function excluirAbastecimento(db, id) {
  return db.collection('face').doc(id).delete();
}

module.exports = {
  getAfazer, adicionarAfazer, atualizarAfazer, excluirAfazer,
  getFeitos, adicionarFeito, atualizarFeito, excluirFeito,
  getManutencao, adicionarManutencao, atualizarManutencao, excluirManutencao,
  getAbastecimento, adicionarAbastecimento, atualizarAbastecimento, excluirAbastecimento,
};
