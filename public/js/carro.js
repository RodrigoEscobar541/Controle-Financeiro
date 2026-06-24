/**
 * Carro
 *
 * Estrutura Firestore:
 *   carro_afazer     { prioridade, descricao, valor }
 *   carro_feitos     { data: "YYYY-MM-DD", descricao, valor }
 *   carro_manutencao { descricao, data: "YYYY-MM-DD", kmUltimaTroca, kmProximaTroca, valor }
 */

import { db } from './firebase-config.js';
import { fmtBRL, fmtDate, showToast, openModal } from './app.js';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, deleteDoc, updateDoc, doc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let afazer        = [];
let feitos        = [];
let manutencao    = [];
let unsubs        = [];
let feitosVisiveis = 5;

export function initCarro() {
  document.getElementById('btn-add-afazer').addEventListener('click',     () => abrirModalAfazer());
  document.getElementById('btn-add-feito').addEventListener('click',      () => abrirModalFeito());
  document.getElementById('btn-add-manutencao').addEventListener('click', () => abrirModalManutencao());
  subscribeAll();
}

function subscribeAll() {
  unsubs.forEach(u => u());
  unsubs = [];

  unsubs.push(onSnapshot(
    query(collection(db, 'carro_afazer'), orderBy('prioridade', 'asc')),
    snap => { afazer = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderAfazer(); },
    () => showToast('Erro ao carregar A Fazer.', 'error')
  ));

  unsubs.push(onSnapshot(
    query(collection(db, 'carro_feitos'), orderBy('data', 'desc')),
    snap => { feitos = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderFeitos(); },
    () => showToast('Erro ao carregar Feitos.', 'error')
  ));

  unsubs.push(onSnapshot(
    collection(db, 'carro_manutencao'),
    snap => { manutencao = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderManutencao(); },
    () => showToast('Erro ao carregar Manutenção.', 'error')
  ));
}

// ── A FAZER ───────────────────────────────────────────────────────────────────

function renderAfazer() {
  const tbody   = document.querySelector('#carro-afazer-table tbody');
  const totalEl = document.getElementById('carro-afazer-total');

  if (afazer.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Nenhum item pendente.</td></tr>`;
    totalEl.textContent = 'R$ 0,00';
    return;
  }

  let total = 0;
  tbody.innerHTML = afazer.map(item => {
    total += parseFloat(item.valor) || 0;
    return `<tr>
      <td style="text-align:center"><strong>${item.prioridade}</strong></td>
      <td>${esc(item.descricao)}</td>
      <td class="text-right">${fmtBRL(item.valor)}</td>
      <td style="text-align:center;white-space:nowrap">
        <button class="btn-icon" data-action="edit"   data-id="${item.id}" title="Editar">✏️</button>
        <button class="btn-icon" data-action="delete" data-id="${item.id}" title="Excluir">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  totalEl.textContent = fmtBRL(total);

  tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = afazer.find(a => a.id === btn.dataset.id);
      if (item) abrirModalAfazer(item);
    });
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => excluirItem('carro_afazer', btn.dataset.id, afazer));
  });
}

function abrirModalAfazer(item) {
  const editar = !!item;
  openModal(
    editar ? 'Editar item' : 'Novo item — A Fazer',
    `<div class="form-group">
       <label>Prioridade</label>
       <input type="number" id="af-prioridade" value="${editar ? item.prioridade : ''}" min="1" placeholder="1 = mais urgente">
     </div>
     <div class="form-group">
       <label>Descrição</label>
       <input type="text" id="af-descricao" value="${editar ? esc(item.descricao) : ''}" placeholder="Ex: Trocar pneu traseiro">
     </div>
     <div class="form-group">
       <label>Valor estimado (R$)</label>
       <input type="number" id="af-valor" value="${editar ? item.valor : ''}" step="0.01" min="0" placeholder="0,00">
     </div>`,
    async () => {
      const prioridade = parseInt(document.getElementById('af-prioridade').value);
      const descricao  = document.getElementById('af-descricao').value.trim();
      const valor      = parseFloat(document.getElementById('af-valor').value) || 0;

      if (!descricao || isNaN(prioridade) || prioridade < 1) {
        showToast('Preencha prioridade e descrição.', 'error'); return;
      }
      try {
        if (editar) {
          await updateDoc(doc(db, 'carro_afazer', item.id), { prioridade, descricao, valor });
          showToast('Item atualizado!', 'success');
        } else {
          await addDoc(collection(db, 'carro_afazer'), { prioridade, descricao, valor });
          showToast('Item adicionado!', 'success');
        }
      } catch { showToast('Erro ao salvar.', 'error'); }
    },
    editar ? 'Salvar' : 'Adicionar'
  );
}

// ── FEITOS ────────────────────────────────────────────────────────────────────

function renderFeitos() {
  const tbody   = document.querySelector('#carro-feitos-table tbody');
  const totalEl = document.getElementById('carro-feitos-total');

  if (feitos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Nenhuma manutenção registrada.</td></tr>`;
    totalEl.textContent = 'R$ 0,00';
    return;
  }

  let total = 0;
  feitos.forEach(item => { total += parseFloat(item.valor) || 0; });

  const visiveis = feitos.slice(0, feitosVisiveis);

  tbody.innerHTML = visiveis.map(item => `<tr>
      <td>${fmtDate(item.data)}</td>
      <td>${esc(item.descricao)}</td>
      <td class="text-right text-success">${fmtBRL(item.valor)}</td>
      <td style="text-align:center;white-space:nowrap">
        <button class="btn-icon" data-action="edit"   data-id="${item.id}" title="Editar">✏️</button>
        <button class="btn-icon" data-action="delete" data-id="${item.id}" title="Excluir">🗑️</button>
      </td>
    </tr>`).join('');

  if (feitos.length > feitosVisiveis) {
    const restantes = feitos.length - feitosVisiveis;
    tbody.innerHTML += `<tr>
      <td colspan="4" style="text-align:center;padding:.6rem 0">
        <button id="btn-feitos-mais" class="btn-secondary">Carregar mais (${restantes})</button>
      </td>
    </tr>`;
  }

  totalEl.textContent = fmtBRL(total);

  tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = feitos.find(f => f.id === btn.dataset.id);
      if (item) abrirModalFeito(item);
    });
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => excluirItem('carro_feitos', btn.dataset.id, feitos));
  });

  const btnMais = document.getElementById('btn-feitos-mais');
  if (btnMais) {
    btnMais.addEventListener('click', () => { feitosVisiveis += 5; renderFeitos(); });
  }
}

function abrirModalFeito(item) {
  const editar = !!item;
  const hoje   = new Date().toISOString().split('T')[0];
  openModal(
    editar ? 'Editar Manutenção' : 'Registrar Manutenção Feita',
    `<div class="form-group">
       <label>Data</label>
       <input type="date" id="ft-data" value="${editar ? item.data : hoje}">
     </div>
     <div class="form-group">
       <label>Descrição</label>
       <input type="text" id="ft-descricao" value="${editar ? esc(item.descricao) : ''}" placeholder="Ex: Troca de óleo">
     </div>
     <div class="form-group">
       <label>Valor (R$)</label>
       <input type="number" id="ft-valor" value="${editar ? item.valor : ''}" step="0.01" min="0" placeholder="0,00">
     </div>`,
    async () => {
      const data      = document.getElementById('ft-data').value;
      const descricao = document.getElementById('ft-descricao').value.trim();
      const valor     = parseFloat(document.getElementById('ft-valor').value) || 0;

      if (!data || !descricao) {
        showToast('Preencha data e descrição.', 'error'); return;
      }
      try {
        if (editar) {
          await updateDoc(doc(db, 'carro_feitos', item.id), { data, descricao, valor });
          showToast('Manutenção atualizada!', 'success');
        } else {
          await addDoc(collection(db, 'carro_feitos'), { data, descricao, valor });
          showToast('Manutenção registrada!', 'success');
        }
      } catch { showToast('Erro ao salvar.', 'error'); }
    },
    editar ? 'Salvar' : 'Registrar'
  );
}

// ── MANUTENÇÃO PREVENTIVA ─────────────────────────────────────────────────────

function renderManutencao() {
  const tbody = document.querySelector('#carro-manutencao-table tbody');

  if (manutencao.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Nenhum item cadastrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = manutencao.map(item => `
    <tr>
      <td>${esc(item.descricao)}</td>
      <td>${item.data ? fmtDate(item.data) : '—'}</td>
      <td>${esc(item.kmUltimaTroca) || '—'}</td>
      <td>${esc(item.kmProximaTroca) || '—'}</td>
      <td class="text-right">${fmtBRL(item.valor)}</td>
      <td style="text-align:center;white-space:nowrap">
        <button class="btn-icon" data-action="edit"   data-id="${item.id}" title="Editar">✏️</button>
        <button class="btn-icon" data-action="delete" data-id="${item.id}" title="Excluir">🗑️</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = manutencao.find(m => m.id === btn.dataset.id);
      if (item) abrirModalManutencao(item);
    });
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => excluirItem('carro_manutencao', btn.dataset.id, manutencao));
  });
}

function abrirModalManutencao(item) {
  const editar = !!item;
  openModal(
    editar ? `Editar — ${esc(item.descricao)}` : 'Nova Manutenção Preventiva',
    `<div class="form-group">
       <label>Descrição</label>
       <input type="text" id="mn-descricao" value="${editar ? esc(item.descricao) : ''}" placeholder="Ex: Troca de óleo">
     </div>
     <div class="form-group">
       <label>Data da última troca</label>
       <input type="date" id="mn-data" value="${editar && item.data ? item.data : ''}">
     </div>
     <div class="form-group">
       <label>KM da última troca</label>
       <input type="text" id="mn-km-ultima" value="${editar ? esc(item.kmUltimaTroca || '') : ''}" placeholder="Ex: 52.400 km">
     </div>
     <div class="form-group">
       <label>KM da próxima troca</label>
       <input type="text" id="mn-km-proxima" value="${editar ? esc(item.kmProximaTroca || '') : ''}" placeholder="Ex: 57.400 km">
     </div>
     <div class="form-group">
       <label>Valor (R$)</label>
       <input type="number" id="mn-valor" value="${editar ? item.valor : ''}" step="0.01" min="0" placeholder="0,00">
     </div>`,
    async () => {
      const descricao      = document.getElementById('mn-descricao').value.trim();
      const data           = document.getElementById('mn-data').value;
      const kmUltimaTroca  = document.getElementById('mn-km-ultima').value.trim();
      const kmProximaTroca = document.getElementById('mn-km-proxima').value.trim();
      const valor          = parseFloat(document.getElementById('mn-valor').value) || 0;

      if (!descricao) { showToast('Preencha a descrição.', 'error'); return; }

      const payload = { descricao, data, kmUltimaTroca, kmProximaTroca, valor };
      try {
        if (editar) {
          await updateDoc(doc(db, 'carro_manutencao', item.id), payload);
          showToast('Atualizado!', 'success');
        } else {
          await addDoc(collection(db, 'carro_manutencao'), payload);
          showToast('Adicionado!', 'success');
        }
      } catch { showToast('Erro ao salvar.', 'error'); }
    },
    editar ? 'Salvar' : 'Adicionar'
  );
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function excluirItem(colecao, id, lista) {
  const nome = lista.find(i => i.id === id)?.descricao || 'este item';
  openModal(
    'Excluir item',
    `<p>Deseja excluir <strong>${esc(nome)}</strong>? Esta ação não pode ser desfeita.</p>`,
    async () => {
      try {
        await deleteDoc(doc(db, colecao, id));
        showToast('Item excluído.', 'success');
      } catch { showToast('Erro ao excluir.', 'error'); }
    },
    'Excluir'
  );
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
