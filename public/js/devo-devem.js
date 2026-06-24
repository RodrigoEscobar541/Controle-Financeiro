/**
 * Devo e Devem
 *
 * Estrutura Firestore:
 *   Coleção: dividas
 *   { tipo: "Devo"|"Devem", data: "YYYY-MM", descricao, valor, status: "Aberta"|"Fechada" }
 *
 * Ao registrar com N parcelas, gera N documentos (um por mês).
 * Meses passados ficam "Fechada"; mês atual em diante ficam "Aberta".
 */

import { db } from './firebase-config.js';
import { fmtBRL, showToast, openModal } from './app.js';
import {
  collection, query, orderBy, where, onSnapshot,
  addDoc, deleteDoc, updateDoc, doc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let dividas             = [];
let unsubscribe         = null;
let filtroMesDevo       = '';
let filtroMesDevem      = '';
let mostrarFechadasDevo  = false;
let mostrarFechadasDevem = false;
let mostrarAntigos      = false;

function corteUmAno() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

export function initDevoDeve() {
  const mesAtual = mesAtualYYYYMM();
  filtroMesDevo  = mesAtual;
  filtroMesDevem = mesAtual;
  setupForm();
  setupFiltros();
  subscribeDividas();
}

// ── FORMULÁRIO ────────────────────────────────────────────────────────────────

function setupForm() {
  const now      = new Date();
  const mesAtual = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

  const dataInput = document.getElementById('dd-data');
  dataInput.value = mesAtual;

  dataInput.addEventListener('input', () => {
    let v = dataInput.value.replace(/\D/g, '');
    if (v.length > 2) v = v.slice(0, 2) + '-' + v.slice(2, 6);
    dataInput.value = v;
  });

  document.getElementById('dd-form').addEventListener('submit', async e => {
    e.preventDefault();

    const tipo      = document.querySelector('input[name="dd-tipo"]:checked').value;
    const descricao = document.getElementById('dd-descricao').value.trim();
    const parcelas  = Math.max(1, parseInt(document.getElementById('dd-parcelas').value) || 1);
    const valor     = parseFloat(document.getElementById('dd-valor').value);
    const dataStr   = document.getElementById('dd-data').value.trim();

    if (!descricao || isNaN(valor) || valor <= 0) {
      showToast('Preencha descrição e valor.', 'error'); return;
    }
    if (!validarMesAno(dataStr)) {
      showToast('Data inválida. Use MM-AAAA (ex: 06-2026).', 'error'); return;
    }

    try {
      await gerarParcelas(tipo, descricao, parcelas, valor, dataStr);
      const msg = parcelas === 1 ? 'Dívida registrada!' : `${parcelas} parcelas registradas!`;
      showToast(msg, 'success');
      e.target.reset();
      dataInput.value = mesAtual;
    } catch {
      showToast('Erro ao registrar. Tente novamente.', 'error');
    }
  });
}

function validarMesAno(str) {
  if (!str || !/^\d{2}-\d{4}$/.test(str)) return false;
  const mes = parseInt(str.slice(0, 2));
  return mes >= 1 && mes <= 12;
}

async function gerarParcelas(tipo, descricao, parcelas, valorTotal, dataStr) {
  const valorParcela = Math.round((valorTotal / parcelas) * 100) / 100;

  const now         = new Date();
  const mesAtualNum = now.getFullYear() * 100 + (now.getMonth() + 1);

  const mesInicio = parseInt(dataStr.slice(0, 2));
  const anoInicio = parseInt(dataStr.slice(3));

  for (let i = 0; i < parcelas; i++) {
    const totalMes  = mesInicio + i;
    const anoOffset = Math.floor((totalMes - 1) / 12);
    const mesReal   = ((totalMes - 1) % 12) + 1;
    const anoReal   = anoInicio + anoOffset;

    const data   = `${anoReal}-${String(mesReal).padStart(2, '0')}`;
    const docNum = anoReal * 100 + mesReal;
    const status = docNum < mesAtualNum ? 'Fechada' : 'Aberta';

    await addDoc(collection(db, 'dividas'), { tipo, data, descricao, valor: valorParcela, status });
  }
}

// ── FILTROS ───────────────────────────────────────────────────────────────────

function setupFiltros() {
  const mesAtual = mesAtualYYYYMM();

  const dovoMesEl  = document.getElementById('dd-devo-mes');
  const devemMesEl = document.getElementById('dd-devem-mes');
  dovoMesEl.value  = mesAtual;
  devemMesEl.value = mesAtual;

  dovoMesEl.addEventListener('change', e => {
    filtroMesDevo = e.target.value;
    renderTabelas();
  });
  devemMesEl.addEventListener('change', e => {
    filtroMesDevem = e.target.value;
    renderTabelas();
  });

  document.getElementById('dd-devo-fechadas').addEventListener('change', e => {
    mostrarFechadasDevo = e.target.checked;
    renderTabelas();
  });
  document.getElementById('dd-devem-fechadas').addEventListener('change', e => {
    mostrarFechadasDevem = e.target.checked;
    renderTabelas();
  });
}

function aplicarFiltro(lista, filtroMes, mostrarFechadas) {
  return lista.filter(d => {
    if (d.data !== filtroMes) return false;
    if (d.status === 'Fechada' && !mostrarFechadas) return false;
    return true;
  });
}

// ── TABELAS ───────────────────────────────────────────────────────────────────

function subscribeDividas() {
  if (unsubscribe) unsubscribe();

  const constraints = [];
  if (!mostrarAntigos) constraints.push(where('data', '>=', corteUmAno()));
  constraints.push(orderBy('data', 'asc'));

  const q = query(collection(db, 'dividas'), ...constraints);
  unsubscribe = onSnapshot(q, snap => {
    dividas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTabelas();
  }, () => showToast('Erro ao carregar dívidas.', 'error'));
}

function renderTabelas() {
  const devo  = dividas.filter(d => d.tipo === 'Devo');
  const devem = dividas.filter(d => d.tipo === 'Devem');

  renderTabela(aplicarFiltro(devo,  filtroMesDevo,  mostrarFechadasDevo),  devo,  'dd-devo-tbody',  'dd-devo-total');
  renderTabela(aplicarFiltro(devem, filtroMesDevem, mostrarFechadasDevem), devem, 'dd-devem-tbody', 'dd-devem-total');

  if (!mostrarAntigos) {
    const devoTbody = document.getElementById('dd-devo-tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" style="text-align:center;padding:.5rem 0">
      <button class="btn-secondary btn-dd-antigos" style="font-size:.8rem">Carregar histórico completo (mais de 1 ano)</button>
    </td>`;
    devoTbody.appendChild(tr);
    tr.querySelector('.btn-dd-antigos').addEventListener('click', () => {
      mostrarAntigos = true;
      subscribeDividas();
    });
  }
}

function renderTabela(listaFiltrada, listaCompleta, tbodyId, totalId) {
  const tbody   = document.getElementById(tbodyId);
  const totalEl = document.getElementById(totalId);

  // Total sempre calculado sobre todos os itens abertos (não só os visíveis)
  const totalAberta = listaCompleta
    .filter(d => d.status === 'Aberta')
    .reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
  totalEl.textContent = fmtBRL(totalAberta);

  if (listaFiltrada.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Nenhuma dívida registrada.</td></tr>`;
    return;
  }

  tbody.innerHTML = listaFiltrada.map(item => {
    const aberta = item.status === 'Aberta';
    return `<tr>
      <td>${fmtMesAno(item.data)}</td>
      <td>${esc(item.descricao)}</td>
      <td class="text-right">${fmtBRL(item.valor)}</td>
      <td style="text-align:center">
        <span class="status-badge status-${aberta ? 'aberta' : 'fechada'}"
              data-id="${item.id}" data-status="${item.status}"
              title="Clique para alternar status">
          ${item.status}
        </span>
      </td>
      <td style="text-align:center">
        <button class="btn-icon" data-action="edit" data-id="${item.id}" title="Editar">✏️</button>
        <button class="btn-icon" data-action="delete" data-id="${item.id}" title="Excluir">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.status-badge').forEach(badge => {
    badge.addEventListener('click', () => toggleStatus(badge.dataset.id, badge.dataset.status));
  });
  tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = dividas.find(d => d.id === btn.dataset.id);
      if (item) abrirModalEditar(item);
    });
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => confirmarExclusao(btn.dataset.id));
  });
}

async function toggleStatus(id, statusAtual) {
  const novoStatus = statusAtual === 'Aberta' ? 'Fechada' : 'Aberta';
  try {
    await updateDoc(doc(db, 'dividas', id), { status: novoStatus });
  } catch {
    showToast('Erro ao atualizar status.', 'error');
  }
}

function abrirModalEditar(divida) {
  const dataInput = yyyymmToMmAaaa(divida.data);

  openModal(
    'Editar parcela',
    `<div class="form-group">
       <label>Descrição</label>
       <input type="text" id="dd-edit-descricao" value="${esc(divida.descricao)}" required>
     </div>
     <div class="form-group">
       <label>Valor (R$)</label>
       <input type="number" id="dd-edit-valor" value="${divida.valor}" min="0.01" step="0.01" required>
     </div>
     <div class="form-group">
       <label>Mês (MM-AAAA)</label>
       <input type="text" id="dd-edit-data" value="${dataInput}" placeholder="06-2026" maxlength="7">
     </div>`,
    async () => {
      const descricao = document.getElementById('dd-edit-descricao').value.trim();
      const valor     = parseFloat(document.getElementById('dd-edit-valor').value);
      const dataStr   = document.getElementById('dd-edit-data').value.trim();

      if (!descricao || isNaN(valor) || valor <= 0) {
        showToast('Preencha descrição e valor.', 'error'); return;
      }
      if (!validarMesAno(dataStr)) {
        showToast('Data inválida. Use MM-AAAA (ex: 06-2026).', 'error'); return;
      }

      const [mes, ano] = dataStr.split('-');
      const data = `${ano}-${mes.padStart(2, '0')}`;

      try {
        await updateDoc(doc(db, 'dividas', divida.id), { descricao, valor, data });
        showToast('Parcela atualizada!', 'success');
      } catch {
        showToast('Erro ao atualizar.', 'error');
      }
    },
    'Salvar'
  );
}

function confirmarExclusao(id) {
  const divida = dividas.find(d => d.id === id);
  openModal(
    'Excluir parcela',
    `<p>Deseja excluir a parcela de <strong>${fmtBRL(divida?.valor)}</strong>
     (${fmtMesAno(divida?.data)})? Esta ação não pode ser desfeita.</p>`,
    async () => {
      try {
        await deleteDoc(doc(db, 'dividas', id));
        showToast('Parcela excluída.', 'success');
      } catch { showToast('Erro ao excluir.', 'error'); }
    },
    'Excluir'
  );
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function mesAtualYYYYMM() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function fmtMesAno(data) {
  if (!data) return '—';
  const [y, m] = data.split('-');
  return `${m}/${y}`;
}

function yyyymmToMmAaaa(str) {
  if (!str) return '';
  const [y, m] = str.split('-');
  return `${m}-${y}`;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
