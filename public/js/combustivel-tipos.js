/**
 * Combustível — Tipos
 *
 * Estrutura Firestore (coleção compartilhada entre Focus e Face):
 *   combustivel_tipos { nome }
 */

import { db } from './firebase-config.js';
import { showToast, openModal } from './app.js';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, deleteDoc, doc, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const DEFAULTS = ['Gasolina', 'Etanol', 'Diesel'];
let seeded = false;

async function seedDefaults() {
  if (seeded) return;
  seeded = true;
  const snap = await getDocs(collection(db, 'combustivel_tipos'));
  if (snap.empty) {
    for (const nome of DEFAULTS) {
      await addDoc(collection(db, 'combustivel_tipos'), { nome });
    }
  }
}

export function subscribeTiposCombustivel(callback) {
  seedDefaults();
  return onSnapshot(
    query(collection(db, 'combustivel_tipos'), orderBy('nome', 'asc')),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    () => showToast('Erro ao carregar tipos de combustível.', 'error')
  );
}

export async function adicionarTipoCombustivel(nome) {
  const ref = await addDoc(collection(db, 'combustivel_tipos'), { nome });
  return ref.id;
}

export async function excluirTipoCombustivel(id) {
  return deleteDoc(doc(db, 'combustivel_tipos', id));
}

export function abrirModalGerenciarTipos(tipos) {
  openModal(
    'Gerenciar tipos de combustível',
    `<div id="tipos-lista">
       ${tipos.map(t => `
         <div class="form-group" style="display:flex;align-items:center;gap:.5rem" data-tipo-id="${t.id}">
           <span style="flex:1">${esc(t.nome)}</span>
           <button type="button" class="btn-icon" data-action="del-tipo" data-id="${t.id}" title="Excluir">🗑️</button>
         </div>`).join('') || '<p class="empty-state">Nenhum tipo cadastrado.</p>'}
     </div>
     <div class="form-group">
       <label>Novo tipo</label>
       <input type="text" id="novo-tipo-nome" placeholder="Ex: GNV">
     </div>`,
    async () => {
      const nome = document.getElementById('novo-tipo-nome').value.trim();
      if (!nome) return;
      try {
        await adicionarTipoCombustivel(nome);
        showToast('Tipo adicionado!', 'success');
      } catch { showToast('Erro ao salvar.', 'error'); }
    },
    'Adicionar'
  );

  document.querySelectorAll('[data-action="del-tipo"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await excluirTipoCombustivel(btn.dataset.id);
        btn.closest('[data-tipo-id]')?.remove();
      } catch { showToast('Erro ao excluir.', 'error'); }
    });
  });
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
