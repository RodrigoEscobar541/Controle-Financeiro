import { db } from './firebase-config.js';
import { fmtBRL, fmtDate, showToast, openModal } from './app.js';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, deleteDoc, doc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let unsubscribe = null;

export function initBanco() {
  renderForm();
  subscribeTransacoes();
}

function renderForm() {
  const form = document.getElementById('banco-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const tipo      = form.querySelector('input[name="tipo"]:checked').value;
    const descricao = document.getElementById('banco-descricao').value.trim();
    const valor     = parseFloat(document.getElementById('banco-valor').value);

    if (!descricao || isNaN(valor) || valor <= 0) {
      showToast('Preencha todos os campos corretamente.', 'error');
      return;
    }

    const hoje = new Date();
    const data = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;

    try {
      await addDoc(collection(db, 'banco'), { data, tipo, valor, descricao });
      showToast(`${tipo} registrada com sucesso!`, 'success');
      form.reset();
    } catch {
      showToast('Erro ao registrar. Tente novamente.', 'error');
    }
  });
}

function subscribeTransacoes() {
  if (unsubscribe) unsubscribe();

  const q = query(collection(db, 'banco'), orderBy('data', 'desc'));
  unsubscribe = onSnapshot(q, snap => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTabela(docs.filter(r => r.tipo === 'Entrada'), 'banco-entradas', 'success');
    renderTabela(docs.filter(r => r.tipo === 'Saida'),   'banco-saidas',   'danger');
  }, () => {
    showToast('Erro ao escutar transações.', 'error');
  });
}

function renderTabela(docs, tableId, colorClass) {
  const tbody = document.querySelector(`#${tableId} tbody`);

  if (docs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Nenhum registro</td></tr>`;
    return;
  }

  tbody.innerHTML = docs.map(d => `
    <tr>
      <td>${fmtDate(d.data)}</td>
      <td>${d.descricao}</td>
      <td class="text-right text-${colorClass}">${fmtBRL(d.valor)}</td>
      <td style="text-align:center">
        <button class="btn-icon" data-id="${d.id}" title="Excluir">🗑️</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-icon').forEach(btn => {
    btn.addEventListener('click', () => confirmarExclusao(btn.dataset.id));
  });
}

function confirmarExclusao(id) {
  openModal(
    'Excluir lançamento',
    '<p>Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.</p>',
    async () => {
      try {
        await deleteDoc(doc(db, 'banco', id));
        showToast('Lançamento excluído.', 'success');
      } catch {
        showToast('Erro ao excluir.', 'error');
      }
    },
    'Excluir'
  );
}
