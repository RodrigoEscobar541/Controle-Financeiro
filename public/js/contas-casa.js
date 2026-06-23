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
 *
 * Colunas fixas no HTML: Data | [dinâmicas] | Bella | Digo | Total
 * Botão "Salvar" persiste todas as edições de uma vez.
 * Clique simples: toggle status (verde/branco)
 * Duplo clique: editar valor e pagante
 * Arrastar cabeçalho de coluna: reordena e salva no BD
 */

import { db } from './firebase-config.js';
import { fmtBRL, mesAtualId, idToLabel, showToast, openModal } from './app.js';
import {
  collection, doc, setDoc, onSnapshot, deleteField, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let colunasConfig = {};  // { nome: { defaultPagante } }
let colunasOrdem  = [];  // array com os nomes na ordem de exibição
let meses         = {};
let pendingChanges= {};
let unsubMeses    = null;
let unsubConf     = null;

export function initContasCasa() {
  document.getElementById('btn-add-mes-casa').addEventListener('click', adicionarMesAtual);
  document.getElementById('btn-add-col-casa').addEventListener('click', adicionarColuna);
  document.getElementById('btn-save-casa').addEventListener('click', salvarAlteracoes);
  subscribeConfig();
}

// ────────────────────────────────────────────
// SUBSCRIPTIONS
// ────────────────────────────────────────────
function subscribeConfig() {
  unsubConf = onSnapshot(doc(db, 'config', 'contas_casa_colunas'), snap => {
    const data    = snap.exists() ? snap.data() : {};
    colunasConfig = data.colunas || {};

    // Reconstrói a ordem: respeita o array salvo, acrescenta novas chaves no final
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
    pendingChanges = {};
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
    const tag = pag
      ? `<span class="pagante-tag pagante-${pag.toLowerCase()}">${pag}</span>`
      : '';
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
  </tr>`;

  thead.querySelectorAll('.delete-col-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); removerColuna(btn.dataset.col); });
  });

  setupColDrag(thead);

  const sortedIds = Object.keys(meses).sort().reverse();

  if (sortedIds.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colunasOrdem.length + 4}" class="empty-state">
      Nenhum mês cadastrado. Clique em "+ Mês Atual" para começar.
    </td></tr>`;
    document.getElementById('mes-atual-metade').textContent = 'R$ —';
    return;
  }

  tbody.innerHTML = sortedIds.map(mesId => {
    const mes   = meses[mesId] || {};
    const local = pendingChanges[mesId] || {};
    const cols  = { ...(mes.colunas || {}), ...local };

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
             title="Clique: Pago/Não pago | Duplo clique: Editar">
          ${fmtBRL(valor)}<br><small>${tag}</small>
        </div>
      </td>`;
    }).join('');

    return `<tr>
      <td><strong>${idToLabel(mesId)}</strong></td>
      ${tds}
      <td class="col-total" style="color:#AD1457">${fmtBRL(totalBella)}</td>
      <td class="col-total" style="color:#1565C0">${fmtBRL(totalDigo)}</td>
      <td class="col-total">${fmtBRL(total)}</td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.cell-data').forEach(cell => {
    cell.addEventListener('click', () => toggleStatusLocal(cell.dataset.mes, cell.dataset.col));
    cell.addEventListener('dblclick', e => { e.stopPropagation(); editarCelulaLocal(cell.dataset.mes, cell.dataset.col); });
  });

  const mesAtual = meses[mesAtualId()];
  if (mesAtual) {
    const totalAtual = Object.values(mesAtual.colunas || {})
      .reduce((s, c) => s + (parseFloat(c.valor) || 0), 0);
    document.getElementById('mes-atual-metade').textContent = fmtBRL(totalAtual / 2);
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
// EDIÇÃO LOCAL (salvar depois)
// ────────────────────────────────────────────
function toggleStatusLocal(mesId, colName) {
  const mes     = meses[mesId]?.colunas || {};
  const local   = pendingChanges[mesId] || {};
  const current = local[colName] || mes[colName] || {};
  const novo    = (current.status || 'naoPago') === 'Pago' ? 'naoPago' : 'Pago';
  pendingChanges[mesId] = { ...local, [colName]: { ...current, status: novo } };
  renderTabela();
}

function editarCelulaLocal(mesId, colName) {
  const mes     = meses[mesId]?.colunas || {};
  const local   = pendingChanges[mesId] || {};
  const current = local[colName] || mes[colName] || {};
  const valor   = current.valor || 0;
  const pagante = current.pagante || colunasConfig[colName]?.defaultPagante || 'Digo';

  openModal(
    `Editar — ${colName} (${idToLabel(mesId)})`,
    `<div class="form-group">
       <label>Valor (R$)</label>
       <input type="number" id="edit-valor-casa" value="${valor}" step="0.01" min="0">
     </div>
     <div class="form-group">
       <label>Responsável pelo pagamento</label>
       <select id="edit-pagante-casa">
         <option value="Digo"  ${pagante === 'Digo'  ? 'selected' : ''}>Digo</option>
         <option value="Bella" ${pagante === 'Bella' ? 'selected' : ''}>Bella</option>
       </select>
     </div>`,
    () => {
      const novoValor   = parseFloat(document.getElementById('edit-valor-casa').value) || 0;
      const novoPagante = document.getElementById('edit-pagante-casa').value;
      pendingChanges[mesId] = {
        ...(pendingChanges[mesId] || {}),
        [colName]: { ...current, valor: novoValor, pagante: novoPagante }
      };
      renderTabela();
    },
    'Aplicar'
  );
}

// ────────────────────────────────────────────
// SALVAR NO FIRESTORE
// ────────────────────────────────────────────
async function salvarAlteracoes() {
  if (Object.keys(pendingChanges).length === 0) {
    showToast('Nenhuma alteração pendente.', '');
    return;
  }
  try {
    for (const [mesId, changes] of Object.entries(pendingChanges)) {
      const colsAtuais = meses[mesId]?.colunas || {};
      await setDoc(doc(db, 'contas_casa', mesId), {
        dataMes: mesIdParaLabel(mesId),
        colunas: { ...colsAtuais, ...changes }
      }, { merge: true });
    }
    showToast('Dados salvos com sucesso!', 'success');
    pendingChanges = {};
  } catch {
    showToast('Erro ao salvar. Tente novamente.', 'error');
  }
}

// ────────────────────────────────────────────
// GERENCIAR MESES E COLUNAS
// ────────────────────────────────────────────
async function adicionarMesAtual() {
  const mesId = mesAtualId();
  if (meses[mesId]) { showToast('Mês atual já existe.', ''); return; }

  const colsPadrao = {};
  colunasOrdem.forEach(nome => {
    colsPadrao[nome] = { valor: 0, status: 'naoPago', pagante: colunasConfig[nome]?.defaultPagante || 'Digo' };
  });

  try {
    await setDoc(doc(db, 'contas_casa', mesId), { dataMes: mesIdParaLabel(mesId), colunas: colsPadrao });
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
       <input type="text" id="nova-col-casa" placeholder="Ex: Mercado, Luz, Internet">
     </div>
     <div class="form-group">
       <label>Responsável padrão</label>
       <select id="pagante-padrao-casa">
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
