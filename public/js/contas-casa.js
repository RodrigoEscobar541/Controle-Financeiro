/**
 * Contas da Casa
 *
 * Estrutura Firestore:
 *   Coleção: contas_casa
 *   Documento por mês (ID = "YYYY-MM"):
 *     { dataMes: "MM-YYYY", colunas: { [nome]: { valor, status, pagante: "Bella"|"Digo" } } }
 *
 *   Coleção: config
 *   Documento "contas_casa_colunas":
 *     { colunas: { "Mercado": { defaultPagante: "Digo" }, ... }, ordem: ["Mercado","Luz",...] }
 */

import { db } from './firebase-config.js';
import { fmtBRL, mesAtualId, idToLabel, showToast, openModal } from './app.js';
import {
  collection, doc, setDoc, onSnapshot, deleteField, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let colunasConfig = {};
let colunasOrdem  = [];
let meses         = {};
let unsubMeses    = null;
let unsubConf     = null;
let filtroInicio  = '';
let filtroFim     = '';

export function initContasCasa() {
  calcDefaultFiltro();

  const inputInicio = document.getElementById('casa-filtro-inicio');
  const inputFim    = document.getElementById('casa-filtro-fim');
  if (inputInicio) { inputInicio.value = filtroInicio; inputInicio.addEventListener('change', () => { filtroInicio = inputInicio.value; renderTabela(); }); }
  if (inputFim)    { inputFim.value    = filtroFim;    inputFim.addEventListener('change',    () => { filtroFim    = inputFim.value;    renderTabela(); }); }

  document.getElementById('btn-add-mes-casa')?.addEventListener('click', adicionarMes);
  document.getElementById('btn-add-col-casa')?.addEventListener('click', adicionarColuna);

  subscribeConfig();
}

// ────────────────────────────────────────────
// FILTRO DE PERÍODO
// ────────────────────────────────────────────
function calcDefaultFiltro() {
  const now    = new Date();
  const inicio = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  filtroInicio = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}`;
  const fim    = new Date(now.getFullYear(), now.getMonth() + 10, 1);
  filtroFim    = `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, '0')}`;
}

// ────────────────────────────────────────────
// SUBSCRIPTIONS
// ────────────────────────────────────────────
function subscribeConfig() {
  unsubConf = onSnapshot(doc(db, 'config', 'contas_casa_colunas'), snap => {
    const data    = snap.exists() ? snap.data() : {};
    colunasConfig = data.colunas || {};

    const allKeys    = Object.keys(colunasConfig);
    const savedOrdem = Array.isArray(data.ordem) ? data.ordem : [];
    colunasOrdem = [
      ...savedOrdem.filter(k => allKeys.includes(k)),
      ...allKeys.filter(k => !savedOrdem.includes(k))
    ];

    subscribeMeses();
  });
}

function subscribeMeses() {
  if (unsubMeses) unsubMeses();
  unsubMeses = onSnapshot(collection(db, 'contas_casa'), snap => {
    meses = {};
    snap.docs.forEach(d => { meses[d.id] = d.data(); });
    renderTabela();
  });
}

// ────────────────────────────────────────────
// RENDER
// ────────────────────────────────────────────
function renderTabela() {
  const thead = document.getElementById('casa-thead');
  const tbody = document.getElementById('casa-tbody');

  const thCols = colunasOrdem.map(nome => {
    const pag = colunasConfig[nome]?.defaultPagante || '';
    const tag = pag ? `<span class="pagante-tag pagante-${pag.toLowerCase()}">${pag}</span>` : '';
    return `<th draggable="true" data-col="${nome}">
      <span class="col-name">${nome}${tag}</span>
      <span class="delete-col-btn" data-col="${nome}" title="Remover" draggable="false">✕</span>
    </th>`;
  }).join('');

  thead.innerHTML = `<tr>
    <th>Data</th>${thCols}
    <th class="col-total">Bella</th>
    <th class="col-total">Digo</th>
    <th class="col-total">Total</th>
    <th class="col-total">Equilíbrio de contas</th>
  </tr>`;

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
    tbody.innerHTML = `<tr><td colspan="${colunasOrdem.length + 5}" class="empty-state">${msg}</td></tr>`;
    document.getElementById('mes-atual-metade').textContent = 'R$ —';
    return;
  }

  tbody.innerHTML = sortedIds.map(mesId => {
    const cols = meses[mesId]?.colunas || {};
    let totalBella = 0, totalDigo = 0, total = 0;

    const tds = colunasOrdem.map(nome => {
      const cell    = cols[nome] || { valor: 0, status: 'naoPago', pagante: colunasConfig[nome]?.defaultPagante || 'Digo' };
      const valor   = parseFloat(cell.valor) || 0;
      const pago    = cell.status === 'Pago';
      const pagante = cell.pagante || colunasConfig[nome]?.defaultPagante || 'Digo';

      total += valor;
      if (pagante === 'Bella') totalBella += valor;
      else                     totalDigo  += valor;

      const tag = `<span class="pagante-tag pagante-${pagante.toLowerCase()}">${pagante}</span>`;

      return `<td>
        <div class="cell-data ${pago ? 'pago' : ''}"
             data-mes="${mesId}" data-col="${nome}"
             title="Clique: editar valor | Segure 1s: marcar Pago">
          ${valor !== 0 ? fmtBRL(valor) : ''}<br><small>${tag}</small>
        </div>
      </td>`;
    }).join('');

    const equilibrio        = Math.abs(total / 2 - totalBella);
    const equilibrioPago    = meses[mesId]?.equilibrioPago === true;
    const equilibrioPagante = meses[mesId]?.equilibrioPagante || '';
    const eqTag = equilibrioPagante
      ? `<span class="pagante-tag pagante-${equilibrioPagante.toLowerCase()}">${equilibrioPagante}</span>`
      : '';

    return `<tr>
      <td><strong>${idToLabel(mesId)}</strong></td>
      ${tds}
      <td class="col-total" style="color:#AD1457">${fmtBRL(totalBella)}</td>
      <td class="col-total" style="color:#1565C0">${fmtBRL(totalDigo)}</td>
      <td class="col-total">${fmtBRL(total)}</td>
      <td>
        <div class="cell-equilibrio ${equilibrioPago ? 'pago' : ''}"
             data-mes="${mesId}"
             title="Clique: alternar responsável | Segure 1s: marcar/desmarcar como quitado">
          ${fmtBRL(equilibrio)}<br><small>${eqTag}</small>
        </div>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.cell-data').forEach(cell => {
    let pressTimer         = null;
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

    cell.addEventListener('mousedown',  startPress);
    cell.addEventListener('mouseup',    cancelPress);
    cell.addEventListener('mouseleave', cancelPress);
    cell.addEventListener('touchstart', startPress,  { passive: true });
    cell.addEventListener('touchend',   cancelPress);
    cell.addEventListener('touchmove',  cancelPress, { passive: true });

    cell.addEventListener('click', () => {
      if (longPressTriggered) { longPressTriggered = false; return; }
      editarCelula(cell.dataset.mes, cell.dataset.col);
    });
  });

  tbody.querySelectorAll('.cell-equilibrio').forEach(cell => {
    let pressTimer         = null;
    let longPressTriggered = false;

    const startPress = () => {
      longPressTriggered = false;
      pressTimer = setTimeout(() => {
        longPressTriggered = true;
        cell.classList.add('cell-pressing');
        toggleEquilibrio(cell.dataset.mes);
      }, 1000);
    };

    const cancelPress = () => {
      clearTimeout(pressTimer);
      cell.classList.remove('cell-pressing');
    };

    cell.addEventListener('mousedown',  startPress);
    cell.addEventListener('mouseup',    cancelPress);
    cell.addEventListener('mouseleave', cancelPress);
    cell.addEventListener('touchstart', startPress,  { passive: true });
    cell.addEventListener('touchend',   cancelPress);
    cell.addEventListener('touchmove',  cancelPress, { passive: true });

    cell.addEventListener('click', () => {
      if (longPressTriggered) { longPressTriggered = false; return; }
      ciclarEquilibrioPagante(cell.dataset.mes);
    });
  });

  const mesAtual = meses[mesAtualId()];
  if (mesAtual) {
    const totalAtual = Object.values(mesAtual.colunas || {})
      .reduce((s, c) => s + (parseFloat(c.valor) || 0), 0);
    document.getElementById('mes-atual-metade').textContent = fmtBRL(totalAtual / 2);
  } else {
    document.getElementById('mes-atual-metade').textContent = 'R$ —';
  }
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

      const novaOrdem = [...colunasOrdem];
      const [moved]   = novaOrdem.splice(dragIdx, 1);
      novaOrdem.splice(idx, 0, moved);

      try {
        await setDoc(doc(db, 'config', 'contas_casa_colunas'), {
          colunas: colunasConfig,
          ordem: novaOrdem
        });
      } catch {
        showToast('Erro ao reordenar colunas.', 'error');
      }
    });
  });
}

// ────────────────────────────────────────────
// AÇÕES — SALVO IMEDIATAMENTE NO FIRESTORE
// ────────────────────────────────────────────
async function toggleStatus(mesId, colName) {
  const cols  = meses[mesId]?.colunas || {};
  const atual = cols[colName]?.status || 'naoPago';
  const novo  = atual === 'Pago' ? 'naoPago' : 'Pago';
  const cell  = cols[colName] || { valor: 0, pagante: colunasConfig[colName]?.defaultPagante || 'Digo' };
  try {
    await setDoc(doc(db, 'contas_casa', mesId), {
      dataMes: mesIdParaLabel(mesId),
      colunas: { ...cols, [colName]: { ...cell, status: novo } }
    }, { merge: true });
  } catch {
    showToast('Erro ao atualizar status.', 'error');
  }
}

async function toggleEquilibrio(mesId) {
  const atual = meses[mesId]?.equilibrioPago === true;
  try {
    await setDoc(doc(db, 'contas_casa', mesId), {
      dataMes: mesIdParaLabel(mesId),
      equilibrioPago: !atual
    }, { merge: true });
  } catch {
    showToast('Erro ao atualizar equilíbrio.', 'error');
  }
}

async function ciclarEquilibrioPagante(mesId) {
  const atual   = meses[mesId]?.equilibrioPagante || '';
  const proximo = atual === '' ? 'Bella' : atual === 'Bella' ? 'Digo' : '';
  try {
    await setDoc(doc(db, 'contas_casa', mesId), {
      dataMes: mesIdParaLabel(mesId),
      equilibrioPagante: proximo
    }, { merge: true });
  } catch {
    showToast('Erro ao atualizar responsável.', 'error');
  }
}

function editarCelula(mesId, colName) {
  const cols    = meses[mesId]?.colunas || {};
  const current = cols[colName] || {};
  const valor   = current.valor || 0;
  const pagante = current.pagante || colunasConfig[colName]?.defaultPagante || 'Digo';

  openModal(
    `Editar — ${colName} (${idToLabel(mesId)})`,
    `<div class="form-group">
       <label>Valor (R$)</label>
       <input type="number" id="edit-valor-casa" value="${valor}" step="0.01" min="0" class="form-control">
     </div>
     <div class="form-group">
       <label>Responsável pelo pagamento</label>
       <select id="edit-pagante-casa" class="form-control">
         <option value="Digo"  ${pagante === 'Digo'  ? 'selected' : ''}>Digo</option>
         <option value="Bella" ${pagante === 'Bella' ? 'selected' : ''}>Bella</option>
       </select>
     </div>`,
    async () => {
      const novoValor   = parseFloat(document.getElementById('edit-valor-casa').value) || 0;
      const novoPagante = document.getElementById('edit-pagante-casa').value;
      const status      = cols[colName]?.status || 'naoPago';
      try {
        await setDoc(doc(db, 'contas_casa', mesId), {
          dataMes: mesIdParaLabel(mesId),
          colunas: { ...cols, [colName]: { valor: novoValor, pagante: novoPagante, status } }
        }, { merge: true });
        showToast('Valor atualizado!', 'success');
      } catch {
        showToast('Erro ao atualizar.', 'error');
      }
    },
    'Salvar'
  );
}

// ────────────────────────────────────────────
// GERENCIAR MESES E COLUNAS
// ────────────────────────────────────────────
async function adicionarMes() {
  const ids    = Object.keys(meses).sort();
  const ultimo = ids.length > 0 ? ids[ids.length - 1] : mesAtualId();
  const [y, m] = ultimo.split('-').map(Number);
  const proximo = new Date(y, m, 1);
  const mesId  = `${proximo.getFullYear()}-${String(proximo.getMonth() + 1).padStart(2, '0')}`;

  if (meses[mesId]) { showToast(`${idToLabel(mesId)} já existe.`, ''); return; }

  const colsPadrao = {};
  colunasOrdem.forEach(nome => {
    colsPadrao[nome] = { valor: 0, status: 'naoPago', pagante: colunasConfig[nome]?.defaultPagante || 'Digo' };
  });

  try {
    await setDoc(doc(db, 'contas_casa', mesId), { dataMes: mesIdParaLabel(mesId), colunas: colsPadrao });
    if (mesId > filtroFim) {
      filtroFim = mesId;
      document.getElementById('casa-filtro-fim').value = filtroFim;
    }
    showToast(`${idToLabel(mesId)} adicionado!`, 'success');
  } catch {
    showToast('Erro ao adicionar mês.', 'error');
  }
}

function adicionarColuna() {
  openModal(
    'Nova Conta da Casa',
    `<div class="form-group">
       <label>Nome da conta</label>
       <input type="text" id="nova-col-casa" placeholder="Ex: Mercado, Luz, Internet" class="form-control">
     </div>
     <div class="form-group">
       <label>Responsável padrão</label>
       <select id="pagante-padrao-casa" class="form-control">
         <option value="Digo">Digo</option>
         <option value="Bella">Bella</option>
       </select>
     </div>`,
    async () => {
      const nome    = document.getElementById('nova-col-casa').value.trim();
      const pagante = document.getElementById('pagante-padrao-casa').value;
      if (!nome) { showToast('Nome inválido.', 'error'); return; }
      if (colunasConfig[nome]) { showToast('Conta já existe.', 'error'); return; }

      const novoConfig = { ...colunasConfig, [nome]: { defaultPagante: pagante } };
      const novaOrdem  = [...colunasOrdem, nome];
      try {
        await setDoc(doc(db, 'config', 'contas_casa_colunas'), { colunas: novoConfig, ordem: novaOrdem });
        for (const mesId of Object.keys(meses)) {
          const cols = meses[mesId]?.colunas || {};
          if (!cols[nome]) {
            await setDoc(doc(db, 'contas_casa', mesId), {
              colunas: { ...cols, [nome]: { valor: 0, status: 'naoPago', pagante } }
            }, { merge: true });
          }
        }
        showToast(`Conta "${nome}" adicionada!`, 'success');
      } catch {
        showToast('Erro ao adicionar conta.', 'error');
      }
    },
    'Adicionar'
  );
}

function removerColuna(nome) {
  openModal(
    `Remover conta "${nome}"`,
    `<p>Remove a coluna <strong>${nome}</strong> de todos os meses. Os valores serão perdidos.</p>`,
    async () => {
      try {
        const novoConfig = { ...colunasConfig };
        delete novoConfig[nome];
        const novaOrdem = colunasOrdem.filter(k => k !== nome);
        await setDoc(doc(db, 'config', 'contas_casa_colunas'), { colunas: novoConfig, ordem: novaOrdem });
        for (const mesId of Object.keys(meses)) {
          await updateDoc(doc(db, 'contas_casa', mesId), { [`colunas.${nome}`]: deleteField() });
        }
        showToast(`Conta "${nome}" removida.`, 'success');
      } catch {
        showToast('Erro ao remover conta.', 'error');
      }
    },
    'Remover'
  );
}

function mesIdParaLabel(id) {
  const [y, m] = id.split('-');
  return `${m}-${y}`;
}
