import { initDashboard, adicionarCardSecaoCustomizada, removerCardSecaoCustomizada } from './dashboard.js';
import { initBanco }       from './banco.js';
import { initDistribuicao} from './distribuicao.js';
import { initPatrimonio }  from './patrimonio.js';
import { initContasCasa }  from './contas-casa.js';
import { initFocus }       from './focus.js';
import { initFace }        from './face.js';
import { initDevoDeve }    from './devo-devem.js';
import { auth, onAuthStateChanged } from './auth.js';
import { initNotas }       from './notas.js';
import { montarSecaoCustomizada } from './custom-sections.js';
import {
  SECOES_FIXAS, TEMPLATES,
  carregarSecoesCustomizadas, criarSecaoCustomizada, excluirSecaoCustomizada,
  carregarSecoesOcultas, ocultarSecaoFixa
} from './section-templates.js';
import {
  carregarPermissoes, ehAdmin, podeVer, nomeUsuario, semAcessoNenhum
} from './permissoes.js';
import { SECOES_BELLA_MENU, GRUPO_BELLA, ORDEM_SIDEBAR_BELLA } from './secoes-bella.js';

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

// ──────────────────────────────────────────────
// VIEWPORT VISUAL (mobile)
// ──────────────────────────────────────────────
// No celular o teclado virtual NÃO encolhe o viewport de layout — só o visual.
// Um overlay `position: fixed; inset: 0` continua com a altura da tela inteira
// e o modal centralizado nela fica metade atrás do teclado. Aqui publicamos as
// medidas do viewport VISUAL em variáveis CSS; o overlay se ancora nelas
// (ver .modal-overlay em styles.css) e passa a ocupar só a área realmente
// visível, acima do teclado.
const vv = window.visualViewport;

function sincronizarViewportVisual() {
  if (!vv) return;
  const raiz = document.documentElement;
  const alturaLayout = window.innerHeight || vv.height;
  raiz.style.setProperty('--vv-top',    `${Math.round(vv.offsetTop)}px`);
  raiz.style.setProperty('--vv-left',   `${Math.round(vv.offsetLeft)}px`);
  raiz.style.setProperty('--vv-width',  `${Math.round(vv.width)}px`);
  raiz.style.setProperty('--vv-height', `${Math.round(vv.height)}px`);
  raiz.style.setProperty(
    '--vv-bottom',
    `${Math.max(0, Math.round(alturaLayout - vv.offsetTop - vv.height))}px`
  );
}

if (vv) {
  vv.addEventListener('resize', sincronizarViewportVisual);
  vv.addEventListener('scroll', sincronizarViewportVisual);
  window.addEventListener('orientationchange', () => setTimeout(sincronizarViewportVisual, 250));
  sincronizarViewportVisual();
}

// ──────────────────────────────────────────────
// MODAL GLOBAL
// ──────────────────────────────────────────────
let _modalConfirm = null;
let _scrollTravado = 0;

const modalOverlay = document.getElementById('modal-overlay');
const modalEl      = modalOverlay?.querySelector('.modal');

function travarFundo() {
  // Se um modal abrir outro, a posição real já está congelada — não recapturar
  // (com o body fixo, window.scrollY é 0 e a página voltaria ao topo ao fechar).
  if (document.body.classList.contains('modal-open')) return;
  _scrollTravado = window.scrollY || document.documentElement.scrollTop || 0;
  // Travar o body some com a barra de rolagem no desktop; compensar a largura
  // dela evita o "pulo" horizontal do conteúdo ao abrir o modal.
  const larguraBarra = window.innerWidth - document.documentElement.clientWidth;
  if (larguraBarra > 0) document.body.style.paddingRight = `${larguraBarra}px`;
  document.body.style.top = `-${_scrollTravado}px`;
  document.body.classList.add('modal-open');
}

function destravarFundo() {
  document.body.classList.remove('modal-open');
  document.body.style.top = '';
  document.body.style.paddingRight = '';
  window.scrollTo(0, _scrollTravado);
}

// Campos focáveis do modal, na ordem de tabulação.
function focaveisDoModal() {
  return [...modalEl.querySelectorAll(
    'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href]'
  )].filter(el => el.offsetParent !== null);
}

export function openModal(title, bodyHTML, onConfirm, confirmLabel = 'Confirmar') {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-confirm').textContent = confirmLabel;
  modalOverlay.classList.remove('hidden');
  _modalConfirm = onConfirm;

  travarFundo();
  modalOverlay.scrollTop = 0;
  document.getElementById('modal-body').scrollTop = 0;

  // Foca o primeiro campo do formulário e já seleciona o conteúdo: no celular
  // isso transforma "editar um valor" em um toque só (abre o modal, o teclado
  // sobe e o valor antigo é substituído ao digitar).
  const primeiro = modalEl.querySelector('#modal-body input:not([type="hidden"]), #modal-body select, #modal-body textarea');
  if (primeiro) {
    primeiro.focus({ preventScroll: true });
    if (typeof primeiro.select === 'function' && /^(text|number|search|tel|url|email|password)$/.test(primeiro.type || '')) {
      primeiro.select();
    }
  }
}

export function closeModal() {
  modalOverlay.classList.add('hidden');
  _modalConfirm = null;
  destravarFundo();
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-confirm').addEventListener('click', () => {
  if (_modalConfirm) _modalConfirm();
  closeModal();
});
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});

// Ao focar um campo, garante que ele fique visível acima do teclado. O ajuste
// do viewport visual é assíncrono, daí o pequeno atraso.
modalEl.addEventListener('focusin', e => {
  if (!e.target.matches('input, select, textarea')) return;
  setTimeout(() => e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 300);
});

document.addEventListener('keydown', e => {
  if (modalOverlay.classList.contains('hidden')) return;

  if (e.key === 'Escape') { closeModal(); return; }

  // Enter num campo de uma linha confirma (não em textarea, onde quebra linha).
  if (e.key === 'Enter' && e.target.matches('input:not([type="button"]):not([type="submit"])')) {
    e.preventDefault();
    document.getElementById('modal-confirm').click();
    return;
  }

  // Mantém o foco preso dentro do modal enquanto ele está aberto.
  if (e.key === 'Tab') {
    const campos = focaveisDoModal();
    if (campos.length === 0) return;
    const primeiro = campos[0];
    const ultimo   = campos[campos.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault(); ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault(); primeiro.focus();
    }
  }
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
  focus:        'Focus',
  face:         'Face',
  'devo-devem': 'Devo e Devem'
};

const initialized = new Set();

// Qual dashboard é a "casa" deste usuário. O admin entra no Dashboard geral;
// quem tem dashboard próprio entra no seu — ter os dois no menu de uma pessoa
// só seria confuso, já que um deles mostraria cards de sections que ela nem vê.
let dashboardPadrao = 'dashboard';

function definirDashboardPadrao() {
  dashboardPadrao = (!ehAdmin() && podeVer('dashboard-bella'))
    ? 'dashboard-bella'
    : 'dashboard';
}

function activateSection(name) {
  // Trava de navegação: sem acesso, cai no dashboard em vez de abrir uma tela
  // que só encheria o console de "insufficient permissions". Vale para link
  // do menu, card do dashboard e chamada programática — todos passam por aqui.
  if (!podeVer(name)) name = dashboardPadrao;

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
    else if (name === 'focus')        initFocus();
    else if (name === 'face')         initFace();
    else if (name === 'devo-devem')   initDevoDeve();
    else if (secoesExtrasMap.has(name)) {
      const secao = secoesExtrasMap.get(name);
      if (target) montarSecaoCustomizada(target, secao);
      return; // montarSecaoCustomizada já chama initNotas internamente
    }
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
// Sections de outro usuário (hoje, as da Bella). Chaveadas pela `chave`, que
// é a mesma string usada na permissão — diferente das customizadas, que vivem
// no Firestore e são chaveadas por slug com prefixo "custom-".
const secoesExtrasMap = new Map();       // chave -> definição da section

function escApp(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function carregarConfiguracaoSections() {
  // `secoes_ocultas` é preferência do admin e mora num documento que só o
  // admin pode ler — nem tentamos a leitura como convidado, para não gerar
  // um erro de permissão garantido no console.
  if (ehAdmin()) {
    try {
      secoesOcultas = await carregarSecoesOcultas();
    } catch { secoesOcultas = []; }
  } else {
    secoesOcultas = [];
  }

  // FORA do try, e sempre. Já esteve dentro dele: como a leitura acima falha
  // para convidado, o catch pulava a filtragem inteira e a pessoa via o menu
  // completo — sections a que não tem acesso nenhum incluídas. Falhar ao ler
  // uma preferência não pode significar "mostre tudo".
  aplicarVisibilidadeFixas();

  // Sections customizadas são administração: só o admin as vê, e só ele pode
  // ler a coleção. Aqui o catch é seguro — falhar significa não acrescentar
  // nada ao menu, que é o lado certo de errar.
  if (ehAdmin()) {
    try {
      const secoes = await carregarSecoesCustomizadas();
      secoes.filter(s => s.ativo).forEach(registrarSecaoCustomizadaNoDOM);
    } catch { /* sem sections customizadas cadastradas ainda */ }
  }

  montarGrupoBella();
}

// ── Sections da Bella ─────────────────────────────────────────────
// Entram no fim do menu, atrás de um cabeçalho com o nome dela — mas só
// para o admin. Na sidebar da própria Bella o cabeçalho não faz sentido:
// ela não precisa de um rótulo dizendo que as sections dela são dela.
function montarGrupoBella() {
  const visiveis = SECOES_BELLA_MENU.filter(s => podeVer(s.chave));
  if (!visiveis.length) return;

  if (ehAdmin()) adicionarCabecalhoGrupo(GRUPO_BELLA);
  visiveis.forEach(registrarSecaoExtraNoDOM);
  limparGruposVazios();

  // Só na visão dela. No menu do admin a ordem das sections fixas é a do
  // HTML e o grupo BELLA fica no fim, atrás do cabeçalho — reordenar ali
  // misturaria os dois grupos e o cabeçalho passaria a rotular a lista
  // errada.
  if (!ehAdmin()) ordenarSidebar(ORDEM_SIDEBAR_BELLA);
}

/**
 * Reordena os itens do menu segundo uma lista de chaves.
 * Reanexar um <li> move ele para o fim, então percorrer a ordem desejada
 * deixa a lista exatamente nessa sequência. Itens fora da lista sobram no
 * começo — e como são justamente os que a pessoa não pode ver (já estão
 * com display:none), não aparecem.
 */
function ordenarSidebar(ordem) {
  const lista = document.querySelector('.nav-list');
  if (!lista) return;
  ordem.forEach(chave => {
    const li = lista.querySelector(`.nav-link[data-section="${chave}"]`)?.closest('li');
    if (li) lista.appendChild(li);
  });
}

function registrarSecaoExtraNoDOM(secao) {
  secoesExtrasMap.set(secao.chave, secao);
  SECTION_TITLES[secao.chave] = secao.titulo || secao.nome;

  const li = document.createElement('li');
  li.dataset.extraNav = secao.chave;
  li.innerHTML = `
    <a href="#" class="nav-link" data-section="${secao.chave}">
      <span class="nav-icon">${secao.icone || '📁'}</span>
      <span class="nav-label">${escApp(secao.nome)}</span>
    </a>`;
  document.querySelector('.nav-list').appendChild(li);
  li.querySelector('.nav-link').addEventListener('click', e => {
    e.preventDefault();
    activateSection(secao.chave);
    closeSidebar();
  });

  const section = document.createElement('section');
  section.id = `section-${secao.chave}`;
  section.className = 'content-section';
  document.querySelector('.main-content').appendChild(section);
}

// Uma section some do menu por DOIS motivos diferentes, que nunca devem ser
// confundidos:
//   • sem permissão  → decisão do admin; a pessoa não tem acesso ao dado.
//   • oculta         → preferência de quem está usando ("não me serve").
// Misturar os dois num campo só faz o convidado esconder algo e o admin não
// conseguir devolver, ou uma revogação parecer defeito para quem perdeu.
function secaoVisivel(key) {
  return podeVer(key) && !secoesOcultas.includes(key);
}

function aplicarVisibilidadeFixas() {
  document.querySelectorAll('.nav-link[data-section]').forEach(link => {
    const key = link.dataset.section;
    if (!key || key.startsWith('custom-')) return;
    const li = link.closest('li');
    // O Dashboard geral só entra no menu de quem o usa como casa — para a
    // Bella ele mostraria cards de sections que ela nem enxerga.
    const visivel = key === 'dashboard'
      ? dashboardPadrao === 'dashboard'
      : secaoVisivel(key);
    if (li) li.style.display = visivel ? '' : 'none';
  });
  document.querySelectorAll('[data-dash-section]').forEach(card => {
    card.style.display = secaoVisivel(card.dataset.dashSection) ? '' : 'none';
  });
  limparGruposVazios();
}

// ── Divisão entre os grupos da sidebar ────────────────────────────
// Cabeçalho que separa "as minhas sections" das sections de outra pessoa.
// Só aparece quando existe pelo menos um item embaixo dele — um título
// solto, sem nada abaixo, pareceria menu quebrado.
export function adicionarCabecalhoGrupo(titulo) {
  const lista = document.querySelector('.nav-list');
  if (!lista) return null;
  const li = document.createElement('li');
  li.className = 'nav-group-header';
  li.dataset.grupo = titulo;
  li.innerHTML = `<span class="nav-group-label">${escApp(titulo)}</span>`;
  lista.appendChild(li);
  return li;
}

// Esconde cabeçalhos de grupo que ficaram sem nenhum item visível abaixo.
function limparGruposVazios() {
  document.querySelectorAll('.nav-list .nav-group-header').forEach(header => {
    let temItem = false;
    let irmao = header.nextElementSibling;
    while (irmao && !irmao.classList.contains('nav-group-header')) {
      if (irmao.style.display !== 'none') { temItem = true; break; }
      irmao = irmao.nextElementSibling;
    }
    header.style.display = temItem ? '' : 'none';
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
  if (!user) return;

  // ORDEM IMPORTA: as permissões precisam estar em memória antes de montar a
  // sidebar e antes de qualquer query. Invertendo, o convidado enxerga o menu
  // inteiro por um instante e as consultas disparam contra coleções que ele
  // não pode ler.
  await carregarPermissoes(user);
  aplicarModoAdmin();

  if (semAcessoNenhum()) { mostrarSemAcesso(user); return; }

  // Antes de montar o menu: `aplicarVisibilidadeFixas` consulta o dashboard
  // padrão para decidir se o Dashboard geral aparece.
  definirDashboardPadrao();

  await carregarConfiguracaoSections();
  activateSection(dashboardPadrao);
});

// Tela em branco é o pior diagnóstico possível. Quem chega aqui ou é um
// convidado ainda sem acesso liberado, ou é o admin cujo claim não foi
// definido — e as duas situações têm conserto conhecido, então vale dizer
// qual é em vez de deixar a pessoa achando que o app quebrou.
function mostrarSemAcesso(user) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.querySelector('.nav-list')?.style.setProperty('display', 'none');

  const titulo = document.getElementById('page-title');
  if (titulo) titulo.textContent = 'Sem acesso';

  const main = document.querySelector('.main-content');
  if (!main) return;
  const aviso = document.createElement('section');
  aviso.className = 'content-section active';
  aviso.innerHTML = `
    <div class="card">
      <h3 class="card-title">Nenhuma section liberada para esta conta</h3>
      <p style="margin-top:.75rem;color:var(--text-secondary);line-height:1.6">
        Você entrou como <strong>${escApp(user.email || '')}</strong>, mas esta conta
        ainda não tem acesso a nenhuma section.
      </p>
      <p style="margin-top:.75rem;color:var(--text-secondary);line-height:1.6">
        Se você é o administrador e acabou de publicar esta versão, rode
        <code>node scripts/definir-acesso.js admin &lt;seu-uid&gt;</code>
        na pasta <code>Bot Render</code> e recarregue a página.
      </p>
    </div>`;
  main.appendChild(aviso);
}

// Os botões de administrar sections são só do admin. Esconder aqui é conforto,
// não segurança — quem chamar a função pelo console esbarra em
// `firestore.rules`, que barra escrita em secoes_customizadas/config para
// qualquer um que não seja admin.
function aplicarModoAdmin() {
  const admin = ehAdmin();
  document.querySelector('.sidebar-actions')?.style.setProperty('display', admin ? '' : 'none');
  document.body.classList.toggle('modo-convidado', !admin);

  const emailEl = document.getElementById('user-email-sidebar');
  if (emailEl && !admin && nomeUsuario()) emailEl.textContent = nomeUsuario();
}

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
