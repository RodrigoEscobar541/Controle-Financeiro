/**
 * Distribuição Mensal do Salário
 *
 * Estrutura Firestore:
 *   Coleção: distribuicao_mensal
 *   Documento por mês (ID = "YYYY-MM"):
 *     { dataMes: "MM-YYYY", colunas: { [nome]: { valor: Number, status: "Pago"|"naoPago" } } }
 *
 *   Coleção: config
 *   Documento "distribuicao_colunas":
 *     { colunas: ["HBO","Netflix",...] }
 */

import { db } from './firebase-config.js';
import { fmtBRL, mesAtualId, idToLabel, showToast, openModal } from './app.js';
import {
  collection, doc, setDoc, updateDoc, deleteField, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let colunas  = [];
let meses    = {};  // { "2026-06": { dataMes, colunas: { nome: {valor, status} } } }
let unsubMeses = null;
let unsubConf  = null;

let filtroInicio = '';
let filtroFim    = '';

export function initDistribuicao() {
  calcDefaultFiltro();

  const inputInicio = document.getElementById('dist-filtro-inicio');
  const inputFim    = document.getElementById('dist-filtro-fim');

  inputInicio.value = filtroInicio;
  inputFim.value    = filtroFim;

  inputInicio.addEventListener('change', () => {
    filtroInicio = inputInicio.value;
    renderTabela();
  });
  inputFim.addEventListener('change', () => {
    filtroFim = inputFim.value;
    renderTabela();
  });

  document.getElementById('btn-add-col-dist').addEventListener('click', adicionarColuna);
  document.getElementById('btn-add-mes-dist').addEventListener('click', adicionarMes);

  subscribeConfig();
}

// ────────────────────────────────────────────
// FILTRO DE PERÍODO
// ────────────────────────────────────────────
function calcDefaultFiltro() {
  const now = new Date();

  // 5 meses atrás
  const inicio = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  filtroInicio = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}`;

  // 12 meses à frente
  const fim = new Date(now.getFullYear(), now.getMonth() + 12, 1);
  filtroFim = `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, '0')}`;
}

// ────────────────────────────────────────────
// SUBSCRIPTIONS
// ────────────────────────────────────────────
function subscribeConfig() {
  const configRef = doc(db, 'config', 'distribuicao_colunas');
  unsubConf = onSnapshot(configRef, snap => {
    colunas = snap.exists() ? (snap.data().colunas || []) : [];
    subscribeMeses();
  });
}

function subscribeMeses() {
  if (unsubMeses) unsubMeses();
  unsubMeses = onSnapshot(collection(db, 'distribuicao_mensal'), snap => {
    meses = {};
    snap.docs.forEach(d => { meses[d.id] = d.data(); });
    renderTabela();
  });
}

// ────────────────────────────────────────────
// RENDER
// ────────────────────────────────────────────
function renderTabela() {
  const thead = document.getElementById('dist-thead');
  const tbody = document.getElementById('dist-tbody');

  // Header
  const thCols = colunas.map(col => `
    <th>
      ${col}
      <span class="delete-col-btn" data-col="${col}" title="Remover coluna">✕</span>
    </th>
  `).join('');
  thead.innerHTML = `<tr><th>Mês</th>${thCols}<th class="col-total">Total</th></tr>`;

  thead.querySelectorAll('.delete-col-btn').forEach(btn => {
    btn.addEventListener('click', () => removerColuna(btn.dataset.col));
  });

  // Filtra e ordena os meses pelo período selecionado
  const sortedIds = Object.keys(meses)
    .filter(id => (!filtroInicio || id >= filtroInicio) && (!filtroFim || id <= filtroFim))
    .sort()
    .reverse();

  if (sortedIds.length === 0) {
    const todosIds = Object.keys(meses);
    const msg = todosIds.length === 0
      ? 'Nenhum mês cadastrado. Clique em "+ Mês" para começar.'
      : 'Nenhum mês no período selecionado. Ajuste o filtro ou adicione um mês.';
    tbody.innerHTML = `<tr><td colspan="${colunas.length + 2}" class="empty-state">${msg}</td></tr>`;
    return;
  }

  tbody.innerHTML = sortedIds.map(mesId => {
    const mes   = meses[mesId] || {};
    const cols  = mes.colunas || {};
    let total   = 0;

    const tds = colunas.map(col => {
      const cell  = cols[col] || { valor: 0, status: 'naoPago' };
      const valor = parseFloat(cell.valor) || 0;
      total += valor;
      const pago  = cell.status === 'Pago';
      return `
        <td>
          <div class="cell-data ${pago ? 'pago' : ''}"
               data-mes="${mesId}"
               data-col="${col}"
               title="${pago ? 'Clique para desmarcar' : 'Clique para marcar como Pago'}">
            ${fmtBRL(valor)}
          </div>
        </td>`;
    }).join('');

    return `<tr>
      <td><strong>${idToLabel(mesId)}</strong></td>
      ${tds}
      <td class="col-total">${fmtBRL(total)}</td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.cell-data').forEach(cell => {
    cell.addEventListener('click', () => toggleStatus(cell.dataset.mes, cell.dataset.col));
    cell.addEventListener('dblclick', e => { e.stopPropagation(); editarValor(cell.dataset.mes, cell.dataset.col); });
  });
}

// ────────────────────────────────────────────
// AÇÕES
// ────────────────────────────────────────────
async function toggleStatus(mesId, colName) {
  const cols   = meses[mesId]?.colunas || {};
  const atual  = cols[colName]?.status || 'naoPago';
  const novo   = atual === 'Pago' ? 'naoPago' : 'Pago';
  const valor  = cols[colName]?.valor || 0;

  try {
    await setDoc(doc(db, 'distribuicao_mensal', mesId), {
      dataMes: mesIdToLabel(mesId),
      colunas: { ...cols, [colName]: { valor, status: novo } }
    }, { merge: true });
  } catch {
    showToast('Erro ao atualizar status.', 'error');
  }
}

function editarValor(mesId, colName) {
  const cols  = meses[mesId]?.colunas || {};
  const atual = cols[colName]?.valor || 0;

  openModal(
    `Editar valor — ${colName} (${idToLabel(mesId)})`,
    `<div class="form-group">
       <label>Valor (R$)</label>
       <input type="number" id="edit-valor-input" value="${atual}" step="0.01" min="0" class="form-control">
     </div>`,
    async () => {
      const novo = parseFloat(document.getElementById('edit-valor-input').value);
      if (isNaN(novo) || novo < 0) { showToast('Valor inválido.', 'error'); return; }
      const status = cols[colName]?.status || 'naoPago';
      try {
        await setDoc(doc(db, 'distribuicao_mensal', mesId), {
          dataMes: mesIdToLabel(mesId),
          colunas: { ...cols, [colName]: { valor: novo, status } }
        }, { merge: true });
        showToast('Valor atualizado!', 'success');
      } catch {
        showToast('Erro ao atualizar.', 'error');
      }
    },
    'Salvar'
  );
}

function adicionarMes() {
  openModal(
    'Adicionar Mês',
    `<div class="form-group">
       <label>Mês</label>
       <input type="month" id="add-mes-input" value="${mesAtualId()}" class="form-control">
     </div>`,
    async () => {
      const mesId = document.getElementById('add-mes-input').value;
      if (!mesId) { showToast('Selecione um mês.', 'error'); return; }
      if (meses[mesId]) { showToast('Este mês já existe na tabela.', ''); return; }

      const colunasPadrao = {};
      colunas.forEach(c => { colunasPadrao[c] = { valor: 0, status: 'naoPago' }; });

      try {
        await setDoc(doc(db, 'distribuicao_mensal', mesId), {
          dataMes: mesIdToLabel(mesId),
          colunas: colunasPadrao
        });

        // Expande o filtro automaticamente se o mês estiver fora do período
        let changed = false;
        if (mesId < filtroInicio) { filtroInicio = mesId; changed = true; }
        if (mesId > filtroFim)    { filtroFim    = mesId; changed = true; }
        if (changed) {
          document.getElementById('dist-filtro-inicio').value = filtroInicio;
          document.getElementById('dist-filtro-fim').value    = filtroFim;
        }

        showToast(`${idToLabel(mesId)} adicionado!`, 'success');
      } catch {
        showToast('Erro ao adicionar mês.', 'error');
      }
    },
    'Adicionar'
  );
}

function adicionarColuna() {
  openModal(
    'Nova Coluna',
    `<div class="form-group">
       <label>Nome da coluna</label>
       <input type="text" id="nova-col-input" placeholder="Ex: Netflix, Spotify..." maxlength="40">
     </div>`,
    async () => {
      const nome = document.getElementById('nova-col-input').value.trim();
      if (!nome) { showToast('Nome inválido.', 'error'); return; }
      if (colunas.includes(nome)) { showToast('Esta coluna já existe.', 'error'); return; }

      const novasColunas = [...colunas, nome];
      try {
        await setDoc(doc(db, 'config', 'distribuicao_colunas'), { colunas: novasColunas });
        for (const mesId of Object.keys(meses)) {
          const cols = meses[mesId]?.colunas || {};
          if (!cols[nome]) {
            await setDoc(doc(db, 'distribuicao_mensal', mesId), {
              colunas: { ...cols, [nome]: { valor: 0, status: 'naoPago' } }
            }, { merge: true });
          }
        }
        showToast(`Coluna "${nome}" adicionada!`, 'success');
      } catch {
        showToast('Erro ao adicionar coluna.', 'error');
      }
    },
    'Adicionar'
  );
}

function removerColuna(nome) {
  openModal(
    `Remover coluna "${nome}"`,
    `<p>Isso removerá a coluna <strong>${nome}</strong> de todos os meses. Os valores serão perdidos.</p>`,
    async () => {
      try {
        const novasColunas = colunas.filter(c => c !== nome);
        await setDoc(doc(db, 'config', 'distribuicao_colunas'), { colunas: novasColunas });

        for (const mesId of Object.keys(meses)) {
          const mesRef = doc(db, 'distribuicao_mensal', mesId);
          await updateDoc(mesRef, { [`colunas.${nome}`]: deleteField() });
        }
        showToast(`Coluna "${nome}" removida.`, 'success');
      } catch {
        showToast('Erro ao remover coluna.', 'error');
      }
    },
    'Remover'
  );
}

// Formata "2026-06" → "06-2026"
function mesIdToLabel(id) {
  const [y, m] = id.split('-');
  return `${m}-${y}`;
}
