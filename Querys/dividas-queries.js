/**
 * Querys — Coleção: dividas
 * Usadas pelo Bot Render (firebase-admin SDK)
 *
 * Campos do documento:
 *   tipo: "Devo"|"Devem", data: "YYYY-MM", descricao: String, valor: Number, status: "Aberta"|"Fechada"
 *
 * Ao registrar com N parcelas, gera N documentos (um por mês).
 * Meses passados ficam "Fechada"; mês atual em diante ficam "Aberta".
 */

async function getDividas(db) {
  const snap = await db.collection('dividas').orderBy('data', 'asc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getDividasAbertas(db) {
  const snap = await db.collection('dividas').where('status', '==', 'Aberta').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function adicionarDivida(db, { tipo, data, descricao, valor, status }) {
  return db.collection('dividas').add({ tipo, data, descricao, valor, status });
}

async function gerarParcelas(db, { tipo, descricao, parcelas, valorTotal, dataStr }) {
  const valorParcela = Math.round((valorTotal / parcelas) * 100) / 100;

  const now         = new Date();
  const mesAtualNum = now.getFullYear() * 100 + (now.getMonth() + 1);

  const mesInicio = parseInt(dataStr.slice(0, 2));
  const anoInicio = parseInt(dataStr.slice(3));

  const promises = [];
  for (let i = 0; i < parcelas; i++) {
    const totalMes  = mesInicio + i;
    const anoOffset = Math.floor((totalMes - 1) / 12);
    const mesReal   = ((totalMes - 1) % 12) + 1;
    const anoReal   = anoInicio + anoOffset;

    const data   = `${anoReal}-${String(mesReal).padStart(2, '0')}`;
    const docNum = anoReal * 100 + mesReal;
    const status = docNum < mesAtualNum ? 'Fechada' : 'Aberta';

    promises.push(db.collection('dividas').add({ tipo, data, descricao, valor: valorParcela, status }));
  }
  return Promise.all(promises);
}

async function atualizarDivida(db, id, { descricao, valor, data }) {
  return db.collection('dividas').doc(id).update({ descricao, valor, data });
}

async function atualizarStatus(db, id, status) {
  return db.collection('dividas').doc(id).update({ status });
}

async function excluirDivida(db, id) {
  return db.collection('dividas').doc(id).delete();
}

async function getTotalAberto(db) {
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

module.exports = {
  getDividas, getDividasAbertas,
  adicionarDivida, gerarParcelas,
  atualizarDivida, atualizarStatus,
  excluirDivida, getTotalAberto,
};
