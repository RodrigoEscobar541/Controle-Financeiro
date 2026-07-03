/**
 * Carro
 *
 * Estrutura Firestore:
 *   carro_afazer         { prioridade, descricao, valor }
 *   carro_feitos         { data: "YYYY-MM-DD", descricao, valor }
 *   carro_manutencao     { descricao, data: "YYYY-MM-DD", kmUltimaTroca, kmProximaTroca, valor }
 *   carro_abastecimento  { data: "YYYY-MM-DD", km, correcao, litros, valorPago, tipoCombustivel }
 */

import { db } from './firebase-config.js';
import { fmtBRL, fmtDate, showToast, openModal } from './app.js';
import { subscribeTiposCombustivel, adicionarTipoCombustivel, abrirModalGerenciarTipos } from './combustivel-tipos.js';
import {
  collection, query, orderBy, where, onSnapshot,
  addDoc, deleteDoc, updateDoc, doc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let afazer               = [];
let feitos               = [];
let manutencao           = [];
let abastecimento        = [];
let tiposCombustivel     = [];
let unsubs               = [];
let feitosVisiveis       = 5;
let abastecimentoVisiveis = 1;
let mostrarAntigos       = false;

const LS_VALOR_PAGO = 'tf_valorPago_carro';

function corteUmAno() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function initCarro() {
  document.getElementById('btn-add-afazer').addEventListener('click',     () => abrirModalAfazer());
  document.getElementById('btn-add-feito').addEventListener('click',      () => abrirModalFeito());
  document.getElementById('btn-add-manutencao').addEventListener('click', () => abrirModalManutencao());
  document.getElementById('btn-add-abastecimento').addEventListener('click', () => abrirModalAbastecimento());
  document.getElementById('btn-tipos-combustivel').addEventListener('click', () => abrirModalGerenciarTipos(tiposCombustivel));
  subscribeTiposCombustivel(lista => { tiposCombustivel = lista; });
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

  const feitosConstraints = [];
  if (!mostrarAntigos) feitosConstraints.push(where('data', '>=', corteUmAno()));
  feitosConstraints.push(orderBy('data', 'desc'));

  unsubs.push(onSnapshot(
    query(collection(db, 'carro_feitos'), ...feitosConstraints),
    snap => { feitos = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderFeitos(); },
    () => showToast('Erro ao carregar Feitos.', 'error')
  ));

  unsubs.push(onSnapshot(
    collection(db, 'carro_manutencao'),
    snap => { manutencao = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderManutencao(); },
    () => showToast('Erro ao carregar Manutenção.', 'error')
  ));

  unsubs.push(onSnapshot(
    query(collection(db, 'carro_abastecimento'), orderBy('data', 'desc')),
    snap => { abastecimento = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderAbastecimento(); },
    () => showToast('Erro ao carregar Abastecimento.', 'error')
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
  } else if (!mostrarAntigos) {
    tbody.innerHTML += `<tr>
      <td colspan="4" style="text-align:center;padding:.6rem 0">
        <button class="btn-secondary btn-carro-antigos" style="font-size:.8rem">Carregar histórico completo</button>
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

  const btnAntigos = tbody.querySelector('.btn-carro-antigos');
  if (btnAntigos) {
    btnAntigos.addEventListener('click', () => {
      mostrarAntigos = true;
      feitosVisiveis = 5;
      subscribeAll();
    });
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

// ── ABASTECIMENTO ─────────────────────────────────────────────────────────────

function kmEfetivo(item) {
  const correcao = parseFloat(item.correcao) || 0;
  return (parseFloat(item.km) || 0) * (1 - correcao / 100);
}

function renderAbastecimento() {
  const tbody = document.querySelector('#carro-abastecimento-table tbody');

  if (abastecimento.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Nenhum abastecimento registrado.</td></tr>`;
    return;
  }

  const visiveis = abastecimento.slice(0, abastecimentoVisiveis);

  tbody.innerHTML = visiveis.map(item => {
    const km       = kmEfetivo(item);
    const litros   = parseFloat(item.litros) || 0;
    const kmL      = litros > 0 ? (km / litros).toFixed(2) : null;
    const rsKm     = (item.valorPago && km > 0) ? (parseFloat(item.valorPago) / km).toFixed(2) : null;
    const correcao = parseFloat(item.correcao) || 0;
    const kmLabel  = correcao > 0
      ? `${esc(item.km)} km (−${correcao}%)`
      : `${esc(item.km)} km`;

    return `<tr>
      <td>${fmtDate(item.data)}</td>
      <td>${kmLabel}</td>
      <td>${esc(item.litros)} L</td>
      <td>${esc(item.tipoCombustivel)}</td>
      <td class="text-right">${item.valorPago ? fmtBRL(item.valorPago) : '—'}</td>
      <td class="text-right">${kmL ?? '—'}</td>
      <td class="text-right">${rsKm ? fmtBRL(rsKm) : '—'}</td>
      <td style="text-align:center;white-space:nowrap">
        <button class="btn-icon" data-action="edit"   data-id="${item.id}" title="Editar">✏️</button>
        <button class="btn-icon" data-action="delete" data-id="${item.id}" title="Excluir">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  if (abastecimento.length > abastecimentoVisiveis) {
    const restantes = abastecimento.length - abastecimentoVisiveis;
    tbody.innerHTML += `<tr>
      <td colspan="8" style="text-align:center;padding:.6rem 0">
        <button id="btn-abastecimento-mais" class="btn-secondary">Carregar mais (${restantes})</button>
      </td>
    </tr>`;
  }

  tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = abastecimento.find(a => a.id === btn.dataset.id);
      if (item) abrirModalAbastecimento(item);
    });
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => excluirItem('carro_abastecimento', btn.dataset.id, abastecimento));
  });

  const btnMais = document.getElementById('btn-abastecimento-mais');
  if (btnMais) {
    btnMais.addEventListener('click', () => { abastecimentoVisiveis += 5; renderAbastecimento(); });
  }
}

function abrirModalAbastecimento(item) {
  const editar        = !!item;
  const hoje          = new Date().toISOString().split('T')[0];
  const valorPagoInit = editar ? (item.valorPago ?? '') : (localStorage.getItem(LS_VALOR_PAGO) ?? '');

  const opcoesTipo = tiposCombustivel.map(t =>
    `<option value="${esc(t.nome)}" ${editar && item.tipoCombustivel === t.nome ? 'selected' : ''}>${esc(t.nome)}</option>`
  ).join('');

  openModal(
    editar ? 'Editar Abastecimento' : 'Registrar Abastecimento',
    `<div class="form-group">
       <label>Data</label>
       <input type="date" id="ab-data" value="${editar ? item.data : hoje}">
     </div>
     <div class="form-group">
       <label>KM rodado no tanque</label>
       <input type="number" id="ab-km" value="${editar ? item.km : ''}" step="0.1" min="0" placeholder="Ex: 350">
     </div>
     <div class="form-group">
       <label>Correção (%)</label>
       <input type="number" id="ab-correcao" value="${editar ? (item.correcao ?? 0) : 0}" step="1" min="0" max="100" placeholder="0">
       <small>% a descontar do km informado (ex: painel/GPS superestimado)</small>
     </div>
     <div class="form-group">
       <label>Litros abastecidos</label>
       <input type="number" id="ab-litros" value="${editar ? item.litros : ''}" step="0.01" min="0" placeholder="Ex: 30">
     </div>
     <div class="form-group">
       <label>Tipo de combustível</label>
       <select id="ab-tipo">
         ${opcoesTipo}
         <option value="__novo__">+ Novo tipo...</option>
       </select>
     </div>
     <div class="form-group" id="ab-tipo-novo-wrap" style="display:none">
       <label>Nome do novo tipo</label>
       <input type="text" id="ab-tipo-novo" placeholder="Ex: GNV">
     </div>
     <div class="form-group">
       <label>Valor pago (R$) — opcional</label>
       <input type="number" id="ab-valor" value="${valorPagoInit}" step="0.01" min="0" placeholder="0,00">
     </div>`,
    async () => {
      const data     = document.getElementById('ab-data').value;
      const km       = parseFloat(document.getElementById('ab-km').value);
      const correcao = parseFloat(document.getElementById('ab-correcao').value) || 0;
      const litros   = parseFloat(document.getElementById('ab-litros').value);
      const valorStr = document.getElementById('ab-valor').value;
      const valorPago = valorStr === '' ? null : parseFloat(valorStr);
      let tipoCombustivel = document.getElementById('ab-tipo').value;

      if (!data || isNaN(km) || km < 0 || isNaN(litros) || litros <= 0) {
        showToast('Preencha data, km e litros corretamente.', 'error'); return;
      }

      if (tipoCombustivel === '__novo__') {
        const novoNome = document.getElementById('ab-tipo-novo').value.trim();
        if (!novoNome) { showToast('Informe o nome do novo tipo.', 'error'); return; }
        try {
          await adicionarTipoCombustivel(novoNome);
          tipoCombustivel = novoNome;
        } catch { showToast('Erro ao criar tipo de combustível.', 'error'); return; }
      }

      const payload = { data, km, correcao, litros, valorPago, tipoCombustivel };
      try {
        if (editar) {
          await updateDoc(doc(db, 'carro_abastecimento', item.id), payload);
          showToast('Abastecimento atualizado!', 'success');
        } else {
          await addDoc(collection(db, 'carro_abastecimento'), payload);
          showToast('Abastecimento registrado!', 'success');
        }
        if (valorPago !== null) localStorage.setItem(LS_VALOR_PAGO, String(valorPago));
      } catch { showToast('Erro ao salvar.', 'error'); }
    },
    editar ? 'Salvar' : 'Registrar'
  );

  const selectTipo = document.getElementById('ab-tipo');
  const novoWrap   = document.getElementById('ab-tipo-novo-wrap');
  selectTipo.addEventListener('change', () => {
    novoWrap.style.display = selectTipo.value === '__novo__' ? '' : 'none';
  });
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
