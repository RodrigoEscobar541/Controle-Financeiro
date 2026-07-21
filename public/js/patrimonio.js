/**
 * Patrimônio e Investimentos
 *
 * Estrutura Firestore:
 *   Coleção: patrimonio
 *   Documento (ID aleatório):
 *     { nomeDoAtivo: "BTC", plataforma: "Mercado Bitcoin",
 *       tipoInvestimento: "Criptomoeda", valor: 2180 }
 *
 *   Coleção: patrimonioDivisoes  (divisões do gráfico pizza)
 *   Documento (ID aleatório):
 *     { nome: "Criptomoeda", cor: "#1565C0" }
 */

import { db } from './firebase-config.js';
import { fmtBRL, showToast, openModal } from './app.js';
import {
  collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let ativos       = [];
let divisoes     = [];
let unsubAtivos   = null;
let unsubDivisoes = null;

// Paleta harmônica — cores atribuídas às divisões na ordem de cadastro.
const PALETA = [
  '#1565C0', '#2E7D32', '#F57F17', '#6A1B9A', '#00838F', '#C62828',
  '#4527A0', '#AD1457', '#558B2F', '#EF6C00', '#00695C', '#283593'
];
const COR_SEM_CLASSE = '#94A3B8';

export function initPatrimonio() {
  document.getElementById('btn-add-ativo').addEventListener('click', abrirModalNovoAtivo);
  document.getElementById('btn-add-divisao').addEventListener('click', abrirModalNovaDivisao);
  subscribeDivisoes();
  subscribeAtivos();
}

function subscribeAtivos() {
  if (unsubAtivos) unsubAtivos();
  unsubAtivos = onSnapshot(collection(db, 'patrimonio'), snap => {
    ativos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTabela();
    renderPizza();
  }, () => showToast('Erro ao carregar patrimônio.', 'error'));
}

function subscribeDivisoes() {
  if (unsubDivisoes) unsubDivisoes();
  unsubDivisoes = onSnapshot(collection(db, 'patrimonioDivisoes'), snap => {
    divisoes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                        .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
    renderTabela();
    renderPizza();
  }, () => showToast('Erro ao carregar divisões.', 'error'));
}

// ──────────────────────────────────────────────
// TABELA DE ATIVOS
// ──────────────────────────────────────────────
function renderTabela() {
  const tbody   = document.getElementById('patrimonio-tbody');
  const totalEl = document.getElementById('patrimonio-total');

  if (ativos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">
      Nenhum ativo cadastrado. Clique em "+ Novo Ativo".
    </td></tr>`;
    totalEl.textContent = 'R$ 0,00';
    return;
  }

  let total = 0;
  tbody.innerHTML = ativos.map(a => {
    total += parseFloat(a.valor) || 0;
    return `<tr>
      <td><strong>${esc(a.nomeDoAtivo)}</strong></td>
      <td>${esc(a.plataforma)}</td>
      <td>${selectTipoInvestimento(a)}</td>
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

  tbody.querySelectorAll('.select-tipo-inv').forEach(sel => {
    sel.addEventListener('change', async () => {
      try {
        await updateDoc(doc(db, 'patrimonio', sel.dataset.id), { tipoInvestimento: sel.value });
      } catch {
        showToast('Erro ao salvar tipo de investimento.', 'error');
      }
    });
  });
}

function selectTipoInvestimento(ativo) {
  const atual = ativo.tipoInvestimento || '';
  const existe = divisoes.some(d => d.nome === atual);
  const opcoes = [`<option value="">— selecionar —</option>`];
  divisoes.forEach(d => {
    opcoes.push(`<option value="${escAttr(d.nome)}" ${d.nome === atual ? 'selected' : ''}>${esc(d.nome)}</option>`);
  });
  // valor antigo que não corresponde mais a nenhuma divisão: mantém visível
  if (atual && !existe) {
    opcoes.push(`<option value="${escAttr(atual)}" selected>${esc(atual)} (sem divisão)</option>`);
  }
  return `<select class="select-tipo-inv" data-id="${ativo.id}">${opcoes.join('')}</select>`;
}

function formHtml(ativo = {}) {
  const atual = ativo.tipoInvestimento || '';
  const opcoes = [`<option value="">— selecionar —</option>`]
    .concat(divisoes.map(d =>
      `<option value="${escAttr(d.nome)}" ${d.nome === atual ? 'selected' : ''}>${esc(d.nome)}</option>`))
    .join('');
  return `
    <div class="form-group">
      <label>Nome do Ativo</label>
      <input type="text" id="ativo-nome" value="${escAttr(ativo.nomeDoAtivo || '')}" placeholder="Ex: BTC, Tesouro Selic">
    </div>
    <div class="form-group">
      <label>Descrição</label>
      <input type="text" id="ativo-plataforma" value="${escAttr(ativo.plataforma || '')}" placeholder="Ex: Mercado Bitcoin, XP">
    </div>
    <div class="form-group">
      <label>Tipo de investimento</label>
      <select id="ativo-tipo-inv">${opcoes}</select>
    </div>
    <div class="form-group">
      <label>Valor investido (R$)</label>
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
      const tipoInv    = document.getElementById('ativo-tipo-inv').value;
      const valor      = parseFloat(document.getElementById('ativo-valor').value);

      if (!nome || !plataforma || isNaN(valor) || valor < 0) {
        showToast('Preencha todos os campos.', 'error');
        return;
      }
      try {
        await addDoc(collection(db, 'patrimonio'), { nomeDoAtivo: nome, plataforma, tipoInvestimento: tipoInv, valor });
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
      const tipoInv    = document.getElementById('ativo-tipo-inv').value;
      const valor      = parseFloat(document.getElementById('ativo-valor').value);

      if (!nome || !plataforma || isNaN(valor) || valor < 0) {
        showToast('Preencha todos os campos.', 'error');
        return;
      }
      try {
        await updateDoc(doc(db, 'patrimonio', ativo.id), { nomeDoAtivo: nome, plataforma, tipoInvestimento: tipoInv, valor });
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
    `<p>Deseja excluir <strong>${esc(ativo?.nomeDoAtivo || 'este ativo')}</strong>? Esta ação não pode ser desfeita.</p>`,
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

// ──────────────────────────────────────────────
// GRÁFICO PIZZA (divisões por tipo de investimento)
// ──────────────────────────────────────────────
function renderPizza() {
  const chartEl = document.getElementById('pizza-chart');
  const legEl   = document.getElementById('pizza-legenda');
  if (!chartEl || !legEl) return;

  // Soma o valor investido por divisão. Ativos sem tipo de investimento
  // (ou com tipo que não corresponde a nenhuma divisão) são desconsiderados.
  const totalPorDiv = new Map();
  divisoes.forEach(d => totalPorDiv.set(d.nome, 0));
  ativos.forEach(a => {
    const v = parseFloat(a.valor) || 0;
    if (a.tipoInvestimento && totalPorDiv.has(a.tipoInvestimento)) {
      totalPorDiv.set(a.tipoInvestimento, totalPorDiv.get(a.tipoInvestimento) + v);
    }
  });

  if (divisoes.length === 0) {
    chartEl.innerHTML = '';
    legEl.innerHTML = `<p class="empty-state">Nenhuma divisão cadastrada. Clique em "+ Nova divisão".</p>`;
    return;
  }

  // Segmentos com valor > 0 desenham fatia; a legenda lista todas as divisões.
  const segmentos = [];
  divisoes.forEach(d => {
    const t = totalPorDiv.get(d.nome) || 0;
    if (t > 0) segmentos.push({ nome: d.nome, total: t, cor: d.cor || COR_SEM_CLASSE });
  });

  const totalGeral = segmentos.reduce((s, x) => s + x.total, 0);

  // Donut em SVG (círculos com stroke-dasharray).
  const cx = 90, cy = 90, r = 66, sw = 30, C = 2 * Math.PI * r;
  if (totalGeral > 0) {
    let offset = 0;
    const arcs = segmentos.map(s => {
      const dash = (s.total / totalGeral) * C;
      const c = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.cor}"
        stroke-width="${sw}" stroke-dasharray="${dash} ${C - dash}"
        stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"></circle>`;
      offset += dash;
      return c;
    }).join('');
    chartEl.innerHTML = `<svg viewBox="0 0 180 180" width="180" height="180" role="img" aria-label="Distribuição por tipo de investimento">
      ${arcs}
      <text x="${cx}" y="${cy - 3}" text-anchor="middle" class="pizza-centro-val">${fmtBRL(totalGeral)}</text>
      <text x="${cx}" y="${cy + 15}" text-anchor="middle" class="pizza-centro-lbl">Total</text>
    </svg>`;
  } else {
    chartEl.innerHTML = `<div class="pizza-vazio">Sem valores investidos ainda</div>`;
  }

  // Legenda (todas as divisões, com botões de editar/excluir).
  legEl.innerHTML = divisoes.map(d => {
    const t   = totalPorDiv.get(d.nome) || 0;
    const pct = totalGeral > 0 ? (t / totalGeral * 100) : 0;
    return `<div class="pizza-item">
      <span class="pizza-cor" style="background:${d.cor || COR_SEM_CLASSE}"></span>
      <span class="pizza-pct">${pct.toFixed(1)}%</span>
      <span class="pizza-nome">${esc(d.nome)}</span>
      <span class="pizza-valor">${fmtBRL(t)}</span>
      <span class="pizza-acoes">
        <button class="btn-icon" data-div-action="edit" data-id="${d.id}" title="Editar">✏️</button>
        <button class="btn-icon" data-div-action="delete" data-id="${d.id}" title="Excluir">🗑️</button>
      </span>
    </div>`;
  }).join('');

  legEl.querySelectorAll('[data-div-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = divisoes.find(x => x.id === btn.dataset.id);
      if (d) abrirModalEditarDivisao(d);
    });
  });
  legEl.querySelectorAll('[data-div-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => confirmarExclusaoDivisao(btn.dataset.id));
  });
}

function corParaNovaDivisao() {
  const usadas = new Set(divisoes.map(d => (d.cor || '').toLowerCase()));
  const livre = PALETA.find(c => !usadas.has(c.toLowerCase()));
  if (livre) return livre;
  // Paleta esgotada: ângulo-áureo para manter harmonia.
  const h = (divisoes.length * 137.508) % 360;
  return hslToHex(h, 60, 45);
}

function divisaoFormHtml(div = {}) {
  const cor = div.cor || corParaNovaDivisao();
  return `
    <div class="form-group">
      <label>Nome da divisão</label>
      <input type="text" id="div-nome" value="${escAttr(div.nome || '')}" placeholder="Ex: Criptomoeda, Renda fixa, Ações">
    </div>
    <div class="form-group">
      <label>Cor</label>
      <input type="color" id="div-cor" value="${cor}" style="width:64px;height:40px;padding:2px;">
    </div>`;
}

function abrirModalNovaDivisao() {
  openModal(
    'Nova divisão',
    divisaoFormHtml(),
    async () => {
      const nome = document.getElementById('div-nome').value.trim();
      const cor  = document.getElementById('div-cor').value;
      if (!nome) { showToast('Informe o nome da divisão.', 'error'); return; }
      if (divisoes.some(d => d.nome.toLowerCase() === nome.toLowerCase())) {
        showToast('Já existe uma divisão com esse nome.', 'error'); return;
      }
      try {
        await addDoc(collection(db, 'patrimonioDivisoes'), { nome, cor });
        showToast('Divisão adicionada!', 'success');
      } catch {
        showToast('Erro ao adicionar divisão.', 'error');
      }
    },
    'Adicionar'
  );
}

function abrirModalEditarDivisao(div) {
  openModal(
    `Editar divisão — ${div.nome}`,
    divisaoFormHtml(div),
    async () => {
      const nome = document.getElementById('div-nome').value.trim();
      const cor  = document.getElementById('div-cor').value;
      if (!nome) { showToast('Informe o nome da divisão.', 'error'); return; }
      if (divisoes.some(d => d.id !== div.id && d.nome.toLowerCase() === nome.toLowerCase())) {
        showToast('Já existe uma divisão com esse nome.', 'error'); return;
      }
      try {
        await updateDoc(doc(db, 'patrimonioDivisoes', div.id), { nome, cor });
        // Renomeou? Repropaga o novo nome para os ativos que a usavam.
        if (nome !== div.nome) {
          const afetados = ativos.filter(a => a.tipoInvestimento === div.nome);
          await Promise.all(afetados.map(a =>
            updateDoc(doc(db, 'patrimonio', a.id), { tipoInvestimento: nome })));
        }
        showToast('Divisão atualizada!', 'success');
      } catch {
        showToast('Erro ao atualizar divisão.', 'error');
      }
    },
    'Salvar'
  );
}

function confirmarExclusaoDivisao(id) {
  const div = divisoes.find(d => d.id === id);
  const emUso = ativos.filter(a => a.tipoInvestimento === div?.nome).length;
  const aviso = emUso > 0
    ? `<p style="color:var(--warning)">${emUso} ativo(s) usam esta divisão e ficarão sem classificação.</p>`
    : '';
  openModal(
    'Excluir divisão',
    `<p>Deseja excluir a divisão <strong>${esc(div?.nome || '')}</strong>?</p>${aviso}`,
    async () => {
      try {
        await deleteDoc(doc(db, 'patrimonioDivisoes', id));
        showToast('Divisão excluída.', 'success');
      } catch {
        showToast('Erro ao excluir divisão.', 'error');
      }
    },
    'Excluir'
  );
}

// ──────────────────────────────────────────────
// UTILIDADES
// ──────────────────────────────────────────────
function esc(v) {
  return String(v ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function escAttr(v) {
  return String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = x => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}
