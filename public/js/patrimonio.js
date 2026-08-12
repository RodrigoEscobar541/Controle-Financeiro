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
 *
 *   Coleção: reservas  (tabela própria, no topo da seção)
 *   Documento (ID aleatório):
 *     { nome: "Emergência", ondeEsta: "Nubank CDB", valor: 15000 }
 *   ATENÇÃO: reservas NÃO entram na soma do patrimônio (nem no total da
 *   tabela de ativos, nem no gráfico, nem nos agregados do dashboard/bot).
 *   Coleção separada justamente para manter esse isolamento.
 */

import { db } from './firebase-config.js';
import { fmtBRL, showToast, openModal } from './app.js';
import {
  collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let ativos       = [];
let divisoes     = [];
let reservas     = [];
let unsubAtivos   = null;
let unsubDivisoes = null;
let unsubReservas = null;

// Paleta harmônica — cores atribuídas às divisões na ordem de cadastro.
const PALETA = [
  '#1565C0', '#2E7D32', '#F57F17', '#6A1B9A', '#00838F', '#C62828',
  '#4527A0', '#AD1457', '#558B2F', '#EF6C00', '#00695C', '#283593'
];
const COR_SEM_CLASSE = '#94A3B8';

export function initPatrimonio() {
  document.getElementById('btn-add-ativo').addEventListener('click', abrirModalNovoAtivo);
  document.getElementById('btn-add-divisao').addEventListener('click', abrirModalNovaDivisao);
  document.getElementById('btn-add-reserva').addEventListener('click', abrirModalNovaReserva);
  subscribeDivisoes();
  subscribeAtivos();
  subscribeReservas();
}

function subscribeAtivos() {
  if (unsubAtivos) unsubAtivos();
  unsubAtivos = onSnapshot(collection(db, 'patrimonio'), snap => {
    // A ordenação mora em renderTabela(): depende das divisões, que chegam
    // em outro snapshot e podem carregar depois destes ativos.
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

function subscribeReservas() {
  if (unsubReservas) unsubReservas();
  unsubReservas = onSnapshot(collection(db, 'reservas'), snap => {
    reservas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                        .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
    renderTabelaReservas();
  }, () => showToast('Erro ao carregar reservas.', 'error'));
}

// ──────────────────────────────────────────────
// TABELA DE RESERVAS
// Isolada do patrimônio: o total abaixo é só desta tabela e não é somado
// em nenhum outro lugar.
// ──────────────────────────────────────────────
function renderTabelaReservas() {
  const tbody   = document.getElementById('reservas-tbody');
  const totalEl = document.getElementById('reservas-total');

  if (reservas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">
      Nenhuma reserva cadastrada. Clique em "+ Nova Reserva".
    </td></tr>`;
    totalEl.textContent = 'R$ 0,00';
    return;
  }

  let total = 0;
  tbody.innerHTML = reservas.map(r => {
    total += parseFloat(r.valor) || 0;
    return `<tr>
      <td><strong>${esc(r.nome)}</strong></td>
      <td>${esc(r.ondeEsta)}</td>
      <td class="text-right">${fmtBRL(r.valor)}</td>
      <td style="text-align:center;white-space:nowrap">
        <button class="btn-icon" data-res-action="edit" data-id="${r.id}" title="Editar">✏️</button>
        <button class="btn-icon" data-res-action="delete" data-id="${r.id}" title="Excluir">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  totalEl.textContent = fmtBRL(total);

  tbody.querySelectorAll('[data-res-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const reserva = reservas.find(r => r.id === btn.dataset.id);
      if (reserva) abrirModalEditarReserva(reserva);
    });
  });

  tbody.querySelectorAll('[data-res-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => confirmarExclusaoReserva(btn.dataset.id));
  });
}

function reservaFormHtml(reserva = {}) {
  return `
    <div class="form-group">
      <label>Nome da reserva</label>
      <input type="text" id="reserva-nome" value="${escAttr(reserva.nome || '')}" placeholder="Ex: Emergência, Viagem">
    </div>
    <div class="form-group">
      <label>Onde está</label>
      <input type="text" id="reserva-onde" value="${escAttr(reserva.ondeEsta || '')}" placeholder="Ex: Nubank CDB, Mercado Pago">
    </div>
    <div class="form-group">
      <label>Valor (R$)</label>
      <input type="number" id="reserva-valor" value="${reserva.valor ?? ''}" step="0.01" min="0" placeholder="0,00">
    </div>`;
}

function lerFormReserva() {
  const nome     = document.getElementById('reserva-nome').value.trim();
  const ondeEsta = document.getElementById('reserva-onde').value.trim();
  const valor    = parseFloat(document.getElementById('reserva-valor').value);

  if (!nome || !ondeEsta || isNaN(valor) || valor < 0) {
    showToast('Preencha todos os campos.', 'error');
    return null;
  }
  return { nome, ondeEsta, valor };
}

function abrirModalNovaReserva() {
  openModal(
    'Nova Reserva',
    reservaFormHtml(),
    async () => {
      const dados = lerFormReserva();
      if (!dados) return;
      try {
        await addDoc(collection(db, 'reservas'), dados);
        showToast('Reserva adicionada!', 'success');
      } catch {
        showToast('Erro ao adicionar reserva.', 'error');
      }
    },
    'Adicionar'
  );
}

function abrirModalEditarReserva(reserva) {
  openModal(
    `Editar — ${reserva.nome}`,
    reservaFormHtml(reserva),
    async () => {
      const dados = lerFormReserva();
      if (!dados) return;
      try {
        await updateDoc(doc(db, 'reservas', reserva.id), dados);
        showToast('Reserva atualizada!', 'success');
      } catch {
        showToast('Erro ao atualizar.', 'error');
      }
    },
    'Salvar'
  );
}

function confirmarExclusaoReserva(id) {
  const reserva = reservas.find(r => r.id === id);
  openModal(
    'Excluir reserva',
    `<p>Deseja excluir <strong>${esc(reserva?.nome || 'esta reserva')}</strong>? Esta ação não pode ser desfeita.</p>`,
    async () => {
      try {
        await deleteDoc(doc(db, 'reservas', id));
        showToast('Reserva excluída.', 'success');
      } catch {
        showToast('Erro ao excluir.', 'error');
      }
    },
    'Excluir'
  );
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
  tbody.innerHTML = ordenarPorTipo(ativos).map(a => {
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

/**
 * Agrupa os ativos por tipo de investimento, na mesma ordem em que as divisões
 * aparecem na legenda do gráfico — assim tabela e pizza se leem juntas.
 * Ativos sem divisão correspondente caem no fim. Dentro de cada grupo, alfabético.
 */
function ordenarPorTipo(lista) {
  const ordem = new Map(divisoes.map((d, i) => [d.nome, i]));
  const posicao = a => ordem.has(a.tipoInvestimento) ? ordem.get(a.tipoInvestimento) : divisoes.length;
  return [...lista].sort((a, b) => {
    const pa = posicao(a), pb = posicao(b);
    if (pa !== pb) return pa - pb;
    // Sem divisão: agrupa pelo texto do tipo antes de cair no nome do ativo.
    const ta = (a.tipoInvestimento || '').localeCompare(b.tipoInvestimento || '', 'pt-BR');
    if (ta !== 0) return ta;
    return (a.nomeDoAtivo || '').localeCompare(b.nomeDoAtivo || '', 'pt-BR');
  });
}

function corDoTipo(tipo) {
  return divisoes.find(d => d.nome === tipo)?.cor || null;
}

function selectTipoInvestimento(ativo) {
  const atual  = ativo.tipoInvestimento || '';
  const existe = divisoes.some(d => d.nome === atual);
  const opcoes = [`<option value="">— selecionar —</option>`];
  divisoes.forEach(d => {
    opcoes.push(`<option value="${escAttr(d.nome)}" ${d.nome === atual ? 'selected' : ''}>${esc(d.nome)}</option>`);
  });
  // valor antigo que não corresponde mais a nenhuma divisão: mantém visível
  if (atual && !existe) {
    opcoes.push(`<option value="${escAttr(atual)}" selected>${esc(atual)} (sem divisão)</option>`);
  }

  // Pinta o select com a cor da divisão (a mesma do gráfico). Sem divisão
  // correspondente fica cinza; sem tipo nenhum, mantém o estilo padrão.
  const cor = corDoTipo(atual) || (atual ? COR_SEM_CLASSE : null);
  const estilo = cor
    ? ` style="background:${cor};border-color:${cor};color:${corDeTextoSobre(cor)}"`
    : '';

  return `<select class="select-tipo-inv" data-id="${ativo.id}"${estilo}>${opcoes.join('')}</select>`;
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
/**
 * Preto ou branco sobre a cor de fundo, o que tiver mais contraste.
 * As cores das divisões são escolhidas à mão no color picker, então podem ser
 * tanto escuras quanto claras — texto fixo ficaria ilegível em metade delas.
 * Luminância relativa da WCAG; corte em 0.5 (≈ 4.5:1 nos dois sentidos).
 */
function corDeTextoSobre(hex) {
  const m = /^#?([\da-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const canal = c => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * canal((n >> 16) & 255)
            + 0.7152 * canal((n >> 8) & 255)
            + 0.0722 * canal(n & 255);
  return lum > 0.5 ? '#1A1A2E' : '#FFFFFF';
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = x => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}
