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
 *     { colunas: ["HBO","Netflix",...] }   ← array define a ordem
 */

import { db } from './firebase-config.js';
import { fmtBRL, mesAtualId, idToLabel, showToast, openModal } from './app.js';
import {
  collection, doc, setDoc, updateDoc, deleteField, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let colunas    = [];
let meses      = {};
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

  inputInicio.addEventListener('change', () => { filtroInicio = inputInicio.value; renderTabela(); });
  inputFim.addEventListener('change',    () => { filtroFim    = inputFim.value;    renderTabela(); });

  document.getElementById('btn-add-col-dist').addEventListener('click', adicionarColuna);
  document.getElementById('btn-add-mes-dist').addEventListener('click', adicionarMes);

  subscribeConfig();
}

// ────────────────────────────────────────────
// FILTRO DE PERÍODO
// ────────────────────────────────────────────
function calcDefaultFiltro() {
  const now = new Date();
  const inicio = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  filtroInicio = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}`;
  const fim = new Date(now.getFullYear(), now.getMonth() + 12, 1);
  filtroFim = `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, '0')}`;
}

// ────────────────────────────────────────────
// SUBSCRIPTIONS
// ────────────────────────────────────────────
function subscribeConfig() {
  unsubConf = onSnapshot(doc(db, 'config', 'distribuicao_colunas'), snap => {
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

  const thCols = colunas.map(col => `
    <th draggable="true" data-col="${col}">
      <span class="col-name">${col}</span>
      <span class="delete-col-btn" data-col="${col}" title="Remover coluna" draggable="false">✕</span>
    </th>
  `).join('');
  thead.innerHTML = `<tr><th>Mês</th>${thCols}<th class="col-total">Total</th></tr>`;

  thead.querySelectorAll('.delete-col-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); removerColuna(btn.dataset.col); });
  });

  setupColDrag(thead);

  const sortedIds = Object.keys(meses)
    .filter(id => (!filtroInicio || id >= filtroInicio) && (!filtroFim || id <= filtroFim))
    .sort().reverse();

  if (sortedIds.length === 0) {
    const msg = Object.keys(meses).length === 0
      ? 'Nenhum mês cadastrado. Clique em "+ Mês" para começar.'
      : 'Nenhum mês no período selecionado. Ajuste o filtro ou adicione um mês.';
    tbody.innerHTML = `<tr><td colspan="${colunas.length + 2}" class="empty-state">${msg}</td></tr>`;
    return;
  }

  tbody.innerHTML = sortedIds.map(mesId => {
    const cols = meses[mesId]?.colunas || {};
    let total  = 0;

    const tds = colunas.map(col => {
      const cell  = cols[col] || { valor: 0, status: 'naoPago' };
      const valor = parseFloat(cell.valor) || 0;
      total += valor;
      const pago = cell.status === 'Pago';
      return `<td>
        <div class="cell-data ${pago ? 'pago' : ''}" data-mes="${mesId}" data-col="${col}"
             title="Clique: editar valor | Duplo clique: marcar Pago">
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
    let pressTimer        = null;
    let longPressTriggered = false;

    const startPress = () => {
      longPressTriggered = false;
      pressTimer = setTimeout(() => {
        longPressTriggered = true;
        cell.classList.add('cell-pressing');
        toggleStatus(cell.dataset.mes, cell.dataset.col);
      }, 1000);
    };

    const cancelPress = () => {
      clearTimeout(pressTimer);
      cell.classList.remove('cell-pressing');
    };

    // Mouse
    cell.addEventListener('mousedown', startPress);
    cell.addEventListener('mouseup',   cancelPress);
    cell.addEventListener('mouseleave', cancelPress);

    // Touch (mobile)
    cell.addEventListener('touchstart', startPress, { passive: true });
    cell.addEventListener('touchend',   cancelPress);
    cell.addEventListener('touchmove',  cancelPress, { passive: true });

    // Click só abre o modal se não foi long press
    cell.addEventListener('click', () => {
      if (longPressTriggered) { longPressTriggered = false; return; }
      editarValor(cell.dataset.mes, cell.dataset.col);
    });
  });
}

// ────────────────────────────────────────────
// DRAG & DROP — REORDENAR COLUNAS
// ────────────────────────────────────────────
function setupColDrag(thead) {
  const ths = [...thead.querySelectorAll('th[draggable]')];
  let dragIdx = null;

  ths.forEach((th, idx) => {
    th.addEventListener('dragstart', e => {
      dragIdx = idx;
      th.classList.add('col-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    th.addEventListener('dragend', () => {
      th.classList.remove('col-dragging');
      ths.forEach(t => t.classList.remove('col-drag-over'));
      dragIdx = null;
    });

    th.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      ths.forEach(t => t.classList.remove('col-drag-over'));
      th.classList.add('col-drag-over');
    });

    th.addEventListener('dragleave', () => th.classList.remove('col-drag-over'));

    th.addEventListener('drop', async e => {
      e.preventDefault();
      th.classList.remove('col-drag-over');
      if (dragIdx === null || dragIdx === idx) return;

      const nova = [...colunas];
      const [moved] = nova.splice(dragIdx, 1);
      nova.splice(idx, 0, moved);

      try {
        await setDoc(doc(db, 'config', 'distribuicao_colunas'), { colunas: nova });
      } catch {
        showToast('Erro ao reordenar colunas.', 'error');
      }
    });
  });
}

// ────────────────────────────────────────────
// AÇÕES
// ────────────────────────────────────────────
async function toggleStatus(mesId, colName) {
  const cols  = meses[mesId]?.colunas || {};
  const atual = cols[colName]?.status || 'naoPago';
  const novo  = atual === 'Pago' ? 'naoPago' : 'Pago';
  const valor = cols[colName]?.valor || 0;
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

async function adicionarMes() {
  const ids    = Object.keys(meses).sort();
  const ultimo = ids.length > 0 ? ids[ids.length - 1] : mesAtualId();
  const [y, m] = ultimo.split('-').map(Number);
  const proximo = new Date(y, m, 1);
  const mesId  = `${proximo.getFullYear()}-${String(proximo.getMonth() + 1).padStart(2, '0')}`;

  if (meses[mesId]) { showToast(`${idToLabel(mesId)} já existe.`, ''); return; }

  const colunasPadrao = {};
  colunas.forEach(c => { colunasPadrao[c] = { valor: 0, status: 'naoPago' }; });

  try {
    await setDoc(doc(db, 'distribuicao_mensal', mesId), {
      dataMes: mesIdToLabel(mesId),
      colunas: colunasPadrao
    });
    if (mesId > filtroFim) {
      filtroFim = mesId;
      document.getElementById('dist-filtro-fim').value = filtroFim;
    }
    showToast(`${idToLabel(mesId)} adicionado!`, 'success');
  } catch {
    showToast('Erro ao adicionar mês.', 'error');
  }
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
        await setDoc(doc(db, 'config', 'distribuicao_colunas'), { colunas: colunas.filter(c => c !== nome) });
        for (const mesId of Object.keys(meses)) {
          await updateDoc(doc(db, 'distribuicao_mensal', mesId), { [`colunas.${nome}`]: deleteField() });
        }
        showToast(`Coluna "${nome}" removida.`, 'success');
      } catch {
        showToast('Erro ao remover coluna.', 'error');
      }
    },
    'Remover'
  );
}

function mesIdToLabel(id) {
  const [y, m] = id.split('-');
  return `${m}-${y}`;
}
