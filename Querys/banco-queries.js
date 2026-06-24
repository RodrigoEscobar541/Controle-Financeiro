/**
 * Querys — Coleção: banco
 * Usadas pelo Bot Railway (firebase-admin SDK)
 *
 * Campos do documento:
 *   data: "YYYY-MM-DD", tipo: "Entrada"|"Saida", valor: Number, descricao: String
 *
 * Agregado em banco_meta/saldo: { entradas, saidas, saldo }
 * Mantido em sincronia via batch a cada registrar/excluir para evitar full-scan.
 */

const { FieldValue } = require('firebase-admin/firestore');

const metaRef = (db) => db.collection('banco_meta').doc('saldo');

/**
 * Registra uma entrada ou saída no banco e atualiza o agregado.
 */
async function registrarTransacao(db, { tipo, valor, descricao }) {
  const hoje = new Date();
  const data = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;

  const delta    = parseFloat(valor) || 0;
  const batch    = db.batch();
  const transRef = db.collection('banco').doc();

  batch.set(transRef, { data, tipo, valor, descricao });

  if (tipo === 'Entrada') {
    batch.set(metaRef(db), { entradas: FieldValue.increment(delta), saldo: FieldValue.increment(delta)  }, { merge: true });
  } else {
    batch.set(metaRef(db), { saidas:   FieldValue.increment(delta), saldo: FieldValue.increment(-delta) }, { merge: true });
  }

  await batch.commit();
  return transRef;
}

/**
 * Retorna o saldo lendo o agregado banco_meta/saldo (1 leitura).
 * Na primeira execução (doc não existe) faz o full-scan uma única vez para popular o agregado.
 */
async function getSaldo(db) {
  const meta = await metaRef(db).get();
  if (meta.exists) {
    const { entradas = 0, saidas = 0, saldo = 0 } = meta.data();
    return { entradas, saidas, saldo };
  }

  // Migração única: varre a coleção e persiste o agregado
  const snap = await db.collection('banco').get();
  let entradas = 0, saidas = 0;
  snap.docs.forEach(d => {
    const { tipo, valor } = d.data();
    if (tipo === 'Entrada') entradas += parseFloat(valor) || 0;
    if (tipo === 'Saida')   saidas   += parseFloat(valor) || 0;
  });
  const saldo = entradas - saidas;
  await metaRef(db).set({ entradas, saidas, saldo });
  return { entradas, saidas, saldo };
}

/**
 * Retorna as últimas N transações do tipo informado.
 */
async function getUltimas(db, tipo, limite = 5) {
  const snap = await db.collection('banco')
    .orderBy('data', 'desc')
    .limit(limite * 3)
    .get();

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => r.tipo === tipo)
    .slice(0, limite);
}

/**
 * Exclui uma transação e decrementa o agregado via batch.
 */
async function excluirTransacao(db, id) {
  const transRef = db.collection('banco').doc(id);
  const snap     = await transRef.get();
  if (!snap.exists) return;

  const { tipo, valor } = snap.data();
  const delta = parseFloat(valor) || 0;
  const batch = db.batch();

  batch.delete(transRef);

  if (tipo === 'Entrada') {
    batch.set(metaRef(db), { entradas: FieldValue.increment(-delta), saldo: FieldValue.increment(-delta) }, { merge: true });
  } else {
    batch.set(metaRef(db), { saidas:   FieldValue.increment(-delta), saldo: FieldValue.increment(delta)  }, { merge: true });
  }

  await batch.commit();
}

module.exports = { registrarTransacao, getSaldo, getUltimas, excluirTransacao };
