import { initDashboard, adicionarCardSecaoCustomizada, removerCardSecaoCustomizada } from './dashboard.js';
import { initBanco }       from './banco.js';
import { initDistribuicao} from './distribuicao.js';
import { initPatrimonio }  from './patrimonio.js';
import { initContasCasa }  from './contas-casa.js';
import { initCarro }       from './carro.js';
import { initFocus }       from './focus.js';
import { initDevoDeve }    from './devo-devem.js';
import { auth, onAuthStateChanged } from './auth.js';
import { initNotas }       from './notas.js';
import { montarSecaoCustomizada } from './custom-sections.js';
import {
  SECOES_FIXAS, TEMPLATES,
  carregarSecoesCustomizadas, criarSecaoCustomizada, excluirSecaoCustomizada,
  carregarSecoesOcultas, ocultarSecaoFixa
} from './section-templates.js';

// ──────────────────────────────────────────────
// UTILIDADES GLOBAIS
// ──────────────────────────────────────────────
export function fmtBRL(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtDate(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export function mesAtualId() {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${m}`;
}

export function mesAtualLabel() {
  const now = new Date();
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${meses[now.getMonth()]}/${now.getFullYear()}`;
}

export function idToLabel(id) {
  // "2026-06" → "Jun/2026"
  const [y, m] = id.split('-');
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${meses[parseInt(m,10)-1]}/${y}`;
}

// Toast global
export function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast${type ? ' ' + type : ''}`;
  setTimeout(() => el.classList.add('hidden'), 3000);
}

// Modal global
let _modalConfirm = null;

export function openModal(title, bodyHTML, onConfirm, confirmLabel = 'Confirmar') {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-confirm').textContent = confirmLabel;
  document.getElementById('modal-overlay').classList.remove('hidden');
  _modalConfirm = onConfirm;
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  _modalConfirm = null;
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-confirm').addEventListener('click', () => {
  if (_modalConfirm) _modalConfirm();
  closeModal();
});
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// ──────────────────────────────────────────────
// NAVEGAÇÃO
// ──────────────────────────────────────────────
const SECTION_TITLES = {
  dashboard:    'Dashboard',
  banco:        'Banco — Mercado Pago',
  distribuicao: 'Distribuição Mensal do Salário',
  patrimonio:   'Patrimônio e Investimentos',
  'contas-casa':'Contas da Casa',
  carro:        'Focus',
  face:         'Face',
  'devo-devem': 'Devo e Devem'
};

const initialized = new Set();

function activateSection(name) {
  // Nav links
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.section === name);
  });

  // Sections
  document.querySelectorAll('.content-section').forEach(s => {
    s.classList.remove('active');
  });
  const target = document.getElementById(`section-${name}`);
  if (target) target.classList.add('active');

  // Title
  document.getElementById('page-title').textContent = SECTION_TITLES[name] || name;

  // Init once
  if (!initialized.has(name)) {
    initialized.add(name);
    if (name === 'dashboard')    initDashboard();
    else if (name === 'banco')        initBanco();
    else if (name === 'distribuicao') initDistribuicao();
    else if (name === 'patrimonio')   initPatrimonio();
    else if (name === 'contas-casa')  initContasCasa();
    else if (name === 'carro')        initCarro();
    else if (name === 'face')         initFocus();
    else if (name === 'devo-devem')   initDevoDeve();
    else if (name.startsWith('custom-')) {
      const secao = secoesCustomizadasMap.get(name.slice('custom-'.length));
      if (secao && target) montarSecaoCustomizada(target, secao);
      return; // montarSecaoCustomizada já chama initNotas internamente
    }
    initNotas(name);
  }
}

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    activateSection(link.dataset.section);
  });
});

// Navegação disparada a partir de um card do dashboard (fixo ou customizado)
window.addEventListener('cf:ir-para-secao', e => activateSection(e.detail.name));

// ──────────────────────────────────────────────
// SECTIONS CUSTOMIZADAS E SECTIONS FIXAS OCULTAS
// ──────────────────────────────────────────────
let secoesOcultas = [];
const secoesCustomizadasMap = new Map(); // slug -> documento da section

function escApp(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function carregarConfiguracaoSections() {
  try {
    secoesOcultas = await carregarSecoesOcultas();
    aplicarVisibilidadeFixas();
  } catch { /* mantém tudo visível se a leitura falhar */ }

  try {
    const secoes = await carregarSecoesCustomizadas();
    secoes.filter(s => s.ativo).forEach(registrarSecaoCustomizadaNoDOM);
  } catch { /* sem sections customizadas cadastradas ainda */ }
}

function aplicarVisibilidadeFixas() {
  document.querySelectorAll('.nav-link[data-section]').forEach(link => {
    const key = link.dataset.section;
    if (!key || key === 'dashboard' || key.startsWith('custom-')) return;
    const li = link.closest('li');
    if (li) li.style.display = secoesOcultas.includes(key) ? 'none' : '';
  });
  document.querySelectorAll('[data-dash-section]').forEach(card => {
    card.style.display = secoesOcultas.includes(card.dataset.dashSection) ? 'none' : '';
  });
}

function registrarSecaoCustomizadaNoDOM(secao) {
  secoesCustomizadasMap.set(secao.slug, secao);
  SECTION_TITLES[`custom-${secao.slug}`] = secao.nome;

  const li = document.createElement('li');
  li.dataset.customNav = secao.id;
  li.innerHTML = `
    <a href="#" class="nav-link" data-section="custom-${secao.slug}">
      <span class="nav-icon">${secao.icone || '📁'}</span>
      <span class="nav-label">${escApp(secao.nome)}</span>
    </a>`;
  document.querySelector('.nav-list').appendChild(li);
  li.querySelector('.nav-link').addEventListener('click', e => {
    e.preventDefault();
    activateSection(`custom-${secao.slug}`);
    closeSidebar();
  });

  const section = document.createElement('section');
  section.id = `section-custom-${secao.slug}`;
  section.className = 'content-section';
  document.querySelector('.main-content').appendChild(section);
}

function removerSecaoCustomizadaDoDOM(secao) {
  document.querySelector(`li[data-custom-nav="${secao.id}"]`)?.remove();
  document.getElementById(`section-custom-${secao.slug}`)?.remove();
  secoesCustomizadasMap.delete(secao.slug);
  initialized.delete(`custom-${secao.slug}`);
  delete SECTION_TITLES[`custom-${secao.slug}`];
}

// ── "+ Nova Section" ──────────────────────────
function abrirModalNovaSecao() {
  const opcoesTemplate = Object.entries(TEMPLATES)
    .map(([key, t]) => `<option value="${key}">${t.icon} ${t.label}</option>`)
    .join('');

  openModal(
    'Nova Section',
    `<div class="form-group">
       <label>Modelo (baseado em uma section já existente)</label>
       <select id="ns-template">${opcoesTemplate}</select>
       <small id="ns-template-desc" class="form-hint"></small>
     </div>
     <div class="form-group">
       <label>Nome da nova section</label>
       <input type="text" id="ns-nome" placeholder="Ex: Moto, Cartão Nubank, Investimentos B3..." maxlength="40" autocomplete="off">
       <small class="form-hint">Esse nome também define os nomes das coleções no banco de dados.</small>
     </div>`,
    async () => {
      const template = document.getElementById('ns-template').value;
      const nome     = document.getElementById('ns-nome').value.trim();
      try {
        const secao = await criarSecaoCustomizada({ nome, template, origem: 'web' });
        registrarSecaoCustomizadaNoDOM(secao);
        await adicionarCardSecaoCustomizada(secao);
        showToast(`Section "${secao.nome}" criada!`, 'success');
        activateSection(`custom-${secao.slug}`);
      } catch (err) {
        showToast(err.message || 'Erro ao criar section.', 'error');
      }
    },
    'Criar Section'
  );

  const selectEl = document.getElementById('ns-template');
  const descEl   = document.getElementById('ns-template-desc');
  const atualizarDesc = () => { descEl.textContent = TEMPLATES[selectEl.value]?.desc || ''; };
  atualizarDesc();
  selectEl.addEventListener('change', atualizarDesc);
}

// ── "🗑️ Excluir Section" ──────────────────────
function abrirModalExcluirSecao() {
  const opcoes = [
    ...SECOES_FIXAS
      .filter(s => !secoesOcultas.includes(s.key))
      .map(s => ({ tipo: 'fixa', valor: s.key, label: s.label, icon: s.icon })),
    ...[...secoesCustomizadasMap.values()]
      .map(s => ({ tipo: 'custom', valor: s.id, label: s.nome, icon: s.icone, secao: s }))
  ];

  if (opcoes.length === 0) {
    showToast('Não há sections para excluir.', '');
    return;
  }

  const opcoesHtml = opcoes
    .map(o => `<option value="${o.tipo}:${o.valor}">${o.icon || '📁'} ${escApp(o.label)}</option>`)
    .join('');

  openModal(
    'Excluir Section',
    `<div class="form-group">
       <label>Qual section excluir?</label>
       <select id="es-select">${opcoesHtml}</select>
     </div>
     <p class="form-hint">Os dados <strong>não são apagados</strong> do banco — a section só deixa de aparecer no menu e no dashboard. Sections fixas podem ser restauradas depois direto pelo Firestore; sections customizadas ficam arquivadas.</p>
     <div class="form-group">
       <label>Digite <strong id="es-nome-confirmacao"></strong> para confirmar</label>
       <input type="text" id="es-confirmacao" placeholder="Nome exato da section" autocomplete="off">
     </div>`,
    async () => {
      const [tipo, valor] = document.getElementById('es-select').value.split(':');
      const opcao = opcoes.find(o => o.tipo === tipo && String(o.valor) === valor);
      const digitado = document.getElementById('es-confirmacao').value.trim();

      if (!opcao) return;
      if (digitado.toLowerCase() !== opcao.label.trim().toLowerCase()) {
        showToast('Nome digitado não confere. Section não foi excluída.', 'error');
        return;
      }

      try {
        if (tipo === 'fixa') {
          await ocultarSecaoFixa(valor);
          secoesOcultas.push(valor);
          aplicarVisibilidadeFixas();
          if (document.getElementById(`section-${valor}`)?.classList.contains('active')) activateSection('dashboard');
        } else {
          const secao = opcao.secao;
          await excluirSecaoCustomizada(secao.id);
          const estavaAtiva = document.getElementById(`section-custom-${secao.slug}`)?.classList.contains('active');
          removerSecaoCustomizadaDoDOM(secao);
          removerCardSecaoCustomizada(secao.id);
          if (estavaAtiva) activateSection('dashboard');
        }
        showToast(`Section "${opcao.label}" excluída.`, 'success');
      } catch {
        showToast('Erro ao excluir a section.', 'error');
      }
    },
    'Excluir'
  );

  const selectEl   = document.getElementById('es-select');
  const nomeConfEl = document.getElementById('es-nome-confirmacao');
  const atualizarNome = () => {
    const [tipo, valor] = selectEl.value.split(':');
    const opcao = opcoes.find(o => o.tipo === tipo && String(o.valor) === valor);
    nomeConfEl.textContent = opcao?.label || '';
  };
  atualizarNome();
  selectEl.addEventListener('change', atualizarNome);
}

document.getElementById('btn-nova-secao')?.addEventListener('click', abrirModalNovaSecao);
document.getElementById('btn-excluir-secao')?.addEventListener('click', abrirModalExcluirSecao);

// ──────────────────────────────────────────────
// BOOT
// ──────────────────────────────────────────────
const dateEl = document.getElementById('current-date');
if (dateEl) {
  dateEl.textContent = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
}

onAuthStateChanged(auth, async user => {
  if (user) {
    await carregarConfiguracaoSections();
    activateSection('dashboard');
  }
});

// ──────────────────────────────────────────────
// SIDEBAR MOBILE TOGGLE
// ──────────────────────────────────────────────
const menuToggle    = document.getElementById('menu-toggle');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');

function closeSidebar() { document.body.classList.remove('sidebar-open'); }

if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
  });
}
if (sidebarBackdrop) {
  sidebarBackdrop.addEventListener('click', closeSidebar);
}
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', closeSidebar);
});
