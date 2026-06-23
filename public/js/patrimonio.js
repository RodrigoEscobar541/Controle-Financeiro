/**
 * Patrimônio e Investimentos
 *
 * Estrutura Firestore:
 *   Coleção: patrimonio
 *   Documento (ID aleatório):
 *     { nomeDoAtivo: "BTC", plataforma: "Mercado Bitcoin", valor: 2180 }
 */

import { db } from './firebase-config.js';
import { fmtBRL, showToast, openModal } from './app.js';
import {
  collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let ativos     = [];
let unsubscribe = null;

export function initPatrimonio() {
  document.getElementById('btn-add-ativo').addEventListener('click', abrirModalNovoAtivo);
  subscribeAtivos();
}

function subscribeAtivos() {
  if (unsubscribe) unsubscribe();
  unsubscribe = onSnapshot(collection(db, 'patrimonio'), snap => {
    ativos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTabela();
  }, () => showToast('Erro ao carregar patrimônio.', 'error'));
}

function renderTabela() {
  const tbody = document.getElementById('patrimonio-tbody');
  const totalEl = document.getElementById('patrimonio-total');

  if (ativos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">
      Nenhum ativo cadastrado. Clique em "+ Novo Ativo".
    </td></tr>`;
    totalEl.textContent = 'R$ 0,00';
    return;
  }

  let total = 0;
  tbody.innerHTML = ativos.map(a => {
    total += parseFloat(a.valor) || 0;
    return `<tr>
      <td><strong>${a.nomeDoAtivo}</strong></td>
      <td>${a.plataforma}</td>
      <td class="text-right">${fmtBRL(a.valor)}</td>
      <td style="text-align:center;white-space:nowrap">
        <button class="btn-icon" data-action="edit" data-id="${a.id}" title="Editar">✏️</button>
        <button class="btn-icon" data-action="delete" data-id="${a.id}" title="Excluir">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  totalEl.textContent = fmtBRL(total);

  tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ativo = ativos.find(a => a.id === btn.dataset.id);
      if (ativo) abrirModalEditar(ativo);
    });
  });

  tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => confirmarExclusao(btn.dataset.id));
  });
}

function formHtml(ativo = {}) {
  return `
    <div class="form-group">
      <label>Nome do Ativo</label>
      <input type="text" id="ativo-nome" value="${ativo.nomeDoAtivo || ''}" placeholder="Ex: BTC, Tesouro Selic">
    </div>
    <div class="form-group">
      <label>Plataforma</label>
      <input type="text" id="ativo-plataforma" value="${ativo.plataforma || ''}" placeholder="Ex: Mercado Bitcoin, XP">
    </div>
    <div class="form-group">
      <label>Valor (R$)</label>
      <input type="number" id="ativo-valor" value="${ativo.valor || ''}" step="0.01" min="0" placeholder="0,00">
    </div>`;
}

function abrirModalNovoAtivo() {
  openModal(
    'Novo Ativo',
    formHtml(),
    async () => {
      const nome       = document.getElementById('ativo-nome').value.trim();
      const plataforma = document.getElementById('ativo-plataforma').value.trim();
      const valor      = parseFloat(document.getElementById('ativo-valor').value);

      if (!nome || !plataforma || isNaN(valor) || valor < 0) {
        showToast('Preencha todos os campos.', 'error');
        return;
      }
      try {
        await addDoc(collection(db, 'patrimonio'), { nomeDoAtivo: nome, plataforma, valor });
        showToast('Ativo adicionado!', 'success');
      } catch {
        showToast('Erro ao adicionar ativo.', 'error');
      }
    },
    'Adicionar'
  );
}

function abrirModalEditar(ativo) {
  openModal(
    `Editar — ${ativo.nomeDoAtivo}`,
    formHtml(ativo),
    async () => {
      const nome       = document.getElementById('ativo-nome').value.trim();
      const plataforma = document.getElementById('ativo-plataforma').value.trim();
      const valor      = parseFloat(document.getElementById('ativo-valor').value);

      if (!nome || !plataforma || isNaN(valor) || valor < 0) {
        showToast('Preencha todos os campos.', 'error');
        return;
      }
      try {
        await updateDoc(doc(db, 'patrimonio', ativo.id), { nomeDoAtivo: nome, plataforma, valor });
        showToast('Ativo atualizado!', 'success');
      } catch {
        showToast('Erro ao atualizar.', 'error');
      }
    },
    'Salvar'
  );
}

function confirmarExclusao(id) {
  const ativo = ativos.find(a => a.id === id);
  openModal(
    'Excluir ativo',
    `<p>Deseja excluir <strong>${ativo?.nomeDoAtivo || 'este ativo'}</strong>? Esta ação não pode ser desfeita.</p>`,
    async () => {
      try {
        await deleteDoc(doc(db, 'patrimonio', id));
        showToast('Ativo excluído.', 'success');
      } catch {
        showToast('Erro ao excluir.', 'error');
      }
    },
    'Excluir'
  );
}
