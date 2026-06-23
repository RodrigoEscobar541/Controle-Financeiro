import { initDashboard }   from './dashboard.js';
import { initBanco }       from './banco.js';
import { initDistribuicao} from './distribuicao.js';
import { initPatrimonio }  from './patrimonio.js';
import { initContasCasa }  from './contas-casa.js';
import { auth, onAuthStateChanged } from './auth.js';

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
  'contas-casa':'Contas da Casa'
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
    if (name === 'banco')        initBanco();
    if (name === 'distribuicao') initDistribuicao();
    if (name === 'patrimonio')   initPatrimonio();
    if (name === 'contas-casa')  initContasCasa();
  }
}

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    activateSection(link.dataset.section);
  });
});

// ──────────────────────────────────────────────
// BOOT
// ──────────────────────────────────────────────
const dateEl = document.getElementById('current-date');
if (dateEl) {
  dateEl.textContent = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
}

onAuthStateChanged(auth, user => {
  if (user) activateSection('dashboard');
});
