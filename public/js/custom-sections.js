/**
 * Renderização genérica das sections customizadas ("+ Nova Section").
 *
 * Cada template (banco, distribuicao, patrimonio, carro, devo-devem) replica o
 * comportamento da section original correspondente (ver banco.js, distribuicao.js,
 * patrimonio.js, carro.js, devo-devem.js), mas lendo/escrevendo nas coleções
 * definidas em `secao.colecoes` (geradas a partir do slug escolhido pelo usuário)
 * em vez das coleções fixas do app.
 *
 * Todo o markup é injetado dentro do <section> criado dinamicamente pelo app.js
 * (ver montarSecaoCustomizada) e todo o estado de cada bloco vive no escopo da
 * própria função — isso permite que várias sections do mesmo template (ex: dois
 * "Carro") coexistam sem colidir.
 */

import { db } from './firebase-config.js';
import { fmtBRL, fmtDate, mesAtualId, mesAtualLabel, idToLabel, showToast, openModal } from './app.js';
import { initNotas } from './notas.js';
import { subscribeTiposCombustivel, adicionarTipoCombustivel, abrirModalGerenciarTipos } from './combustivel-tipos.js';
import {
  collection, query, orderBy, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, setDoc, deleteField
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ──────────────────────────────────────────────
// DISPATCHER
// ──────────────────────────────────────────────
export function montarSecaoCustomizada(container, secao) {
  switch (secao.template) {
    case 'banco':        return montarBanco(container, secao);
    case 'distribuicao': return montarDistribuicao(container, secao);
    case 'patrimonio':   return montarPatrimonio(container, secao);
    case 'carro':        return montarCarro(container, secao);
    case 'devo-devem':   return montarDevoDevem(container, secao);
    default:
      container.innerHTML = `<p class="empty-state">Template "${esc(secao.template)}" desconhecido.</p>`;
  }
}

// ──────────────────────────────────────────────
// MÉTRICA PARA O CARD DO DASHBOARD
// ──────────────────────────────────────────────
export async function metricaSecao(secao) {
  switch (secao.template) {
    case 'banco': {
      const snap = await getDocs(collection(db, secao.colecoes.principal));
      let entradas = 0, saidas = 0;
      snap.docs.forEach(d => {
        const v = d.data();
        const val = parseFloat(v.valor) || 0;
        if (v.tipo === 'Entrada') entradas += val; else if (v.tipo === 'Saida') saidas += val;
      });
      return {
        principal: { label: 'Saldo', valor: fmtBRL(entradas - saidas) },
        sub: `${snap.size} lançamento(s)`
      };
    }
    case 'patrimonio': {
      const snap = await getDocs(collection(db, secao.colecoes.principal));
      const total = snap.docs.reduce((s, d) => s + (parseFloat(d.data().valor) || 0), 0);
      return {
        principal: { label: 'Total investido', valor: fmtBRL(total) },
        sub: `${snap.size} ativo(s)`
      };
    }
    case 'distribuicao': {
      const snap = await getDoc(doc(db, secao.colecoes.mensal, mesAtualId()));
      const total = snap.exists()
        ? Object.values(snap.data().colunas || {}).reduce((s, c) => s + (parseFloat(c.valor) || 0), 0)
        : 0;
      return {
        principal: { label: `Total ${mesAtualLabel()}`, valor: fmtBRL(total) },
        sub: snap.exists() ? 'Mês cadastrado' : 'Mês ainda não cadastrado'
      };
    }
    case 'carro': {
      const [feitosSnap, afazerSnap] = await Promise.all([
        getDocs(collection(db, secao.colecoes.feitos)),
        getDocs(collection(db, secao.colecoes.afazer))
      ]);
      const totalGasto = feitosSnap.docs.reduce((s, d) => s + (parseFloat(d.data().valor) || 0), 0);
      return {
        principal:   { label: 'Total gasto (Feitos)', valor: fmtBRL(totalGasto) },
        secundaria:  { label: 'Pendências (A Fazer)', valor: String(afazerSnap.size) }
      };
    }
    case 'devo-devem': {
      const snap = await getDocs(query(collection(db, secao.colecoes.principal), where('status', '==', 'Aberta')));
      let totalDevo = 0, totalDevem = 0;
      snap.docs.forEach(d => {
        const v = d.data();
        const val = parseFloat(v.valor) || 0;
        if (v.tipo === 'Devo') totalDevo += val; else if (v.tipo === 'Devem') totalDevem += val;
      });
      return {
        principal:  { label: 'Devo (aberto)',  valor: fmtBRL(totalDevo) },
        secundaria: { label: 'Devem (aberto)', valor: fmtBRL(totalDevem) }
      };
    }
    default:
      return { principal: { label: secao.nome, valor: '—' } };
  }
}

// ──────────────────────────────────────────────
// HELPERS COMPARTILHADOS
// ──────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function notasHTML(secao) {
  return `
    <div class="notas-card">
      <div class="notas-header">
        <span class="notas-icon">📝</span>
        <span class="notas-title">Anotações</span>
        <span class="notas-status" id="notas-status-custom-${secao.slug}"></span>
      </div>
      <textarea class="notas-textarea" id="notas-custom-${secao.slug}" placeholder="Deixe recados sobre ${esc(secao.nome)}…"></textarea>
    </div>`;
}

function confirmarExclusaoSimples(colecao, id, lista, campoNome = 'descricao') {
  const item = lista.find(i => i.id === id);
  openModal(
    'Excluir item',
    `<p>Deseja excluir <strong>${esc(item?.[campoNome] || 'este item')}</strong>? Esta ação não pode ser desfeita.</p>`,
    async () => {
      try { await deleteDoc(doc(db, colecao, id)); showToast('Item excluído.', 'success'); }
      catch { showToast('Erro ao excluir.', 'error'); }
    },
    'Excluir'
  );
}

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

function mesIdToLabel(id) {
  const [y, m] = id.split('-');
  return `${m}-${y}`;
}

// ──────────────────────────────────────────────
// TEMPLATE: BANCO
// ──────────────────────────────────────────────
function montarBanco(container, secao) {
  const colecao = secao.colecoes.principal;

  container.innerHTML = `
    <div class="card">
      <div class="card-header"><h3 class="card-title">${secao.icone || '💳'} ${esc(secao.nome)} — Registrar Lançamento</h3></div>
      <form class="form-inline" data-role="form">
        <div class="radio-group-inline">
          <label class="radio-label entrada-label"><input type="radio" name="tipo" value="Entrada" checked><span>Entrada</span></label>
          <label class="radio-label saida-label"><input type="radio" name="tipo" value="Saida"><span>Saída</span></label>
        </div>
        <div class="form-group"><input type="text" data-role="descricao" placeholder="Descrição" required></div>
        <div class="form-group"><input type="number" data-role="valor" placeholder="Valor R$" step="0.01" min="0.01" required></div>
        <button type="submit" class="btn btn-primary">Registrar</button>
      </form>
    </div>
    <div class="tables-2col">
      <div class="card">
        <div class="card-header"><h3 class="card-title text-success">Entradas</h3></div>
        <table class="data-table">
          <thead><tr><th>Data</th><th>Descrição</th><th class="text-right">Valor</th><th></th></tr></thead>
          <tbody data-role="tbody-entradas"><tr><td colspan="4" class="loading">Carregando...</td></tr></tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-header"><h3 class="card-title text-danger">Saídas</h3></div>
        <table class="data-table">
          <thead><tr><th>Data</th><th>Descrição</th><th class="text-right">Valor</th><th></th></tr></thead>
          <tbody data-role="tbody-saidas"><tr><td colspan="4" class="loading">Carregando...</td></tr></tbody>
        </table>
      </div>
    </div>
    ${notasHTML(secao)}
  `;

  const q = role => container.querySelector(`[data-role="${role}"]`);
  let transacoes = [];

  q('form').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const tipo      = form.querySelector('input[name="tipo"]:checked').value;
    const descricao = q('descricao').value.trim();
    const valor     = parseFloat(q('valor').value);

    if (!descricao || isNaN(valor) || valor <= 0) { showToast('Preencha todos os campos corretamente.', 'error'); return; }

    const hoje = new Date();
    const data = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    try {
      await addDoc(collection(db, colecao), { data, tipo, valor, descricao });
      showToast(`${tipo} registrada com sucesso!`, 'success');
      form.reset();
    } catch { showToast('Erro ao registrar. Tente novamente.', 'error'); }
  });

  onSnapshot(query(collection(db, colecao), orderBy('data', 'desc')), snap => {
    transacoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTabela(transacoes.filter(r => r.tipo === 'Entrada'), 'tbody-entradas', 'success');
    renderTabela(transacoes.filter(r => r.tipo === 'Saida'),   'tbody-saidas',   'danger');
  }, () => showToast('Erro ao escutar transações.', 'error'));

  function renderTabela(docs, role, colorClass) {
    const tbody = q(role);
    if (docs.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Nenhum registro</td></tr>`; return; }
    tbody.innerHTML = docs.map(d => `
      <tr>
        <td>${fmtDate(d.data)}</td>
        <td>${esc(d.descricao)}</td>
        <td class="text-right text-${colorClass}">${fmtBRL(d.valor)}</td>
        <td style="text-align:center"><button class="btn-icon" data-id="${d.id}" title="Excluir">🗑️</button></td>
      </tr>
    `).join('');
    tbody.querySelectorAll('.btn-icon').forEach(btn => {
      btn.addEventListener('click', () => confirmarExclusaoSimples(colecao, btn.dataset.id, transacoes));
    });
  }

  initNotas(`custom-${secao.slug}`);
}

// ──────────────────────────────────────────────
// TEMPLATE: PATRIMÔNIO
// ──────────────────────────────────────────────
function montarPatrimonio(container, secao) {
  const colecao = secao.colecoes.principal;

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">${secao.icone || '💎'} ${esc(secao.nome)}</h3>
        <button class="btn btn-primary" data-role="btn-novo">+ Novo Ativo</button>
      </div>
      <table class="data-table">
        <thead><tr><th>Ativo</th><th>Plataforma</th><th class="text-right">Valor (R$)</th><th></th></tr></thead>
        <tbody data-role="tbody"><tr><td colspan="4" class="loading">Carregando...</td></tr></tbody>
        <tfoot><tr><td colspan="2"><strong>Total</strong></td><td class="text-right"><strong data-role="total">R$ 0,00</strong></td><td></td></tr></tfoot>
      </table>
    </div>
    ${notasHTML(secao)}
  `;

  const q = role => container.querySelector(`[data-role="${role}"]`);
  let ativos = [];

  function formHtml(a = {}) {
    return `
      <div class="form-group"><label>Nome do Ativo</label><input type="text" id="cx-ativo-nome" value="${esc(a.nomeDoAtivo || '')}" placeholder="Ex: BTC, Tesouro Selic"></div>
      <div class="form-group"><label>Plataforma</label><input type="text" id="cx-ativo-plataforma" value="${esc(a.plataforma || '')}" placeholder="Ex: Mercado Bitcoin, XP"></div>
      <div class="form-group"><label>Valor (R$)</label><input type="number" id="cx-ativo-valor" value="${a.valor || ''}" step="0.01" min="0" placeholder="0,00"></div>`;
  }

  q('btn-novo').addEventListener('click', () => {
    openModal('Novo Ativo', formHtml(), async () => {
      const nome       = document.getElementById('cx-ativo-nome').value.trim();
      const plataforma = document.getElementById('cx-ativo-plataforma').value.trim();
      const valor      = parseFloat(document.getElementById('cx-ativo-valor').value);
      if (!nome || !plataforma || isNaN(valor) || valor < 0) { showToast('Preencha todos os campos.', 'error'); return; }
      try { await addDoc(collection(db, colecao), { nomeDoAtivo: nome, plataforma, valor }); showToast('Ativo adicionado!', 'success'); }
      catch { showToast('Erro ao adicionar ativo.', 'error'); }
    }, 'Adicionar');
  });

  onSnapshot(collection(db, colecao), snap => {
    ativos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  }, () => showToast('Erro ao carregar patrimônio.', 'error'));

  function render() {
    const tbody = q('tbody');
    const totalEl = q('total');
    if (ativos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Nenhum ativo cadastrado. Clique em "+ Novo Ativo".</td></tr>`;
      totalEl.textContent = 'R$ 0,00';
      return;
    }
    let total = 0;
    tbody.innerHTML = ativos.map(a => {
      total += parseFloat(a.valor) || 0;
      return `<tr>
        <td><strong>${esc(a.nomeDoAtivo)}</strong></td>
        <td>${esc(a.plataforma)}</td>
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
        if (!ativo) return;
        openModal(`Editar — ${esc(ativo.nomeDoAtivo)}`, formHtml(ativo), async () => {
          const nome       = document.getElementById('cx-ativo-nome').value.trim();
          const plataforma = document.getElementById('cx-ativo-plataforma').value.trim();
          const valor      = parseFloat(document.getElementById('cx-ativo-valor').value);
          if (!nome || !plataforma || isNaN(valor) || valor < 0) { showToast('Preencha todos os campos.', 'error'); return; }
          try { await updateDoc(doc(db, colecao, ativo.id), { nomeDoAtivo: nome, plataforma, valor }); showToast('Ativo atualizado!', 'success'); }
          catch { showToast('Erro ao atualizar.', 'error'); }
        }, 'Salvar');
      });
    });
    tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => confirmarExclusaoSimples(colecao, btn.dataset.id, ativos, 'nomeDoAtivo'));
    });
  }

  initNotas(`custom-${secao.slug}`);
}

// ──────────────────────────────────────────────
// TEMPLATE: DISTRIBUIÇÃO (tabela mensal, colunas dinâmicas)
// ──────────────────────────────────────────────
function montarDistribuicao(container, secao) {
  const colMensal = secao.colecoes.mensal;
  const colConfig = secao.colecoes.colunasConfig; // doc id dentro de "config"

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">${secao.icone || '📅'} ${esc(secao.nome)}</h3>
        <div class="card-actions">
          <div class="period-filter">
            <span class="period-filter-label">Período</span>
            <input type="month" data-role="filtro-inicio" class="month-picker">
            <span class="period-arrow">→</span>
            <input type="month" data-role="filtro-fim" class="month-picker">
          </div>
          <button data-role="btn-add-mes" class="btn btn-secondary">+ Mês</button>
          <button data-role="btn-add-col" class="btn btn-primary">+ Nova Coluna</button>
        </div>
      </div>
      <p class="table-hint">Clique numa célula para <strong>editar o valor</strong>. Segure por 1 segundo para marcar/desmarcar como <strong>Pago</strong> (verde).</p>
      <div class="table-wrapper">
        <table class="data-table spreadsheet">
          <thead data-role="thead"><tr><th>Mês</th><th>Total</th></tr></thead>
          <tbody data-role="tbody"><tr><td colspan="10" class="loading">Carregando...</td></tr></tbody>
        </table>
      </div>
    </div>
    ${notasHTML(secao)}
  `;

  const q = role => container.querySelector(`[data-role="${role}"]`);

  let colunas = [];
  let meses   = {};
  let filtroInicio = '', filtroFim = '';
  let unsubMeses = null;

  (function calcDefaultFiltro() {
    const now = new Date();
    const inicio = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    filtroInicio = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}`;
    const fim = new Date(now.getFullYear(), now.getMonth() + 12, 1);
    filtroFim = `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, '0')}`;
  })();

  q('filtro-inicio').value = filtroInicio;
  q('filtro-fim').value    = filtroFim;
  q('filtro-inicio').addEventListener('change', () => { filtroInicio = q('filtro-inicio').value; renderTabela(); });
  q('filtro-fim').addEventListener('change',    () => { filtroFim    = q('filtro-fim').value;    renderTabela(); });
  q('btn-add-col').addEventListener('click', adicionarColuna);
  q('btn-add-mes').addEventListener('click', adicionarMes);

  onSnapshot(doc(db, 'config', colConfig), snap => {
    colunas = snap.exists() ? (snap.data().colunas || []) : [];
    subscribeMeses();
  });

  function subscribeMeses() {
    if (unsubMeses) unsubMeses();
    unsubMeses = onSnapshot(collection(db, colMensal), snap => {
      meses = {};
      snap.docs.forEach(d => { meses[d.id] = d.data(); });
      renderTabela();
    });
  }

  function renderTabela() {
    const thead = q('thead');
    const tbody = q('tbody');

    const thCols = colunas.map(col => `
      <th draggable="true" data-col="${esc(col)}">
        <span class="col-name">${esc(col)}</span>
        <span class="delete-col-btn" data-col="${esc(col)}" title="Remover coluna" draggable="false">✕</span>
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
          <div class="cell-data ${pago ? 'pago' : ''}" data-mes="${mesId}" data-col="${esc(col)}"
               title="Clique: editar valor | Segure 1s: marcar Pago">
            ${valor !== 0 ? fmtBRL(valor) : ''}
          </div>
        </td>`;
      }).join('');
      return `<tr><td><strong>${idToLabel(mesId)}</strong></td>${tds}<td class="col-total">${fmtBRL(total)}</td></tr>`;
    }).join('');

    tbody.querySelectorAll('.cell-data').forEach(cell => {
      let pressTimer = null, longPressTriggered = false;
      const startPress = () => {
        longPressTriggered = false;
        pressTimer = setTimeout(() => {
          longPressTriggered = true;
          cell.classList.add('cell-pressing');
          toggleStatus(cell.dataset.mes, cell.dataset.col);
        }, 1000);
      };
      const cancelPress = () => { clearTimeout(pressTimer); cell.classList.remove('cell-pressing'); };
      cell.addEventListener('mousedown', startPress);
      cell.addEventListener('mouseup', cancelPress);
      cell.addEventListener('mouseleave', cancelPress);
      cell.addEventListener('touchstart', startPress, { passive: true });
      cell.addEventListener('touchend', cancelPress);
      cell.addEventListener('touchmove', cancelPress, { passive: true });
      cell.addEventListener('click', () => {
        if (longPressTriggered) { longPressTriggered = false; return; }
        editarValor(cell.dataset.mes, cell.dataset.col);
      });
    });
  }

  function setupColDrag(thead) {
    const ths = [...thead.querySelectorAll('th[draggable]')];
    let dragIdx = null;
    ths.forEach((th, idx) => {
      th.addEventListener('dragstart', e => { dragIdx = idx; th.classList.add('col-dragging'); e.dataTransfer.effectAllowed = 'move'; });
      th.addEventListener('dragend', () => { th.classList.remove('col-dragging'); ths.forEach(t => t.classList.remove('col-drag-over')); dragIdx = null; });
      th.addEventListener('dragover', e => {
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        ths.forEach(t => t.classList.remove('col-drag-over'));
        th.classList.add('col-drag-over');
      });
      th.addEventListener('dragleave', () => th.classList.remove('col-drag-over'));
      th.addEventListener('drop', async e => {
        e.preventDefault(); th.classList.remove('col-drag-over');
        if (dragIdx === null || dragIdx === idx) return;
        const nova = [...colunas];
        const [moved] = nova.splice(dragIdx, 1);
        nova.splice(idx, 0, moved);
        try { await setDoc(doc(db, 'config', colConfig), { colunas: nova }); }
        catch { showToast('Erro ao reordenar colunas.', 'error'); }
      });
    });
  }

  async function toggleStatus(mesId, colName) {
    const cols  = meses[mesId]?.colunas || {};
    const atual = cols[colName]?.status || 'naoPago';
    const novo  = atual === 'Pago' ? 'naoPago' : 'Pago';
    const valor = cols[colName]?.valor || 0;
    try {
      await setDoc(doc(db, colMensal, mesId), {
        dataMes: mesIdToLabel(mesId),
        colunas: { ...cols, [colName]: { valor, status: novo } }
      }, { merge: true });
    } catch { showToast('Erro ao atualizar status.', 'error'); }
  }

  function editarValor(mesId, colName) {
    const cols  = meses[mesId]?.colunas || {};
    const atual = cols[colName]?.valor || 0;
    openModal(
      `Editar valor — ${esc(colName)} (${idToLabel(mesId)})`,
      `<div class="form-group"><label>Valor (R$)</label><input type="number" id="cx-dist-valor" value="${atual}" step="0.01" min="0" class="form-control"></div>`,
      async () => {
        const novo = parseFloat(document.getElementById('cx-dist-valor').value);
        if (isNaN(novo) || novo < 0) { showToast('Valor inválido.', 'error'); return; }
        const status = cols[colName]?.status || 'naoPago';
        try {
          await setDoc(doc(db, colMensal, mesId), {
            dataMes: mesIdToLabel(mesId),
            colunas: { ...cols, [colName]: { valor: novo, status } }
          }, { merge: true });
          showToast('Valor atualizado!', 'success');
        } catch { showToast('Erro ao atualizar.', 'error'); }
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
      await setDoc(doc(db, colMensal, mesId), { dataMes: mesIdToLabel(mesId), colunas: colunasPadrao });
      if (mesId > filtroFim) { filtroFim = mesId; q('filtro-fim').value = filtroFim; }
      showToast(`${idToLabel(mesId)} adicionado!`, 'success');
    } catch { showToast('Erro ao adicionar mês.', 'error'); }
  }

  function adicionarColuna() {
    openModal(
      'Nova Coluna',
      `<div class="form-group"><label>Nome da coluna</label><input type="text" id="cx-dist-col" placeholder="Ex: Netflix, Spotify..." maxlength="40"></div>`,
      async () => {
        const nome = document.getElementById('cx-dist-col').value.trim();
        if (!nome) { showToast('Nome inválido.', 'error'); return; }
        if (colunas.includes(nome)) { showToast('Esta coluna já existe.', 'error'); return; }

        const novasColunas = [...colunas, nome];
        try {
          await setDoc(doc(db, 'config', colConfig), { colunas: novasColunas });
          for (const mesId of Object.keys(meses)) {
            const cols = meses[mesId]?.colunas || {};
            if (!cols[nome]) {
              await setDoc(doc(db, colMensal, mesId), { colunas: { ...cols, [nome]: { valor: 0, status: 'naoPago' } } }, { merge: true });
            }
          }
          showToast(`Coluna "${nome}" adicionada!`, 'success');
        } catch { showToast('Erro ao adicionar coluna.', 'error'); }
      },
      'Adicionar'
    );
  }

  function removerColuna(nome) {
    openModal(
      `Remover coluna "${esc(nome)}"`,
      `<p>Isso removerá a coluna <strong>${esc(nome)}</strong> de todos os meses. Os valores serão perdidos.</p>`,
      async () => {
        try {
          await setDoc(doc(db, 'config', colConfig), { colunas: colunas.filter(c => c !== nome) });
          for (const mesId of Object.keys(meses)) {
            await updateDoc(doc(db, colMensal, mesId), { [`colunas.${nome}`]: deleteField() });
          }
          showToast(`Coluna "${nome}" removida.`, 'success');
        } catch { showToast('Erro ao remover coluna.', 'error'); }
      },
      'Remover'
    );
  }

  initNotas(`custom-${secao.slug}`);
}

// ──────────────────────────────────────────────
// TEMPLATE: NOVO CARRO (A Fazer / Feitos / Abastecimento / Manutenção)
// ──────────────────────────────────────────────
function montarCarro(container, secao) {
  const { afazer: colAfazer, feitos: colFeitos, manutencao: colManutencao, abastecimento: colAbastecimento } = secao.colecoes;

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">🔧 A Fazer — ${esc(secao.nome)}</h3>
        <button class="btn btn-primary" data-role="btn-add-afazer">+ Novo Item</button>
      </div>
      <table class="data-table">
        <thead><tr><th style="width:80px;text-align:center">Prioridade</th><th>Descrição</th><th class="text-right">Valor estimado</th><th style="width:90px"></th></tr></thead>
        <tbody data-role="tbody-afazer"><tr><td colspan="4" class="loading">Carregando...</td></tr></tbody>
        <tfoot><tr><td colspan="2"><strong>Total estimado</strong></td><td class="text-right"><strong data-role="total-afazer">R$ 0,00</strong></td><td></td></tr></tfoot>
      </table>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">✅ Feitos</h3>
        <button class="btn btn-primary" data-role="btn-add-feito">+ Registrar</button>
      </div>
      <table class="data-table">
        <thead><tr><th>Data</th><th>Descrição</th><th class="text-right">Valor</th><th style="width:60px"></th></tr></thead>
        <tbody data-role="tbody-feitos"><tr><td colspan="4" class="loading">Carregando...</td></tr></tbody>
        <tfoot><tr><td colspan="2"><strong>Total gasto</strong></td><td class="text-right"><strong data-role="total-feitos">R$ 0,00</strong></td><td></td></tr></tfoot>
      </table>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">⛽ Abastecimento</h3>
        <div style="display:flex;gap:.5rem">
          <button class="btn-secondary" data-role="btn-tipos" title="Gerenciar tipos de combustível">⚙️ Tipos</button>
          <button class="btn btn-primary" data-role="btn-add-abastecimento">+ Registrar</button>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>Data</th><th>KM</th><th>Litros</th><th>Combustível</th><th class="text-right">Valor/L</th><th class="text-right">km/L</th><th class="text-right">R$/km</th><th style="width:60px"></th></tr></thead>
          <tbody data-role="tbody-abastecimento"><tr><td colspan="8" class="loading">Carregando...</td></tr></tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">📅 Manutenção Preventiva</h3>
        <button class="btn btn-primary" data-role="btn-add-manutencao">+ Adicionar</button>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>Descrição</th><th>Última troca</th><th>KM última</th><th>KM próxima</th><th class="text-right">Valor Estimado</th><th style="width:90px"></th></tr></thead>
          <tbody data-role="tbody-manutencao"><tr><td colspan="6" class="loading">Carregando...</td></tr></tbody>
        </table>
      </div>
    </div>
    ${notasHTML(secao)}
  `;

  const q = role => container.querySelector(`[data-role="${role}"]`);

  let afazer = [], feitos = [], manutencao = [], abastecimento = [], tiposCombustivel = [];
  let feitosVisiveis = 5, abastecimentoVisiveis = 1;
  const LS_VALOR_PAGO = `tf_valorPago_custom_${secao.slug}`;

  q('btn-add-afazer').addEventListener('click',        () => abrirModalAfazer());
  q('btn-add-feito').addEventListener('click',         () => abrirModalFeito());
  q('btn-add-manutencao').addEventListener('click',    () => abrirModalManutencao());
  q('btn-add-abastecimento').addEventListener('click', () => abrirModalAbastecimento());
  q('btn-tipos').addEventListener('click',              () => abrirModalGerenciarTipos(tiposCombustivel));

  subscribeTiposCombustivel(lista => { tiposCombustivel = lista; });

  onSnapshot(query(collection(db, colAfazer), orderBy('prioridade', 'asc')), snap => {
    afazer = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderAfazer();
  }, () => showToast('Erro ao carregar A Fazer.', 'error'));

  onSnapshot(query(collection(db, colFeitos), orderBy('data', 'desc')), snap => {
    feitos = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderFeitos();
  }, () => showToast('Erro ao carregar Feitos.', 'error'));

  onSnapshot(collection(db, colManutencao), snap => {
    manutencao = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderManutencao();
  }, () => showToast('Erro ao carregar Manutenção.', 'error'));

  onSnapshot(query(collection(db, colAbastecimento), orderBy('data', 'desc')), snap => {
    abastecimento = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderAbastecimento();
  }, () => showToast('Erro ao carregar Abastecimento.', 'error'));

  // ── A FAZER ──────────────────────────────────
  function renderAfazer() {
    const tbody = q('tbody-afazer'); const totalEl = q('total-afazer');
    if (afazer.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Nenhum item pendente.</td></tr>`; totalEl.textContent = 'R$ 0,00'; return; }
    let total = 0;
    tbody.innerHTML = afazer.map(item => {
      total += parseFloat(item.valor) || 0;
      return `<tr>
        <td style="text-align:center"><strong>${item.prioridade}</strong></td>
        <td>${esc(item.descricao)}</td>
        <td class="text-right">${fmtBRL(item.valor)}</td>
        <td style="text-align:center;white-space:nowrap">
          <button class="btn-icon" data-action="edit" data-id="${item.id}" title="Editar">✏️</button>
          <button class="btn-icon" data-action="delete" data-id="${item.id}" title="Excluir">🗑️</button>
        </td>
      </tr>`;
    }).join('');
    totalEl.textContent = fmtBRL(total);
    tbody.querySelectorAll('[data-action="edit"]').forEach(btn => btn.addEventListener('click', () => {
      const item = afazer.find(a => a.id === btn.dataset.id); if (item) abrirModalAfazer(item);
    }));
    tbody.querySelectorAll('[data-action="delete"]').forEach(btn => btn.addEventListener('click', () => confirmarExclusaoSimples(colAfazer, btn.dataset.id, afazer)));
  }

  function abrirModalAfazer(item) {
    const editar = !!item;
    openModal(
      editar ? 'Editar item' : 'Novo item — A Fazer',
      `<div class="form-group"><label>Prioridade</label><input type="number" id="cx-af-prioridade" value="${editar ? item.prioridade : ''}" min="1" placeholder="1 = mais urgente"></div>
       <div class="form-group"><label>Descrição</label><input type="text" id="cx-af-descricao" value="${editar ? esc(item.descricao) : ''}" placeholder="Ex: Trocar pneu traseiro"></div>
       <div class="form-group"><label>Valor estimado (R$)</label><input type="number" id="cx-af-valor" value="${editar ? item.valor : ''}" step="0.01" min="0" placeholder="0,00"></div>`,
      async () => {
        const prioridade = parseInt(document.getElementById('cx-af-prioridade').value);
        const descricao  = document.getElementById('cx-af-descricao').value.trim();
        const valor      = parseFloat(document.getElementById('cx-af-valor').value) || 0;
        if (!descricao || isNaN(prioridade) || prioridade < 1) { showToast('Preencha prioridade e descrição.', 'error'); return; }
        try {
          if (editar) { await updateDoc(doc(db, colAfazer, item.id), { prioridade, descricao, valor }); showToast('Item atualizado!', 'success'); }
          else        { await addDoc(collection(db, colAfazer), { prioridade, descricao, valor }); showToast('Item adicionado!', 'success'); }
        } catch { showToast('Erro ao salvar.', 'error'); }
      },
      editar ? 'Salvar' : 'Adicionar'
    );
  }

  // ── FEITOS ───────────────────────────────────
  function renderFeitos() {
    const tbody = q('tbody-feitos'); const totalEl = q('total-feitos');
    if (feitos.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Nenhuma manutenção registrada.</td></tr>`; totalEl.textContent = 'R$ 0,00'; return; }
    let total = 0; feitos.forEach(item => { total += parseFloat(item.valor) || 0; });
    const visiveis = feitos.slice(0, feitosVisiveis);
    tbody.innerHTML = visiveis.map(item => `<tr>
        <td>${fmtDate(item.data)}</td>
        <td>${esc(item.descricao)}</td>
        <td class="text-right text-success">${fmtBRL(item.valor)}</td>
        <td style="text-align:center;white-space:nowrap">
          <button class="btn-icon" data-action="edit" data-id="${item.id}" title="Editar">✏️</button>
          <button class="btn-icon" data-action="delete" data-id="${item.id}" title="Excluir">🗑️</button>
        </td>
      </tr>`).join('');
    if (feitos.length > feitosVisiveis) {
      const restantes = feitos.length - feitosVisiveis;
      tbody.innerHTML += `<tr><td colspan="4" style="text-align:center;padding:.6rem 0"><button class="btn-secondary" data-role="btn-feitos-mais">Carregar mais (${restantes})</button></td></tr>`;
    }
    totalEl.textContent = fmtBRL(total);
    tbody.querySelectorAll('[data-action="edit"]').forEach(btn => btn.addEventListener('click', () => {
      const item = feitos.find(f => f.id === btn.dataset.id); if (item) abrirModalFeito(item);
    }));
    tbody.querySelectorAll('[data-action="delete"]').forEach(btn => btn.addEventListener('click', () => confirmarExclusaoSimples(colFeitos, btn.dataset.id, feitos)));
    const btnMais = tbody.querySelector('[data-role="btn-feitos-mais"]');
    if (btnMais) btnMais.addEventListener('click', () => { feitosVisiveis += 5; renderFeitos(); });
  }

  function abrirModalFeito(item) {
    const editar = !!item;
    const hoje   = new Date().toISOString().split('T')[0];
    openModal(
      editar ? 'Editar Manutenção' : 'Registrar Manutenção Feita',
      `<div class="form-group"><label>Data</label><input type="date" id="cx-ft-data" value="${editar ? item.data : hoje}"></div>
       <div class="form-group"><label>Descrição</label><input type="text" id="cx-ft-descricao" value="${editar ? esc(item.descricao) : ''}" placeholder="Ex: Troca de óleo"></div>
       <div class="form-group"><label>Valor (R$)</label><input type="number" id="cx-ft-valor" value="${editar ? item.valor : ''}" step="0.01" min="0" placeholder="0,00"></div>`,
      async () => {
        const data      = document.getElementById('cx-ft-data').value;
        const descricao = document.getElementById('cx-ft-descricao').value.trim();
        const valor     = parseFloat(document.getElementById('cx-ft-valor').value) || 0;
        if (!data || !descricao) { showToast('Preencha data e descrição.', 'error'); return; }
        try {
          if (editar) { await updateDoc(doc(db, colFeitos, item.id), { data, descricao, valor }); showToast('Manutenção atualizada!', 'success'); }
          else        { await addDoc(collection(db, colFeitos), { data, descricao, valor }); showToast('Manutenção registrada!', 'success'); }
        } catch { showToast('Erro ao salvar.', 'error'); }
      },
      editar ? 'Salvar' : 'Registrar'
    );
  }

  // ── MANUTENÇÃO PREVENTIVA ────────────────────
  function renderManutencao() {
    const tbody = q('tbody-manutencao');
    if (manutencao.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Nenhum item cadastrado.</td></tr>`; return; }
    tbody.innerHTML = manutencao.map(item => `
      <tr>
        <td>${esc(item.descricao)}</td>
        <td>${item.data ? fmtDate(item.data) : '—'}</td>
        <td>${esc(item.kmUltimaTroca) || '—'}</td>
        <td>${esc(item.kmProximaTroca) || '—'}</td>
        <td class="text-right">${fmtBRL(item.valor)}</td>
        <td style="text-align:center;white-space:nowrap">
          <button class="btn-icon" data-action="edit" data-id="${item.id}" title="Editar">✏️</button>
          <button class="btn-icon" data-action="delete" data-id="${item.id}" title="Excluir">🗑️</button>
        </td>
      </tr>
    `).join('');
    tbody.querySelectorAll('[data-action="edit"]').forEach(btn => btn.addEventListener('click', () => {
      const item = manutencao.find(m => m.id === btn.dataset.id); if (item) abrirModalManutencao(item);
    }));
    tbody.querySelectorAll('[data-action="delete"]').forEach(btn => btn.addEventListener('click', () => confirmarExclusaoSimples(colManutencao, btn.dataset.id, manutencao)));
  }

  function abrirModalManutencao(item) {
    const editar = !!item;
    openModal(
      editar ? `Editar — ${esc(item.descricao)}` : 'Nova Manutenção Preventiva',
      `<div class="form-group"><label>Descrição</label><input type="text" id="cx-mn-descricao" value="${editar ? esc(item.descricao) : ''}" placeholder="Ex: Troca de óleo"></div>
       <div class="form-group"><label>Data da última troca</label><input type="date" id="cx-mn-data" value="${editar && item.data ? item.data : ''}"></div>
       <div class="form-group"><label>KM da última troca</label><input type="text" id="cx-mn-km-ultima" value="${editar ? esc(item.kmUltimaTroca || '') : ''}" placeholder="Ex: 52.400 km"></div>
       <div class="form-group"><label>KM da próxima troca</label><input type="text" id="cx-mn-km-proxima" value="${editar ? esc(item.kmProximaTroca || '') : ''}" placeholder="Ex: 57.400 km"></div>
       <div class="form-group"><label>Valor (R$)</label><input type="number" id="cx-mn-valor" value="${editar ? item.valor : ''}" step="0.01" min="0" placeholder="0,00"></div>`,
      async () => {
        const descricao      = document.getElementById('cx-mn-descricao').value.trim();
        const data           = document.getElementById('cx-mn-data').value;
        const kmUltimaTroca  = document.getElementById('cx-mn-km-ultima').value.trim();
        const kmProximaTroca = document.getElementById('cx-mn-km-proxima').value.trim();
        const valor          = parseFloat(document.getElementById('cx-mn-valor').value) || 0;
        if (!descricao) { showToast('Preencha a descrição.', 'error'); return; }
        const payload = { descricao, data, kmUltimaTroca, kmProximaTroca, valor };
        try {
          if (editar) { await updateDoc(doc(db, colManutencao, item.id), payload); showToast('Atualizado!', 'success'); }
          else        { await addDoc(collection(db, colManutencao), payload); showToast('Adicionado!', 'success'); }
        } catch { showToast('Erro ao salvar.', 'error'); }
      },
      editar ? 'Salvar' : 'Adicionar'
    );
  }

  // ── ABASTECIMENTO ─────────────────────────────
  function kmEfetivo(item) {
    const correcao = parseFloat(item.correcao) || 0;
    return (parseFloat(item.km) || 0) * (1 - correcao / 100);
  }

  function renderAbastecimento() {
    const tbody = q('tbody-abastecimento');
    if (abastecimento.length === 0) { tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Nenhum abastecimento registrado.</td></tr>`; return; }
    const visiveis = abastecimento.slice(0, abastecimentoVisiveis);
    tbody.innerHTML = visiveis.map(item => {
      const km       = kmEfetivo(item);
      const litros   = parseFloat(item.litros) || 0;
      const kmL      = litros > 0 ? (km / litros).toFixed(2) : null;
      const rsKm     = (item.valorPago && km > 0) ? ((parseFloat(item.valorPago) * litros) / km).toFixed(2) : null;
      const correcao = parseFloat(item.correcao) || 0;
      const kmLabel  = correcao > 0 ? `${esc(item.km)} km (−${correcao}%)` : `${esc(item.km)} km`;
      return `<tr>
        <td>${fmtDate(item.data)}</td>
        <td>${kmLabel}</td>
        <td>${esc(item.litros)} L</td>
        <td>${esc(item.tipoCombustivel)}</td>
        <td class="text-right">${item.valorPago ? fmtBRL(item.valorPago) : '—'}</td>
        <td class="text-right">${kmL ?? '—'}</td>
        <td class="text-right">${rsKm ? fmtBRL(rsKm) : '—'}</td>
        <td style="text-align:center;white-space:nowrap">
          <button class="btn-icon" data-action="edit" data-id="${item.id}" title="Editar">✏️</button>
          <button class="btn-icon" data-action="delete" data-id="${item.id}" title="Excluir">🗑️</button>
        </td>
      </tr>`;
    }).join('');
    if (abastecimento.length > abastecimentoVisiveis) {
      const restantes = abastecimento.length - abastecimentoVisiveis;
      tbody.innerHTML += `<tr><td colspan="8" style="text-align:center;padding:.6rem 0"><button class="btn-secondary" data-role="btn-abastecimento-mais">Carregar mais (${restantes})</button></td></tr>`;
    }
    tbody.querySelectorAll('[data-action="edit"]').forEach(btn => btn.addEventListener('click', () => {
      const item = abastecimento.find(a => a.id === btn.dataset.id); if (item) abrirModalAbastecimento(item);
    }));
    tbody.querySelectorAll('[data-action="delete"]').forEach(btn => btn.addEventListener('click', () => confirmarExclusaoSimples(colAbastecimento, btn.dataset.id, abastecimento)));
    const btnMais = tbody.querySelector('[data-role="btn-abastecimento-mais"]');
    if (btnMais) btnMais.addEventListener('click', () => { abastecimentoVisiveis += 5; renderAbastecimento(); });
  }

  function abrirModalAbastecimento(item) {
    const editar        = !!item;
    const hoje          = new Date().toISOString().split('T')[0];
    const valorPagoInit = editar ? (item.valorPago ?? '') : (localStorage.getItem(LS_VALOR_PAGO) ?? '');

    const opcoesTipo = tiposCombustivel.map(t => {
      const selecionado = editar ? (item.tipoCombustivel === t.nome) : (t.nome === 'Gasolina');
      return `<option value="${esc(t.nome)}" ${selecionado ? 'selected' : ''}>${esc(t.nome)}</option>`;
    }).join('');

    openModal(
      editar ? 'Editar Abastecimento' : 'Registrar Abastecimento',
      `<div class="form-group"><label>Data</label><input type="date" id="cx-ab-data" value="${editar ? item.data : hoje}"></div>
       <div class="form-group"><label>KM rodado no tanque</label><input type="number" id="cx-ab-km" value="${editar ? item.km : ''}" step="0.1" min="0" placeholder="Ex: 350"></div>
       <div class="form-group"><label>Correção (%)</label><input type="number" id="cx-ab-correcao" value="${editar ? (item.correcao ?? 0) : 0}" step="1" min="0" max="100" placeholder="0"><small>% a descontar do km informado</small></div>
       <div class="form-group"><label>Litros abastecidos</label><input type="number" id="cx-ab-litros" value="${editar ? item.litros : ''}" step="0.01" min="0" placeholder="Ex: 30"></div>
       <div class="form-group"><label>Tipo de combustível</label><select id="cx-ab-tipo">${opcoesTipo}<option value="__novo__">+ Novo tipo...</option></select></div>
       <div class="form-group" id="cx-ab-tipo-novo-wrap" style="display:none"><label>Nome do novo tipo</label><input type="text" id="cx-ab-tipo-novo" placeholder="Ex: GNV"></div>
       <div class="form-group"><label>Valor pago por litro (R$) — opcional</label><input type="number" id="cx-ab-valor" value="${valorPagoInit}" step="0.01" min="0" placeholder="0,00"></div>`,
      async () => {
        const data      = document.getElementById('cx-ab-data').value;
        const km        = parseFloat(document.getElementById('cx-ab-km').value);
        const correcao  = parseFloat(document.getElementById('cx-ab-correcao').value) || 0;
        const litros    = parseFloat(document.getElementById('cx-ab-litros').value);
        const valorStr  = document.getElementById('cx-ab-valor').value;
        const valorPago = valorStr === '' ? null : parseFloat(valorStr);
        let tipoCombustivel = document.getElementById('cx-ab-tipo').value;

        if (!data || isNaN(km) || km < 0 || isNaN(litros) || litros <= 0) { showToast('Preencha data, km e litros corretamente.', 'error'); return; }

        if (tipoCombustivel === '__novo__') {
          const novoNome = document.getElementById('cx-ab-tipo-novo').value.trim();
          if (!novoNome) { showToast('Informe o nome do novo tipo.', 'error'); return; }
          try { await adicionarTipoCombustivel(novoNome); tipoCombustivel = novoNome; }
          catch { showToast('Erro ao criar tipo de combustível.', 'error'); return; }
        }

        const payload = { data, km, correcao, litros, valorPago, tipoCombustivel };
        try {
          if (editar) { await updateDoc(doc(db, colAbastecimento, item.id), payload); showToast('Abastecimento atualizado!', 'success'); }
          else        { await addDoc(collection(db, colAbastecimento), payload); showToast('Abastecimento registrado!', 'success'); }
          if (valorPago !== null) localStorage.setItem(LS_VALOR_PAGO, String(valorPago));
        } catch { showToast('Erro ao salvar.', 'error'); }
      },
      editar ? 'Salvar' : 'Registrar'
    );

    const selectTipo = document.getElementById('cx-ab-tipo');
    const novoWrap   = document.getElementById('cx-ab-tipo-novo-wrap');
    selectTipo.addEventListener('change', () => { novoWrap.style.display = selectTipo.value === '__novo__' ? '' : 'none'; });
  }

  initNotas(`custom-${secao.slug}`);
}

// ──────────────────────────────────────────────
// TEMPLATE: DEVO / DEVEM
// ──────────────────────────────────────────────
function montarDevoDevem(container, secao) {
  const colecao = secao.colecoes.principal;

  container.innerHTML = `
    <div class="card">
      <div class="card-header"><h3 class="card-title">${secao.icone || '💸'} ${esc(secao.nome)} — Registrar Dívida</h3></div>
      <form class="form-inline" data-role="form">
        <div class="radio-group-inline">
          <label class="radio-label devo-label"><input type="radio" name="tipo" value="Devo" checked><span>Devo</span></label>
          <label class="radio-label devem-label"><input type="radio" name="tipo" value="Devem"><span>Devem</span></label>
        </div>
        <div class="form-group"><input type="text" data-role="descricao" placeholder="Descrição" required></div>
        <div class="form-group dd-parcelas-group"><input type="number" data-role="parcelas" placeholder="Parcelas" min="1" step="1"></div>
        <div class="form-group"><input type="number" data-role="valor" placeholder="Valor total R$" step="0.01" min="0.01" required></div>
        <div class="form-group dd-data-group"><input type="text" data-role="data" placeholder="MM-AAAA" maxlength="7"></div>
        <button type="submit" class="btn btn-primary">Registrar</button>
      </form>
    </div>
    <div class="tables-2col">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title text-danger">Devo</h3>
          <div class="dd-header-controls">
            <input type="month" data-role="mes-devo" class="month-picker">
            <label class="dd-filter-check"><input type="checkbox" data-role="fechadas-devo"><span>Mostrar fechadas</span></label>
          </div>
          <span class="dd-total-label">Em aberto: <strong data-role="total-devo">R$ 0,00</strong></span>
        </div>
        <table class="data-table">
          <thead><tr><th>Mês</th><th>Descrição</th><th class="text-right">Valor</th><th style="text-align:center">Status</th><th></th></tr></thead>
          <tbody data-role="tbody-devo"><tr><td colspan="5" class="loading">Carregando...</td></tr></tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-header">
          <h3 class="card-title text-success">Devem</h3>
          <div class="dd-header-controls">
            <input type="month" data-role="mes-devem" class="month-picker">
            <label class="dd-filter-check"><input type="checkbox" data-role="fechadas-devem"><span>Mostrar fechadas</span></label>
          </div>
          <span class="dd-total-label">A receber: <strong data-role="total-devem">R$ 0,00</strong></span>
        </div>
        <table class="data-table">
          <thead><tr><th>Mês</th><th>Descrição</th><th class="text-right">Valor</th><th style="text-align:center">Status</th><th></th></tr></thead>
          <tbody data-role="tbody-devem"><tr><td colspan="5" class="loading">Carregando...</td></tr></tbody>
        </table>
      </div>
    </div>
    ${notasHTML(secao)}
  `;

  const q = role => container.querySelector(`[data-role="${role}"]`);

  let dividas = [];
  const mesAtual = mesAtualYYYYMM();
  let filtroMesDevo = mesAtual, filtroMesDevem = mesAtual;
  let mostrarFechadasDevo = false, mostrarFechadasDevem = false;

  const dataInput = q('data');
  const nowLabel  = () => { const n = new Date(); return `${String(n.getMonth() + 1).padStart(2, '0')}-${n.getFullYear()}`; };
  dataInput.value = nowLabel();
  dataInput.addEventListener('input', () => {
    let v = dataInput.value.replace(/\D/g, '');
    if (v.length > 2) v = v.slice(0, 2) + '-' + v.slice(2, 6);
    dataInput.value = v;
  });

  q('form').addEventListener('submit', async e => {
    e.preventDefault();
    const tipo      = e.target.querySelector('input[name="tipo"]:checked').value;
    const descricao = q('descricao').value.trim();
    const parcelas  = Math.max(1, parseInt(q('parcelas').value) || 1);
    const valor     = parseFloat(q('valor').value);
    const dataStr   = q('data').value.trim();

    if (!descricao || isNaN(valor) || valor <= 0) { showToast('Preencha descrição e valor.', 'error'); return; }
    if (!validarMesAno(dataStr)) { showToast('Data inválida. Use MM-AAAA (ex: 06-2026).', 'error'); return; }

    try {
      await gerarParcelas(tipo, descricao, parcelas, valor, dataStr);
      showToast(parcelas === 1 ? 'Dívida registrada!' : `${parcelas} parcelas registradas!`, 'success');
      e.target.reset();
      dataInput.value = nowLabel();
    } catch { showToast('Erro ao registrar. Tente novamente.', 'error'); }
  });

  function validarMesAno(str) {
    if (!str || !/^\d{2}-\d{4}$/.test(str)) return false;
    const mes = parseInt(str.slice(0, 2));
    return mes >= 1 && mes <= 12;
  }

  async function gerarParcelas(tipo, descricao, parcelas, valorTotal, dataStr) {
    const valorParcela = Math.round((valorTotal / parcelas) * 100) / 100;
    const now = new Date();
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
      await addDoc(collection(db, colecao), { tipo, data, descricao, valor: valorParcela, status });
    }
  }

  q('mes-devo').value  = mesAtual;
  q('mes-devem').value = mesAtual;
  q('mes-devo').addEventListener('change',  e => { filtroMesDevo  = e.target.value; renderTabelas(); });
  q('mes-devem').addEventListener('change', e => { filtroMesDevem = e.target.value; renderTabelas(); });
  q('fechadas-devo').addEventListener('change',  e => { mostrarFechadasDevo  = e.target.checked; renderTabelas(); });
  q('fechadas-devem').addEventListener('change', e => { mostrarFechadasDevem = e.target.checked; renderTabelas(); });

  onSnapshot(query(collection(db, colecao), orderBy('data', 'asc')), snap => {
    dividas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTabelas();
  }, () => showToast('Erro ao carregar dívidas.', 'error'));

  function aplicarFiltro(lista, filtroMes, mostrarFechadas) {
    return lista.filter(d => {
      if (d.data !== filtroMes) return false;
      if (d.status === 'Fechada' && !mostrarFechadas) return false;
      return true;
    });
  }

  function renderTabelas() {
    const devo  = dividas.filter(d => d.tipo === 'Devo');
    const devem = dividas.filter(d => d.tipo === 'Devem');
    renderTabela(aplicarFiltro(devo,  filtroMesDevo,  mostrarFechadasDevo),  devo,  'tbody-devo',  'total-devo');
    renderTabela(aplicarFiltro(devem, filtroMesDevem, mostrarFechadasDevem), devem, 'tbody-devem', 'total-devem');
  }

  function renderTabela(listaFiltrada, listaCompleta, tbodyRole, totalRole) {
    const tbody   = q(tbodyRole);
    const totalEl = q(totalRole);
    const totalAberta = listaCompleta.filter(d => d.status === 'Aberta').reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
    totalEl.textContent = fmtBRL(totalAberta);

    if (listaFiltrada.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Nenhuma dívida registrada.</td></tr>`; return; }

    tbody.innerHTML = listaFiltrada.map(item => {
      const aberta = item.status === 'Aberta';
      return `<tr>
        <td>${fmtMesAno(item.data)}</td>
        <td>${esc(item.descricao)}</td>
        <td class="text-right">${fmtBRL(item.valor)}</td>
        <td style="text-align:center">
          <span class="status-badge status-${aberta ? 'aberta' : 'fechada'}" data-id="${item.id}" data-status="${item.status}" title="Clique para alternar status">${item.status}</span>
        </td>
        <td style="text-align:center">
          <button class="btn-icon" data-action="edit" data-id="${item.id}" title="Editar">✏️</button>
          <button class="btn-icon" data-action="delete" data-id="${item.id}" title="Excluir">🗑️</button>
        </td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.status-badge').forEach(badge => badge.addEventListener('click', () => toggleStatus(badge.dataset.id, badge.dataset.status)));
    tbody.querySelectorAll('[data-action="edit"]').forEach(btn => btn.addEventListener('click', () => {
      const item = dividas.find(d => d.id === btn.dataset.id); if (item) abrirModalEditarDivida(item);
    }));
    tbody.querySelectorAll('[data-action="delete"]').forEach(btn => btn.addEventListener('click', () => confirmarExclusaoDivida(btn.dataset.id)));
  }

  async function toggleStatus(id, statusAtual) {
    const novoStatus = statusAtual === 'Aberta' ? 'Fechada' : 'Aberta';
    try { await updateDoc(doc(db, colecao, id), { status: novoStatus }); }
    catch { showToast('Erro ao atualizar status.', 'error'); }
  }

  function abrirModalEditarDivida(divida) {
    const dataInputVal = yyyymmToMmAaaa(divida.data);
    openModal(
      'Editar parcela',
      `<div class="form-group"><label>Descrição</label><input type="text" id="cx-dd-descricao" value="${esc(divida.descricao)}" required></div>
       <div class="form-group"><label>Valor (R$)</label><input type="number" id="cx-dd-valor" value="${divida.valor}" min="0.01" step="0.01" required></div>
       <div class="form-group"><label>Mês (MM-AAAA)</label><input type="text" id="cx-dd-data" value="${dataInputVal}" placeholder="06-2026" maxlength="7"></div>`,
      async () => {
        const descricao = document.getElementById('cx-dd-descricao').value.trim();
        const valor     = parseFloat(document.getElementById('cx-dd-valor').value);
        const dataStr   = document.getElementById('cx-dd-data').value.trim();
        if (!descricao || isNaN(valor) || valor <= 0) { showToast('Preencha descrição e valor.', 'error'); return; }
        if (!validarMesAno(dataStr)) { showToast('Data inválida. Use MM-AAAA (ex: 06-2026).', 'error'); return; }
        const [mes, ano] = dataStr.split('-');
        const data = `${ano}-${mes.padStart(2, '0')}`;
        try { await updateDoc(doc(db, colecao, divida.id), { descricao, valor, data }); showToast('Parcela atualizada!', 'success'); }
        catch { showToast('Erro ao atualizar.', 'error'); }
      },
      'Salvar'
    );
  }

  function confirmarExclusaoDivida(id) {
    const divida = dividas.find(d => d.id === id);
    openModal(
      'Excluir parcela',
      `<p>Deseja excluir a parcela de <strong>${fmtBRL(divida?.valor)}</strong> (${fmtMesAno(divida?.data)})? Esta ação não pode ser desfeita.</p>`,
      async () => { try { await deleteDoc(doc(db, colecao, id)); showToast('Parcela excluída.', 'success'); } catch { showToast('Erro ao excluir.', 'error'); } },
      'Excluir'
    );
  }

  initNotas(`custom-${secao.slug}`);
}
